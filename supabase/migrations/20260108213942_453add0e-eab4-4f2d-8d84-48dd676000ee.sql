-- Fix Issue 1: Remove overly permissive notification INSERT policy
-- Edge Functions use service_role which bypasses RLS, so this policy is not needed
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Fix Issue 2: Update handle_new_user trigger to assign role and create client server-side
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'phone');
  
  -- Assign default client role (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  -- Create client record if company_name provided
  IF NEW.raw_user_meta_data ->> 'company_name' IS NOT NULL THEN
    INSERT INTO public.clients (user_id, company_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'company_name');
  END IF;
  
  RETURN NEW;
END;
$$;