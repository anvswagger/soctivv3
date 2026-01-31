
-- Fix: The "Deny anonymous access" policies are too restrictive
-- They use USING (false) which blocks ALL access including authenticated users
-- We need to change them to only block anonymous users

-- Drop the problematic policies
DROP POLICY IF EXISTS "Deny anonymous access to leads" ON public.leads;
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access to appointments" ON public.appointments;

-- Recreate them correctly - only deny anonymous users, not all users
-- For leads - anonymous users should not have access
CREATE POLICY "Deny anonymous access to leads"
ON public.leads
FOR ALL
TO anon
USING (false);

-- For profiles - anonymous users should not have access  
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- For appointments - anonymous users should not have access
CREATE POLICY "Deny anonymous access to appointments"
ON public.appointments
FOR ALL
TO anon
USING (false);
