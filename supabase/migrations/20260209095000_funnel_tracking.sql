-- Funnel tracking for business instrumentation

-- Update handle_new_user to log signup event
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_name TEXT;
  resolved_company_name TEXT;
BEGIN
  company_name := NULLIF(trim(NEW.raw_user_meta_data ->> 'company_name'), '');

  -- Create profile (idempotent)
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'phone')
  ON CONFLICT (id) DO NOTHING;

  -- Assign default client role (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  resolved_company_name := COALESCE(
    company_name,
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    'New Client'
  );

  -- Always create a client row for deterministic onboarding
  INSERT INTO public.clients (user_id, company_name)
  VALUES (NEW.id, resolved_company_name)
  ON CONFLICT (user_id) DO NOTHING;

  -- Log signup funnel event
  INSERT INTO public.analytics_events (user_id, client_id, event_type, event_name, metadata)
  SELECT
    NEW.id,
    c.id,
    'signup',
    'signup',
    jsonb_build_object('company_name', resolved_company_name)
  FROM public.clients c
  WHERE c.user_id = NEW.id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Helper: log onboarding complete and approval events
CREATE OR REPLACE FUNCTION public.track_funnel_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT c.id INTO v_client_id
  FROM public.clients c
  WHERE c.user_id = NEW.id
  LIMIT 1;

  IF NEW.approval_status = 'approved' AND (OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
    INSERT INTO public.analytics_events (user_id, client_id, event_type, event_name, metadata)
    VALUES (NEW.id, v_client_id, 'approved', 'approved', jsonb_build_object('source', 'profile_update'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_profile_funnel ON public.profiles;
CREATE TRIGGER trg_track_profile_funnel
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.track_funnel_profile_updates();

-- Track onboarding completion on clients table
CREATE OR REPLACE FUNCTION public.track_funnel_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed) THEN
    INSERT INTO public.analytics_events (user_id, client_id, event_type, event_name, metadata)
    VALUES (NEW.user_id, NEW.id, 'onboarding_completed', 'onboarding_completed', jsonb_build_object('source', 'client_update'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_client_funnel ON public.clients;
CREATE TRIGGER trg_track_client_funnel
AFTER UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.track_funnel_client_updates();

-- Track first lead per client
CREATE OR REPLACE FUNCTION public.track_first_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  has_event BOOLEAN;
BEGIN
  SELECT c.user_id INTO v_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.analytics_events
    WHERE event_type = 'first_lead'
      AND client_id = NEW.client_id
  ) INTO has_event;

  IF NOT has_event AND v_user_id IS NOT NULL THEN
    INSERT INTO public.analytics_events (user_id, client_id, lead_id, event_type, event_name, metadata)
    VALUES (v_user_id, NEW.client_id, NEW.id, 'first_lead', 'first_lead', jsonb_build_object('source', 'leads_insert'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_first_lead ON public.leads;
CREATE TRIGGER trg_track_first_lead
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_first_lead();

-- Track first appointment per client
CREATE OR REPLACE FUNCTION public.track_first_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  has_event BOOLEAN;
BEGIN
  SELECT c.user_id INTO v_user_id
  FROM public.clients c
  WHERE c.id = NEW.client_id
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.analytics_events
    WHERE event_type = 'first_appointment'
      AND client_id = NEW.client_id
  ) INTO has_event;

  IF NOT has_event AND v_user_id IS NOT NULL THEN
    INSERT INTO public.analytics_events (user_id, client_id, lead_id, event_type, event_name, metadata)
    VALUES (v_user_id, NEW.client_id, NEW.lead_id, 'first_appointment', 'first_appointment', jsonb_build_object('source', 'appointments_insert'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_first_appointment ON public.appointments;
CREATE TRIGGER trg_track_first_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.track_first_appointment();

-- Track first SMS per client (based on sms_logs + lead)
CREATE OR REPLACE FUNCTION public.track_first_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  has_event BOOLEAN;
BEGIN
  SELECT l.client_id INTO v_client_id
  FROM public.leads l
  WHERE l.id = NEW.lead_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.analytics_events
    WHERE event_type = 'first_sms'
      AND client_id = v_client_id
  ) INTO has_event;

  IF NOT has_event THEN
    INSERT INTO public.analytics_events (user_id, client_id, lead_id, event_type, event_name, metadata)
    VALUES (NEW.sent_by, v_client_id, NEW.lead_id, 'first_sms', 'first_sms', jsonb_build_object('source', 'sms_logs_insert'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_first_sms ON public.sms_logs;
CREATE TRIGGER trg_track_first_sms
AFTER INSERT ON public.sms_logs
FOR EACH ROW
EXECUTE FUNCTION public.track_first_sms();
