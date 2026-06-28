-- ============================================
-- Fix product_dna RLS admin policy: swap has_role() argument order
-- ============================================
-- The original migration 20260528141900_create_product_dna_table.sql
-- defined the admin policy as:
--   USING (
--       public.has_role('admin', auth.uid())
--       OR public.has_role('super_admin', auth.uid())
--   )
--
-- But public.has_role has the signature has_role(_user_id UUID, _role app_role).
-- Passing the role string first forces PostgreSQL to cast 'admin' / 'super_admin'
-- to UUID, which fails at execution with:
--   invalid input syntax for type uuid: "admin"
-- A failed RLS USING clause is treated as deny, so admins and super admins
-- cannot SELECT from product_dna, and the editor's `.single()` query returns
-- 0 rows → "تعذّر تحميل Product DNA".
--
-- This migration drops and recreates the policy with the correct argument
-- order so super admins can actually read the table.
-- ============================================

DROP POLICY IF EXISTS "Admins can view all product_dna" ON public.product_dna;

CREATE POLICY "Admins can view all product_dna"
    ON public.product_dna
    FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

-- Reload PostgREST schema cache so the policy change is visible immediately.
NOTIFY pgrst, 'reload schema';
