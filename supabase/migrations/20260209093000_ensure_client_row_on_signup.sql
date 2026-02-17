-- Ensure client row is created for every new signup to avoid onboarding races.
-- Also backfill missing client rows for existing users with the client role.
--
-- NOTE: The fallback company name 'New Client' is intentionally hardcoded here.
-- To make this configurable, create a public.app_settings table and reference it here.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  company_name TEXT;
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

  -- Always create a client row for deterministic onboarding
  -- Fallback order: company_name meta -> full_name meta -> 'New Client'
  INSERT INTO public.clients (user_id, company_name)
  VALUES (
    NEW.id,
    COALESCE(
      company_name,
      NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      'New Client' -- Fallback when no company name is provided
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$;

-- Backfill missing client rows for existing users with client role
INSERT INTO public.clients (user_id, company_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data ->> 'company_name'), ''),
    NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    p.full_name,
    'New Client' -- Fallback when no company name is provided
  ) AS company_name
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'client'
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.clients c ON c.user_id = u.id
WHERE c.id IS NULL;
