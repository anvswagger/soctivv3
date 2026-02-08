-- Harden appointment reminders cron with:
-- 1) explicit runtime health logs
-- 2) idempotent (re)scheduling
-- 3) guard rails for missing DB runtime settings

CREATE TABLE IF NOT EXISTS public.appointment_reminder_cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL CHECK (outcome IN ('queued', 'skipped', 'error')),
  request_id BIGINT NULL,
  message TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminder_cron_runs_run_at
  ON public.appointment_reminder_cron_runs (run_at DESC);

ALTER TABLE public.appointment_reminder_cron_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view appointment reminder cron runs" ON public.appointment_reminder_cron_runs;
CREATE POLICY "Super admins can view appointment reminder cron runs"
ON public.appointment_reminder_cron_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.run_appointment_reminders_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
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

  IF coalesce(v_supabase_url, '') = '' THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'missing_supabase_url_setting');

    INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
    VALUES ('skipped', 'app.settings.supabase_url is empty.', v_result);

    RETURN v_result;
  END IF;

  IF coalesce(v_service_role_key, '') = '' THEN
    v_result := jsonb_build_object('ok', false, 'reason', 'missing_service_role_key_setting');

    INSERT INTO public.appointment_reminder_cron_runs (outcome, message, details)
    VALUES ('skipped', 'app.settings.service_role_key is empty.', v_result);

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

-- Recreate the job in an idempotent way to ensure current definition is active.
DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'cron schema is missing; skipping appointment-reminders cron scheduling.';
    RETURN;
  END IF;

  FOR existing_job_id IN
    EXECUTE $sql$
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'appointment-reminders-cron'
    $sql$
  LOOP
    EXECUTE format('SELECT cron.unschedule(%s)', existing_job_id);
  END LOOP;

  EXECUTE $schedule$
    SELECT cron.schedule(
      'appointment-reminders-cron',
      '0 * * * *',
      $job$
      SELECT public.run_appointment_reminders_cron();
      $job$
    )
  $schedule$;
END;
$$;
