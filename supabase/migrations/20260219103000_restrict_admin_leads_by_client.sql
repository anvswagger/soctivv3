-- Restrict admin lead access by assigned clients while preserving full super admin access.

CREATE OR REPLACE FUNCTION public.admin_has_client_access(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = 'super_admin'
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role = 'admin'
      )
      AND EXISTS (
        SELECT 1
        FROM public.admin_clients ac
        WHERE ac.user_id = _user_id
          AND ac.client_id = _client_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.admin_has_client_access(UUID, UUID) TO authenticated;

-- Allow admins to read their own assignments (super admins already have full table visibility).
DROP POLICY IF EXISTS "Admins can view own admin_clients" ON public.admin_clients;
CREATE POLICY "Admins can view own admin_clients"
ON public.admin_clients
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND (SELECT public.has_role(auth.uid(), 'admin'))
);

-- Replace broad admin lead policies with assigned-client-scoped policies.
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;

DROP POLICY IF EXISTS "Super admins can manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can insert assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete assigned leads" ON public.leads;

CREATE POLICY "Super admins can manage all leads"
ON public.leads
FOR ALL
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')))
WITH CHECK ((SELECT public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins can view assigned leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'))
  AND (SELECT public.admin_has_client_access(auth.uid(), client_id))
);

CREATE POLICY "Admins can insert assigned leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'))
  AND (SELECT public.admin_has_client_access(auth.uid(), client_id))
);

CREATE POLICY "Admins can update assigned leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'))
  AND (SELECT public.admin_has_client_access(auth.uid(), client_id))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'))
  AND (SELECT public.admin_has_client_access(auth.uid(), client_id))
);

CREATE POLICY "Admins can delete assigned leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'))
  AND (SELECT public.admin_has_client_access(auth.uid(), client_id))
);

