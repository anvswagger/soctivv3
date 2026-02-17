-- Migration to fix the appointment reminder trigger
-- Uses runtime settings instead of hardcoded project URL/keys.

CREATE OR REPLACE FUNCTION public.trigger_appointment_reminder_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_auth_key TEXT;
  v_target_url TEXT;
  v_net_available BOOLEAN;
BEGIN
  BEGIN
    SELECT s.supabase_url, s.service_role_key
    INTO v_supabase_url, v_auth_key
    FROM public.app_runtime_settings s
    WHERE s.id = 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_supabase_url := NULL;
      v_auth_key := NULL;
  END;

  IF coalesce(v_supabase_url, '') = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF coalesce(v_auth_key, '') = '' THEN
    v_auth_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF coalesce(v_supabase_url, '') = '' OR coalesce(v_auth_key, '') = '' THEN
    RAISE WARNING 'Missing runtime settings. Skipping appointment reminder check.';
    RETURN NEW;
  END IF;

  v_target_url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/appointment-reminders';

  -- Check if pg_net is available
  v_net_available := to_regnamespace('net') IS NOT NULL;
  
  -- Log trigger execution for debugging
  RAISE NOTICE 'Appointment reminder trigger fired for appointment ID: % (pg_net available: %)', NEW.id, v_net_available;
  
  IF NOT v_net_available THEN
    RAISE WARNING 'pg_net extension not available. Skipping appointment reminder check.';
    RETURN NEW;
  END IF;

  -- Call the Edge Function with the appointment ID
  -- We don't wait for the result (fire and forget)
  PERFORM
    net.http_post(
      url := v_target_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_auth_key
      ),
      body := jsonb_build_object('appointment_id', NEW.id)
    );

  RAISE NOTICE 'Successfully triggered appointment-reminders edge function for appointment: %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Prevent trigger failure from rolling back the appointment insert
    RAISE WARNING 'Error triggering appointment reminder check: %', SQLERRM;
    RETURN NEW;
END;
$$;
