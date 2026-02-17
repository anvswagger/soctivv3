-- Store runtime settings used by pg_net/pg_cron calls.
--
-- Supabase no longer reliably supports custom GUCs like app.settings.* for all environments.
-- Using a locked-down table avoids needing ALTER DATABASE ... SET.

CREATE TABLE IF NOT EXISTS public.app_runtime_settings (
  id INT PRIMARY KEY CHECK (id = 1),
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent accidental exposure. Only the service_role (and table owner) should be able to read/write.
REVOKE ALL ON TABLE public.app_runtime_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.app_runtime_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.app_runtime_settings TO service_role;

-- Helper for SECURITY DEFINER functions to fetch settings.
CREATE OR REPLACE FUNCTION public.get_app_runtime_settings()
RETURNS TABLE (supabase_url TEXT, service_role_key TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.supabase_url, s.service_role_key
  FROM public.app_runtime_settings s
  WHERE s.id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_app_runtime_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_runtime_settings() TO service_role;

-- Update automation dispatcher to use app_runtime_settings instead of current_setting('app.settings.*').
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

  SELECT s.supabase_url, s.service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM public.app_runtime_settings s
  WHERE s.id = 1;

  IF coalesce(v_supabase_url, '') = '' OR coalesce(v_service_role_key, '') = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-push-notification',
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

-- Update cron runner to use app_runtime_settings instead of current_setting('app.settings.*').
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

    INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
    VALUES ('skipped', 'net schema is missing (pg_net not available).', v_result);

    RETURN v_result;
  END IF;

  SELECT s.supabase_url, s.service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM public.app_runtime_settings s
  WHERE s.id = 1;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'missing_supabase_url');

    INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
    VALUES ('skipped', 'app_runtime_settings.supabase_url is empty.', v_result);

    RETURN v_result;
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'missing_service_role_key');

    INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
    VALUES ('skipped', 'app_runtime_settings.service_role_key is empty.', v_result);

    RETURN v_result;
  END IF;

  v_target_url := v_supabase_url || '/functions/v1/appointment-reminders';

  EXECUTE
    'SELECT net.http_post(url := $1, headers := $2, body := $3)'
  INTO v_request_id
  USING
    v_target_url,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    '{}'::jsonb;

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'queued',
    'request_id', v_request_id,
    'target_url', v_target_url
  );

  INSERT INTO public.appointment_reminder_cron_runs (outcome, request_id, message, details)
  VALUES ('queued', v_request_id, 'appointment-reminders HTTP call queued.', v_result);

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'ok', false,
      'reason', 'exception',
      'error', SQLERRM
    );

    INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
    VALUES ('error', SQLERRM, v_result);

    RETURN v_result;
END;
$$;

