-- Remove the permissive INSERT policy that allows any authenticated user to insert
-- Cache inserts are now handled server-side by the transliterate-name edge function using service role
DROP POLICY IF EXISTS "Authenticated can insert translations" ON public.name_translations;

-- Replace with a deny-all INSERT policy for regular users (service role bypasses RLS)
CREATE POLICY "Deny client insert on translations"
  ON public.name_translations
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
