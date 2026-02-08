-- Add delayed IF event: 48 hours after appointment is marked no_show

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_event_type_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_event_type_check
  CHECK (
    event_type IN (
      'appointment_created',
      'appointment_updated',
      'appointment_rescheduled',
      'appointment_status_changed',
      'appointment_completed',
      'appointment_cancelled',
      'appointment_no_show',
      'appointment_no_show_after_48h',
      'appointment_after_1h',
      'lead_created',
      'lead_updated',
      'lead_status_changed',
      'lead_stage_changed',
      'lead_sold',
      'lead_pipeline_new',
      'lead_pipeline_contacting',
      'lead_pipeline_appointment_booked',
      'lead_pipeline_interviewed',
      'lead_pipeline_no_show',
      'lead_pipeline_sold',
      'lead_pipeline_cancelled'
    )
  );

-- Track the exact moment an appointment transitions to no_show.
CREATE TABLE IF NOT EXISTS public.notification_appointment_no_show_markers (
  appointment_id UUID PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  no_show_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_no_show_markers_no_show_at
  ON public.notification_appointment_no_show_markers(no_show_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notification_no_show_markers_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_no_show_markers_updated_at
    BEFORE UPDATE ON public.notification_appointment_no_show_markers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- Keep marker table synchronized whenever appointment status changes.
CREATE OR REPLACE FUNCTION public.track_appointment_no_show_marker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'no_show' THEN
      INSERT INTO public.notification_appointment_no_show_markers (
        appointment_id,
        client_id,
        lead_id,
        no_show_at
      )
      VALUES (
        NEW.id,
        NEW.client_id,
        NEW.lead_id,
        coalesce(NEW.updated_at, now())
      )
      ON CONFLICT (appointment_id) DO UPDATE
      SET
        client_id = EXCLUDED.client_id,
        lead_id = EXCLUDED.lead_id,
        no_show_at = EXCLUDED.no_show_at,
        updated_at = now();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'no_show' AND NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.notification_appointment_no_show_markers (
        appointment_id,
        client_id,
        lead_id,
        no_show_at
      )
      VALUES (
        NEW.id,
        NEW.client_id,
        NEW.lead_id,
        coalesce(NEW.updated_at, now())
      )
      ON CONFLICT (appointment_id) DO UPDATE
      SET
        client_id = EXCLUDED.client_id,
        lead_id = EXCLUDED.lead_id,
        no_show_at = EXCLUDED.no_show_at,
        updated_at = now();
    ELSIF OLD.status = 'no_show' AND NEW.status <> 'no_show' THEN
      DELETE FROM public.notification_appointment_no_show_markers
      WHERE appointment_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_appointment_no_show_marker_insert ON public.appointments;
CREATE TRIGGER trg_track_appointment_no_show_marker_insert
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.track_appointment_no_show_marker();

DROP TRIGGER IF EXISTS trg_track_appointment_no_show_marker_update ON public.appointments;
CREATE TRIGGER trg_track_appointment_no_show_marker_update
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.track_appointment_no_show_marker();

-- Extend delayed timer runner with no_show + 48h event.
CREATE OR REPLACE FUNCTION public.run_notification_automation_timers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt RECORD;
  no_show_appt RECORD;
  marker_key TEXT;
  dispatched_count INTEGER := 0;
BEGIN
  -- Existing delayed event: 1 hour after appointment time.
  FOR appt IN
    SELECT
      a.id AS appointment_id,
      a.client_id,
      a.lead_id,
      a.scheduled_at,
      a.status,
      a.duration_minutes,
      a.location,
      a.notes,
      l.first_name,
      l.last_name,
      l.stage,
      l.source,
      l.phone,
      l.email,
      l.status AS lead_status
    FROM public.appointments a
    LEFT JOIN public.leads l ON l.id = a.lead_id
    WHERE a.scheduled_at <= now() - interval '1 hour'
      AND a.status IN ('scheduled', 'completed', 'no_show')
  LOOP
    marker_key := to_char(
      (appt.scheduled_at AT TIME ZONE 'UTC'),
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );

    INSERT INTO public.notification_automation_event_dispatches (
      event_type,
      entity_type,
      entity_id,
      event_key
    )
    VALUES (
      'appointment_after_1h',
      'appointment',
      appt.appointment_id,
      marker_key
    )
    ON CONFLICT (event_type, entity_type, entity_id, event_key) DO NOTHING;

    IF FOUND THEN
      PERFORM public.fire_notification_automation_event(
        'appointment_after_1h',
        jsonb_build_object(
          'appointment_id', appt.appointment_id,
          'client_id', appt.client_id,
          'lead_id', appt.lead_id,
          'scheduled_at', appt.scheduled_at,
          'status', appt.status,
          'duration_minutes', appt.duration_minutes,
          'location', appt.location,
          'notes', appt.notes,
          'first_name', appt.first_name,
          'last_name', appt.last_name,
          'stage', appt.stage,
          'source', appt.source,
          'phone', appt.phone,
          'email', appt.email,
          'lead_status', appt.lead_status
        ),
        '{}'::jsonb
      );

      dispatched_count := dispatched_count + 1;
    END IF;
  END LOOP;

  -- New delayed event: 48 hours after status is marked no_show.
  FOR no_show_appt IN
    SELECT
      a.id AS appointment_id,
      a.client_id,
      a.lead_id,
      a.scheduled_at,
      a.status,
      a.duration_minutes,
      a.location,
      a.notes,
      m.no_show_at,
      l.first_name,
      l.last_name,
      l.stage,
      l.source,
      l.phone,
      l.email,
      l.status AS lead_status
    FROM public.notification_appointment_no_show_markers m
    JOIN public.appointments a ON a.id = m.appointment_id
    LEFT JOIN public.leads l ON l.id = a.lead_id
    WHERE m.no_show_at <= now() - interval '48 hours'
      AND a.status = 'no_show'
  LOOP
    marker_key := to_char(
      (no_show_appt.no_show_at AT TIME ZONE 'UTC'),
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );

    INSERT INTO public.notification_automation_event_dispatches (
      event_type,
      entity_type,
      entity_id,
      event_key
    )
    VALUES (
      'appointment_no_show_after_48h',
      'appointment',
      no_show_appt.appointment_id,
      marker_key
    )
    ON CONFLICT (event_type, entity_type, entity_id, event_key) DO NOTHING;

    IF FOUND THEN
      PERFORM public.fire_notification_automation_event(
        'appointment_no_show_after_48h',
        jsonb_build_object(
          'appointment_id', no_show_appt.appointment_id,
          'client_id', no_show_appt.client_id,
          'lead_id', no_show_appt.lead_id,
          'scheduled_at', no_show_appt.scheduled_at,
          'status', no_show_appt.status,
          'duration_minutes', no_show_appt.duration_minutes,
          'location', no_show_appt.location,
          'notes', no_show_appt.notes,
          'no_show_at', no_show_appt.no_show_at,
          'first_name', no_show_appt.first_name,
          'last_name', no_show_appt.last_name,
          'stage', no_show_appt.stage,
          'source', no_show_appt.source,
          'phone', no_show_appt.phone,
          'email', no_show_appt.email,
          'lead_status', no_show_appt.lead_status
        ),
        '{}'::jsonb
      );

      dispatched_count := dispatched_count + 1;
    END IF;
  END LOOP;

  RETURN dispatched_count;
END;
$$;

-- Seed default IF rule for delayed no_show follow-up.
INSERT INTO public.notification_automation_rules (
  name,
  event_type,
  notification_type,
  url,
  title_template,
  message_template,
  send_push,
  send_in_app,
  target_roles,
  only_event_client,
  enabled
)
SELECT
  'متابعة عدم الحضور بعد 48 ساعة - فريق العميل',
  'appointment_no_show_after_48h',
  'warning',
  '/appointments',
  'متابعة عدم الحضور بعد 48 ساعة',
  'مرّت 48 ساعة على حالة عدم الحضور للعميل {{lead_name}}',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_automation_rules
  WHERE name = 'متابعة عدم الحضور بعد 48 ساعة - فريق العميل'
);
