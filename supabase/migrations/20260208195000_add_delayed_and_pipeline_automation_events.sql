-- Add delayed automation events and per-pipeline IF events

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

-- Marker table to ensure delayed automation events are dispatched once per entity+time key.
CREATE TABLE IF NOT EXISTS public.notification_automation_event_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('appointment', 'lead')),
  entity_id UUID NOT NULL,
  event_key TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_type, entity_type, entity_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_automation_event_dispatches_event
  ON public.notification_automation_event_dispatches (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_automation_event_dispatches_entity
  ON public.notification_automation_event_dispatches (entity_type, entity_id);

-- Timer runner: emits "appointment_after_1h" once for each appointment schedule.
CREATE OR REPLACE FUNCTION public.run_notification_automation_timers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt RECORD;
  marker_key TEXT;
  dispatched_count INTEGER := 0;
BEGIN
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

  RETURN dispatched_count;
END;
$$;

-- Extend lead trigger to emit explicit IF events for each pipeline status.
CREATE OR REPLACE FUNCTION public.trigger_lead_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  old_payload JSONB := '{}'::jsonb;
  pipeline_event TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'lead_id', NEW.id,
      'client_id', NEW.client_id,
      'status', NEW.status,
      'stage', NEW.stage,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'phone', NEW.phone,
      'email', NEW.email,
      'source', NEW.source,
      'worktype', NEW.worktype
    );

    PERFORM public.fire_notification_automation_event(
      'lead_created',
      payload,
      old_payload
    );

    pipeline_event := CASE NEW.status::text
      WHEN 'new' THEN 'lead_pipeline_new'
      WHEN 'contacting' THEN 'lead_pipeline_contacting'
      WHEN 'appointment_booked' THEN 'lead_pipeline_appointment_booked'
      WHEN 'interviewed' THEN 'lead_pipeline_interviewed'
      WHEN 'no_show' THEN 'lead_pipeline_no_show'
      WHEN 'sold' THEN 'lead_pipeline_sold'
      WHEN 'cancelled' THEN 'lead_pipeline_cancelled'
      ELSE NULL
    END;

    IF pipeline_event IS NOT NULL THEN
      PERFORM public.fire_notification_automation_event(
        pipeline_event,
        payload,
        old_payload
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Ignore no-op updates where only updated_at changed.
  IF (to_jsonb(NEW) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'lead_id', NEW.id,
    'client_id', NEW.client_id,
    'status', NEW.status,
    'stage', NEW.stage,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'phone', NEW.phone,
    'email', NEW.email,
    'source', NEW.source,
    'worktype', NEW.worktype
  );

  old_payload := jsonb_build_object(
    'lead_id', OLD.id,
    'client_id', OLD.client_id,
    'status', OLD.status,
    'stage', OLD.stage,
    'first_name', OLD.first_name,
    'last_name', OLD.last_name,
    'phone', OLD.phone,
    'email', OLD.email,
    'source', OLD.source,
    'worktype', OLD.worktype
  );

  PERFORM public.fire_notification_automation_event(
    'lead_updated',
    payload,
    old_payload
  );

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.fire_notification_automation_event(
      'lead_status_changed',
      payload,
      old_payload
    );

    IF NEW.status = 'sold' THEN
      PERFORM public.fire_notification_automation_event(
        'lead_sold',
        payload,
        old_payload
      );
    END IF;

    pipeline_event := CASE NEW.status::text
      WHEN 'new' THEN 'lead_pipeline_new'
      WHEN 'contacting' THEN 'lead_pipeline_contacting'
      WHEN 'appointment_booked' THEN 'lead_pipeline_appointment_booked'
      WHEN 'interviewed' THEN 'lead_pipeline_interviewed'
      WHEN 'no_show' THEN 'lead_pipeline_no_show'
      WHEN 'sold' THEN 'lead_pipeline_sold'
      WHEN 'cancelled' THEN 'lead_pipeline_cancelled'
      ELSE NULL
    END;

    IF pipeline_event IS NOT NULL THEN
      PERFORM public.fire_notification_automation_event(
        pipeline_event,
        payload,
        old_payload
      );
    END IF;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM public.fire_notification_automation_event(
      'lead_stage_changed',
      payload,
      old_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_notify_insert ON public.leads;
CREATE TRIGGER trg_leads_notify_insert
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trigger_lead_notification_event();

DROP TRIGGER IF EXISTS trg_leads_notify_update ON public.leads;
CREATE TRIGGER trg_leads_notify_update
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trigger_lead_notification_event();

-- Run delayed IF checks every 5 minutes.
DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
  FROM cron.job
  WHERE jobname = 'notification-automation-timers-cron'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'notification-automation-timers-cron',
    '*/5 * * * *',
    $job$
    SELECT public.run_notification_automation_timers();
    $job$
  );
END;
$$;

-- Seed one delayed rule by default (idempotent).
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
  'متابعة بعد الموعد بساعة - فريق العميل',
  'appointment_after_1h',
  'info',
  '/appointments',
  'متابعة بعد الموعد بساعة',
  'مرّت ساعة على الموعد للعميل {{lead_name}} (الحالة: {{status}})',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_automation_rules
  WHERE name = 'متابعة بعد الموعد بساعة - فريق العميل'
);
