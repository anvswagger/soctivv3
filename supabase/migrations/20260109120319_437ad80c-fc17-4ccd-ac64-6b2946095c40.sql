-- Fix get_user_client_id to add auth.uid() validation
-- This prevents the function from being misused with arbitrary UUIDs

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify the requesting user matches the parameter
  -- This prevents misuse of the function with arbitrary UUIDs
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RETURN NULL;
  END IF;
  
  RETURN (SELECT id FROM public.clients WHERE user_id = _user_id LIMIT 1);
END;
$$;

-- Add comment documenting security restrictions
COMMENT ON FUNCTION public.get_user_client_id(_user_id uuid) IS 
'Returns the client_id for a given user_id. SECURITY: Only returns data when auth.uid() matches _user_id parameter to prevent unauthorized access. This function should only be used in RLS policies.';