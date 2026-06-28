CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_supabase_url TEXT := COALESCE(
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    (SELECT supabase_url FROM public.app_runtime_settings WHERE id = 1)
  );
  v_service_role_key TEXT := COALESCE(
    NULLIF(current_setting('app.settings.service_role_key', true), ''),
    (SELECT service_role_key FROM public.app_runtime_settings WHERE id = 1)
  );
BEGIN
  IF v_supabase_url IS NOT NULL AND v_supabase_url <> ''
     AND v_service_role_key IS NOT NULL AND v_service_role_key <> '' THEN
    INSERT INTO public.app_runtime_settings (id, supabase_url, service_role_key, updated_at)
    VALUES (1, v_supabase_url, v_service_role_key, now())
    ON CONFLICT (id) DO UPDATE
      SET supabase_url = EXCLUDED.supabase_url,
          service_role_key = EXCLUDED.service_role_key,
          updated_at = now();
  END IF;
END $$;
