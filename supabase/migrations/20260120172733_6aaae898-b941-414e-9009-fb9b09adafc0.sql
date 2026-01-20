-- Add policy to explicitly deny anonymous access to appointments table
CREATE POLICY "Deny anonymous access to appointments" 
ON public.appointments 
FOR ALL 
TO anon 
USING (false);