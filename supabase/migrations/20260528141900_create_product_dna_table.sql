-- ============================================
-- Product DNA Table, RLS Policies, and Indexes
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'product_dna'
  ) THEN
    CREATE TABLE public.product_dna (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
        product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
        core_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
        icp_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        marketing_synthesis JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_input JSONB NOT NULL DEFAULT '{}'::jsonb,
        version TEXT NOT NULL DEFAULT '1.0',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Enable RLS on the product_dna table
ALTER TABLE public.product_dna ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Clients can view own product_dna" ON public.product_dna;
CREATE POLICY "Clients can view own product_dna"
    ON public.product_dna
    FOR SELECT
    TO authenticated
    USING (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Clients can insert own product_dna" ON public.product_dna;
CREATE POLICY "Clients can insert own product_dna"
    ON public.product_dna
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Clients can update own product_dna" ON public.product_dna;
CREATE POLICY "Clients can update own product_dna"
    ON public.product_dna
    FOR UPDATE
    TO authenticated
    USING (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Clients can delete own product_dna" ON public.product_dna;
CREATE POLICY "Clients can delete own product_dna"
    ON public.product_dna
    FOR DELETE
    TO authenticated
    USING (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Admins can view all product_dna" ON public.product_dna;
CREATE POLICY "Admins can view all product_dna"
    ON public.product_dna
    FOR SELECT
    TO authenticated
    USING (
        public.has_role('admin', auth.uid())
        OR public.has_role('super_admin', auth.uid())
    );

-- ============================================
-- Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_product_dna_client_id
    ON public.product_dna(client_id);

CREATE INDEX IF NOT EXISTS idx_product_dna_product_id
    ON public.product_dna(product_id);

CREATE INDEX IF NOT EXISTS idx_product_dna_generated_at
    ON public.product_dna(generated_at DESC);

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON TABLE public.product_dna IS 'Stores AI-generated Product DNA analyses for client products.';
