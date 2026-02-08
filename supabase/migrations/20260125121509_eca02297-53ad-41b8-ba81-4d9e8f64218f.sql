-- Enable pg_net/pg_cron in a resilient way.
-- Some environments may already have them installed or may reject "WITH SCHEMA" for pg_cron.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not create pg_net extension: %', SQLERRM;
  END;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not create pg_cron extension: %', SQLERRM;
  END;

  IF to_regnamespace('cron') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA cron TO postgres';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres';
  ELSE
    RAISE NOTICE 'cron schema is unavailable; skipping cron grants.';
  END IF;
END;
$$;
