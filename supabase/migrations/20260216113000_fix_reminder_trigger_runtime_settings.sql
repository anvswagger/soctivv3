-- Fix appointment reminder trigger to avoid hardcoded project URL/keys.
-- Uses runtime settings from app_runtime_settings first, then legacy app.settings.* fallback.

CREATE TABLE IF NOT EXISTS public.appointment_reminder_trigger_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  appointment_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('trigger_fired', 'net_unavailable', 'http_call_failed', 'http_call_success', 'error')),
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT
);

ALTER TABLE public.appointment_reminder_trigger_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage reminder trigger log" ON public.appointment_reminder_trigger_log;
CREATE POLICY "Service role can manage reminder trigger log"
ON public.appointment_reminder_trigger_log
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.appointment_reminder_trigger_log TO authenticated;

CREATE OR REPLACE FUNCTION public.trigger_appointment_reminder_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_target_url TEXT;
  v_net_available BOOLEAN := to_regnamespace('net') IS NOT NULL;
  v_request_id BIGINT;
BEGIN
  BEGIN
    SELECT s.supabase_url, s.service_role_key
    INTO v_supabase_url, v_service_role_key
    FROM public.app_runtime_settings s
    WHERE s.id = 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_supabase_url := NULL;
      v_service_role_key := NULL;
  END;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF to_regclass('public.appointment_reminder_trigger_log') IS NOT NULL THEN
    INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
    VALUES (
      NEW.id,
      'on_insert',
      CASE WHEN v_net_available THEN 'trigger_fired' ELSE 'net_unavailable' END,
      jsonb_build_object(
        'scheduled_at', NEW.scheduled_at,
        'status', NEW.status,
        'net_available', v_net_available
      )
    );
  END IF;

  IF NOT v_net_available THEN
    RETURN NEW;
  END IF;

  IF coalesce(v_supabase_url, '') = '' OR coalesce(v_service_role_key, '') = '' THEN
    IF to_regclass('public.appointment_reminder_trigger_log') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
      VALUES (
        NEW.id,
        'on_insert',
        'error',
        'Missing runtime settings for appointment-reminders trigger',
        jsonb_build_object(
          'has_supabase_url', coalesce(v_supabase_url, '') <> '',
          'has_service_role_key', coalesce(v_service_role_key, '') <> ''
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  v_target_url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/appointment-reminders';

  BEGIN
    v_request_id := net.http_post(
      url := v_target_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('appointment_id', NEW.id)
    );

    IF to_regclass('public.appointment_reminder_trigger_log') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
      VALUES (
        NEW.id,
        'on_insert',
        'http_call_success',
        jsonb_build_object(
          'target_url', v_target_url,
          'request_id', v_request_id
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF to_regclass('public.appointment_reminder_trigger_log') IS NOT NULL THEN
        INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
        VALUES (
          NEW.id,
          'on_insert',
          'http_call_failed',
          SQLERRM,
          jsonb_build_object('target_url', v_target_url)
        );
      END IF;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.debug_trigger_reminder_for_appointment(p_appointment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_target_url TEXT;
  v_request_id BIGINT;
  v_result JSONB;
BEGIN
  IF to_regnamespace('net') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'net schema is missing');
  END IF;

  BEGIN
    SELECT s.supabase_url, s.service_role_key
    INTO v_supabase_url, v_service_role_key
    FROM public.app_runtime_settings s
    WHERE s.id = 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_supabase_url := NULL;
      v_service_role_key := NULL;
  END;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF coalesce(v_supabase_url, '') = '' OR coalesce(v_service_role_key, '') = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Missing runtime settings',
      'has_supabase_url', coalesce(v_supabase_url, '') <> '',
      'has_service_role_key', coalesce(v_service_role_key, '') <> ''
    );
  END IF;

  v_target_url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/appointment-reminders';

  INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
  VALUES (p_appointment_id, 'manual', 'trigger_fired', jsonb_build_object('target_url', v_target_url));

  v_request_id := net.http_post(
    url := v_target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('appointment_id', p_appointment_id)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'queued',
    'appointment_id', p_appointment_id,
    'request_id', v_request_id,
    'target_url', v_target_url
  );

  INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
  VALUES (p_appointment_id, 'manual', 'http_call_success', v_result);

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'ok', false,
      'appointment_id', p_appointment_id,
      'error', SQLERRM
    );

    IF to_regclass('public.appointment_reminder_trigger_log') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
      VALUES (p_appointment_id, 'manual', 'http_call_failed', SQLERRM, v_result);
    END IF;

    RETURN v_result;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_reminder_on_insert ON public.appointments;
CREATE TRIGGER trigger_check_reminder_on_insert
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_reminder_check();

GRANT EXECUTE ON FUNCTION public.debug_trigger_reminder_for_appointment(UUID) TO service_role;

-- Make notification automation dispatcher resilient across both settings sources.
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
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  IF to_regnamespace('net') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT s.supabase_url, s.service_role_key
    INTO v_supabase_url, v_service_role_key
    FROM public.app_runtime_settings s
    WHERE s.id = 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_supabase_url := NULL;
      v_service_role_key := NULL;
  END;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF coalesce(v_supabase_url, '') = '' OR coalesce(v_service_role_key, '') = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
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

-- Keep reminder cron compatible with both app_runtime_settings and app.settings.*.
CREATE OR REPLACE FUNCTION public.run_appointment_reminders_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_target_url TEXT;
  v_request_id BIGINT;
  v_result JSONB;
BEGIN
  IF to_regnamespace('net') IS NULL THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'net_schema_missing');
    IF to_regclass('public.appointment_reminder_cron_runs') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
      VALUES ('skipped', 'net schema is missing (pg_net not available).', v_result);
    END IF;
    RETURN v_result;
  END IF;

  BEGIN
    SELECT s.supabase_url, s.service_role_key
    INTO v_supabase_url, v_service_role_key
    FROM public.app_runtime_settings s
    WHERE s.id = 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_supabase_url := NULL;
      v_service_role_key := NULL;
  END;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'missing_supabase_url');
    IF to_regclass('public.appointment_reminder_cron_runs') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
      VALUES ('skipped', 'Runtime Supabase URL is empty.', v_result);
    END IF;
    RETURN v_result;
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'missing_service_role_key');
    IF to_regclass('public.appointment_reminder_cron_runs') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
      VALUES ('skipped', 'Runtime service role key is empty.', v_result);
    END IF;
    RETURN v_result;
  END IF;

  v_target_url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/appointment-reminders';

  v_request_id := net.http_post(
    url := v_target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  );

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'queued',
    'request_id', v_request_id,
    'target_url', v_target_url
  );

  IF to_regclass('public.appointment_reminder_cron_runs') IS NOT NULL THEN
    INSERT INTO public.appointment_reminder_cron_runs (outcome, request_id, message, details)
    VALUES ('queued', v_request_id, 'appointment-reminders HTTP call queued.', v_result);
  END IF;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'ok', false,
      'reason', 'exception',
      'error', SQLERRM
    );

    IF to_regclass('public.appointment_reminder_cron_runs') IS NOT NULL THEN
      INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
      VALUES ('error', SQLERRM, v_result);
    END IF;

    RETURN v_result;
END;
$$;
