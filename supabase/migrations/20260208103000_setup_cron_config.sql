-- Migration to set database-level configuration for the Supabase project
-- This is required for pg_cron/pg_net to call Edge Functions correctly

-- supabase_url can be safely set from project ref.
ALTER DATABASE postgres SET "app.settings.supabase_url" TO 'https://yplbixiwtxhaeohombcf.supabase.co';

-- Do not write placeholder secrets into database config.
-- Set app.settings.service_role_key separately using:
--   supabase postgres-config update --project-ref <ref> --config app.settings.service_role_key=<SERVICE_ROLE_KEY>
DO $$
BEGIN
  IF coalesce(current_setting('app.settings.service_role_key', true), '') = '' THEN
    RAISE NOTICE 'app.settings.service_role_key is empty. Set it via supabase postgres-config update.';
  END IF;
END;
$$;
