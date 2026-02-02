-- Schedule the appointment-reminders function to run every hour
-- We use pg_net (net.http_post) to call the edge function
-- The function requires the service role key for authorization

SELECT cron.schedule(
    'appointment-reminders-cron',
    '0 * * * *', -- Every hour at minute 0
    $$
    SELECT
      net.http_post(
        url := (SELECT value FROM (SELECT current_setting('app.settings.supabase_url', true) AS value) s) || '/functions/v1/appointment-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM (SELECT current_setting('app.settings.service_role_key', true) AS value) s)
        ),
        body := '{}'
      )
    $$
);
