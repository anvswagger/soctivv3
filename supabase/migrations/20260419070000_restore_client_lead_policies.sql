-- Restore client access to their own leads and orders
-- These policies were accidentally removed in the admin restriction migration

-- First, make sure we have the get_user_client_id helper function
CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clients WHERE user_id = _user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_client_id(UUID) TO authenticated;

-- Drop any existing client lead policies to avoid conflicts
DROP POLICY IF EXISTS "Clients can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Clients can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Clients can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Clients can delete own leads" ON public.leads;

-- Create full access policies for clients to their own leads
CREATE POLICY "Clients can view own leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can insert own leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can update own leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
)
WITH CHECK (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can delete own leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
);

-- Also add client policies for orders (confirmed orders)
DROP POLICY IF EXISTS "Clients can view own orders" ON public.confirmed_orders;
DROP POLICY IF EXISTS "Clients can insert own orders" ON public.confirmed_orders;
DROP POLICY IF EXISTS "Clients can update own orders" ON public.confirmed_orders;
DROP POLICY IF EXISTS "Clients can delete own orders" ON public.confirmed_orders;

CREATE POLICY "Clients can view own orders"
ON public.confirmed_orders
FOR SELECT
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can insert own orders"
ON public.confirmed_orders
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can update own orders"
ON public.confirmed_orders
FOR UPDATE
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
)
WITH CHECK (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can delete own orders"
ON public.confirmed_orders
FOR DELETE
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
);

-- Add client policy for products
DROP POLICY IF EXISTS "Clients can view own products" ON public.products;
DROP POLICY IF EXISTS "Clients can insert own products" ON public.products;
DROP POLICY IF EXISTS "Clients can update own products" ON public.products;
DROP POLICY IF EXISTS "Clients can delete own products" ON public.products;

CREATE POLICY "Clients can view own products"
ON public.products
FOR SELECT
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can insert own products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can update own products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
)
WITH CHECK (
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can delete own products"
ON public.products
FOR DELETE
TO authenticated
USING (
  client_id = public.get_user_client_id(auth.uid())
);

-- Add client policy for sms logs
DROP POLICY IF EXISTS "Clients can view their leads sms logs" ON public.sms_logs;

CREATE POLICY "Clients can view their leads sms logs"
ON public.sms_logs
FOR SELECT
TO authenticated
USING (
  lead_id IN (SELECT id FROM public.leads WHERE client_id = public.get_user_client_id(auth.uid()))
);