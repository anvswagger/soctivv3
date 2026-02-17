-- Create a trigger function to call the appointment-reminders Edge Function
CREATE OR REPLACE FUNCTION public.trigger_appointment_reminder_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
  v_target_url TEXT;
  v_request_id BIGINT;
BEGIN
  -- Validate settings
  IF coalesce(v_supabase_url, '') = '' OR coalesce(v_service_role_key, '') = '' THEN
    RAISE WARNING 'Missing app.settings.supabase_url or app.settings.service_role_key. Skipping reminder check.';
    RETURN NEW;
  END IF;

  -- Check if pg_net is available
  IF to_regnamespace('net') IS NULL THEN
    RAISE WARNING 'pg_net extension not available. Skipping reminder check.';
    RETURN NEW;
  END IF;

  v_target_url := v_supabase_url || '/functions/v1/appointment-reminders';

  -- Call the Edge Function with the appointment ID
  -- We don't wait for the result (fire and forget)
  PERFORM
    net.http_post(
      url := v_target_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('appointment_id', NEW.id)
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Prevent trigger failure from rolling back the appointment insert
    RAISE WARNING 'Error triggering appointment reminder check: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger on appointments table
DROP TRIGGER IF EXISTS trigger_check_reminder_on_insert ON public.appointments;

CREATE TRIGGER trigger_check_reminder_on_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_reminder_check();
