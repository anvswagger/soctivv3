-- Migration to set database-level configuration for the Supabase project
-- This is required for pg_cron/pg_net to call Edge Functions correctly

-- Replace 'YOUR_SUPABASE_URL' if it's different from the one below (extracted from .env)
-- Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service_role key from Project Settings > API
ALTER DATABASE postgres SET "app.settings.supabase_url" TO 'https://yplbixiwtxhaeohombcf.supabase.co';
ALTER DATABASE postgres SET "app.settings.service_role_key" TO 'YOUR_SERVICE_ROLE_KEY';

-- Note: After applying this, the database settings are updated for new sessions.
-- The cron job will pick these up on its next execution.
