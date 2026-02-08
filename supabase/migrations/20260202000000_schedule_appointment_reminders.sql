-- Schedule the appointment-reminders function to run every hour.
-- This migration is intentionally idempotent and resilient:
-- - Unschedules any existing job with the same name.
-- - Skips gracefully if pg_cron/pg_net are unavailable.
DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'cron schema is missing; skipping appointment-reminders schedule.';
    RETURN;
  END IF;

  IF to_regnamespace('net') IS NULL THEN
    RAISE NOTICE 'net schema is missing; skipping appointment-reminders schedule.';
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
      SELECT
        net.http_post(
          url := (SELECT value FROM (SELECT current_setting('app.settings.supabase_url', true) AS value) s) || '/functions/v1/appointment-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM (SELECT current_setting('app.settings.service_role_key', true) AS value) s)
          ),
          body := '{}'
        )
      $job$
    )
  $schedule$;
END;
$$;
