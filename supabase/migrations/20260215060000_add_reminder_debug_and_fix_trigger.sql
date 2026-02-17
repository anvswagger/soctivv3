-- Migration to add debugging and fix the appointment reminder trigger
-- This addresses multiple potential issues with the reminder system

-- 1. Create a debug log table to track trigger invocations
CREATE TABLE IF NOT EXISTS public.appointment_reminder_trigger_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    appointment_id UUID NOT NULL,
    trigger_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('trigger_fired', 'net_unavailable', 'http_call_failed', 'http_call_success', 'error')),
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT
);

-- Enable RLS but allow service role full access
ALTER TABLE public.appointment_reminder_trigger_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage reminder trigger log" ON public.appointment_reminder_trigger_log;
CREATE POLICY "Service role can manage reminder trigger log" ON public.appointment_reminder_trigger_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Update the trigger function with better logging and error handling
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
    INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details, error_message)
    VALUES (
      NEW.id,
      'on_insert',
      'error',
      jsonb_build_object(
        'scheduled_at', NEW.scheduled_at,
        'status', NEW.status,
        'has_supabase_url', coalesce(v_supabase_url, '') <> '',
        'has_auth_key', coalesce(v_auth_key, '') <> ''
      ),
      'Missing runtime settings for reminder trigger'
    );
    RETURN NEW;
  END IF;

  v_target_url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/appointment-reminders';

  -- Check if pg_net is available
  v_net_available := to_regnamespace('net') IS NOT NULL;
  
  -- Log trigger execution
  RAISE NOTICE 'Appointment reminder trigger fired for appointment ID: % (pg_net available: %)', NEW.id, v_net_available;
  
  -- Also log to debug table
  INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
  VALUES (
    NEW.id,
    'on_insert',
    CASE WHEN v_net_available THEN 'trigger_fired' ELSE 'net_unavailable' END,
    jsonb_build_object(
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status,
      'net_available', v_net_available,
      'target_url', v_target_url
    )
  );
  
  IF NOT v_net_available THEN
    RAISE WARNING 'pg_net extension not available. Skipping appointment reminder check.';
    RETURN NEW;
  END IF;

  -- Call the Edge Function with the appointment ID
  BEGIN
    PERFORM
      net.http_post(
        url := v_target_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_auth_key
        ),
        body := jsonb_build_object('appointment_id', NEW.id)
      );
    
    -- Log success
    INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
    VALUES (NEW.id, 'on_insert', 'http_call_success', jsonb_build_object('target_url', v_target_url));
    
    RAISE NOTICE 'Successfully triggered appointment-reminders edge function for appointment: %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
      VALUES (NEW.id, 'on_insert', 'http_call_failed', SQLERRM, jsonb_build_object('error_detail', SQLERRM));
      
      RAISE WARNING 'Error triggering appointment reminder check: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_check_reminder_on_insert ON public.appointments;

CREATE TRIGGER trigger_check_reminder_on_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_reminder_check();

-- 4. Grant execute permission to authenticated users for the log table
GRANT SELECT ON public.appointment_reminder_trigger_log TO authenticated;

-- 5. Add a helper function to manually trigger reminders for testing
CREATE OR REPLACE FUNCTION public.debug_trigger_reminder_for_appointment(p_appointment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_auth_key TEXT;
  v_target_url TEXT;
  v_result JSONB;
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
    v_result := jsonb_build_object(
      'ok', false,
      'error', 'Missing runtime settings'
    );
    INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
    VALUES (p_appointment_id, 'manual', 'error', 'Missing runtime settings for reminder trigger', v_result);
    RETURN v_result;
  END IF;

  v_target_url := trim(trailing '/' FROM v_supabase_url) || '/functions/v1/appointment-reminders';
  v_net_available := to_regnamespace('net') IS NOT NULL;

  IF NOT v_net_available THEN
    v_result := jsonb_build_object(
      'ok', false,
      'error', 'pg_net extension is unavailable'
    );
    INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
    VALUES (p_appointment_id, 'manual', 'net_unavailable', 'pg_net extension not available', v_result);
    RETURN v_result;
  END IF;

  -- Log manual trigger
  INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
  VALUES (p_appointment_id, 'manual', 'trigger_fired', jsonb_build_object('source', 'manual_invocation'));

  PERFORM
    net.http_post(
      url := v_target_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_auth_key
      ),
      body := jsonb_build_object('appointment_id', p_appointment_id)
    );

  v_result := jsonb_build_object(
    'ok', true,
    'message', 'Reminder triggered for appointment',
    'appointment_id', p_appointment_id
  );
  
  -- Log success
  INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, details)
  VALUES (p_appointment_id, 'manual', 'http_call_success', v_result);

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'ok', false,
      'error', SQLERRM
    );
    
    -- Log failure
    INSERT INTO public.appointment_reminder_trigger_log (appointment_id, trigger_type, status, error_message, details)
    VALUES (p_appointment_id, 'manual', 'http_call_failed', SQLERRM, v_result);

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_trigger_reminder_for_appointment(UUID) TO service_role;
