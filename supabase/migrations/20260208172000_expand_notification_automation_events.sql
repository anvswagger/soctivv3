-- Expand IF -> THEN automation event catalog for stronger control
-- Adds richer appointment/lead events and trigger sources.

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
      'lead_created',
      'lead_updated',
      'lead_status_changed',
      'lead_stage_changed',
      'lead_sold'
    )
  );

-- Generic dispatcher to call the edge function for automation events.
CREATE OR REPLACE FUNCTION public.fire_notification_automation_event(
  event_name TEXT,
  payload JSONB,
  old_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured yet, skip quietly.
  IF coalesce(supabase_url, '') = '' OR coalesce(service_role_key, '') = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'event_type', event_name,
      'event_payload', coalesce(payload, '{}'::jsonb),
      'old_payload', coalesce(old_payload, '{}'::jsonb),
      'source', 'db_trigger'
    )
  );
END;
$$;

-- Appointment trigger: emit rich event variants.
CREATE OR REPLACE FUNCTION public.trigger_appointment_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  old_payload JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'appointment_id', NEW.id,
      'client_id', NEW.client_id,
      'lead_id', NEW.lead_id,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status,
      'duration_minutes', NEW.duration_minutes,
      'location', NEW.location,
      'notes', NEW.notes
    );

    PERFORM public.fire_notification_automation_event(
      'appointment_created',
      payload,
      old_payload
    );

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
    'appointment_id', NEW.id,
    'client_id', NEW.client_id,
    'lead_id', NEW.lead_id,
    'scheduled_at', NEW.scheduled_at,
    'status', NEW.status,
    'duration_minutes', NEW.duration_minutes,
    'location', NEW.location,
    'notes', NEW.notes
  );

  old_payload := jsonb_build_object(
    'appointment_id', OLD.id,
    'client_id', OLD.client_id,
    'lead_id', OLD.lead_id,
    'scheduled_at', OLD.scheduled_at,
    'status', OLD.status,
    'duration_minutes', OLD.duration_minutes,
    'location', OLD.location,
    'notes', OLD.notes
  );

  PERFORM public.fire_notification_automation_event(
    'appointment_updated',
    payload,
    old_payload
  );

  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    PERFORM public.fire_notification_automation_event(
      'appointment_rescheduled',
      payload,
      old_payload
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.fire_notification_automation_event(
      'appointment_status_changed',
      payload,
      old_payload
    );

    IF NEW.status = 'completed' THEN
      PERFORM public.fire_notification_automation_event(
        'appointment_completed',
        payload,
        old_payload
      );
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.fire_notification_automation_event(
        'appointment_cancelled',
        payload,
        old_payload
      );
    ELSIF NEW.status = 'no_show' THEN
      PERFORM public.fire_notification_automation_event(
        'appointment_no_show',
        payload,
        old_payload
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_notify_insert ON public.appointments;
CREATE TRIGGER trg_appointments_notify_insert
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_notification_event();

DROP TRIGGER IF EXISTS trg_appointments_notify_update ON public.appointments;
CREATE TRIGGER trg_appointments_notify_update
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_notification_event();

-- Lead trigger: emit lead lifecycle variants.
CREATE OR REPLACE FUNCTION public.trigger_lead_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  old_payload JSONB := '{}'::jsonb;
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
