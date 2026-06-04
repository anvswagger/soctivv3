-- ============================================
-- Landing Pages Table, RLS Policies, and Indexes
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'landing_pages'
      AND column_name = 'client_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'landing_pages'
    ) THEN
      RAISE EXCEPTION 'Existing landing_pages table is missing expected column client_id. Manual migration required.';
    END IF;

    CREATE TABLE public.landing_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
        product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
        product_dna_id UUID REFERENCES public.product_dna(id) ON DELETE SET NULL,
        subdomain TEXT UNIQUE,
        custom_domain TEXT UNIQUE,
        title TEXT NOT NULL DEFAULT 'My Landing Page',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        template_id TEXT NOT NULL DEFAULT 'default',
        theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
        content_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        tracking_pixel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Enable RLS on the landing_pages table
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Public can view published landing pages" ON public.landing_pages;
CREATE POLICY "Public can view published landing pages"
    ON public.landing_pages
    FOR SELECT
    TO public
    USING (
        status = 'published'
    );

DROP POLICY IF EXISTS "Clients can view own landing pages" ON public.landing_pages;
CREATE POLICY "Clients can view own landing pages"
    ON public.landing_pages
    FOR SELECT
    TO authenticated
    USING (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Clients can insert own landing pages" ON public.landing_pages;
CREATE POLICY "Clients can insert own landing pages"
    ON public.landing_pages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Clients can update own landing pages" ON public.landing_pages;
CREATE POLICY "Clients can update own landing pages"
    ON public.landing_pages
    FOR UPDATE
    TO authenticated
    USING (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Clients can delete own landing pages" ON public.landing_pages;
CREATE POLICY "Clients can delete own landing pages"
    ON public.landing_pages
    FOR DELETE
    TO authenticated
    USING (
        client_id = public.get_user_client_id(auth.uid())
    );

DROP POLICY IF EXISTS "Admins can view all landing pages" ON public.landing_pages;
CREATE POLICY "Admins can view all landing pages"
    ON public.landing_pages
    FOR SELECT
    TO authenticated
    USING (
        public.has_role('admin', auth.uid())
        OR public.has_role('super_admin', auth.uid())
    );

-- ============================================
-- Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_landing_pages_client_id
    ON public.landing_pages(client_id);

CREATE INDEX IF NOT EXISTS idx_landing_pages_subdomain
    ON public.landing_pages(subdomain);

CREATE INDEX IF NOT EXISTS idx_landing_pages_custom_domain
    ON public.landing_pages(custom_domain);

-- ============================================
-- Triggers
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'landing_pages'
      AND column_name = 'updated_at'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_landing_pages_updated_at') THEN
      CREATE OR REPLACE FUNCTION public.handle_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trigger_update_landing_pages_updated_at
      BEFORE UPDATE ON public.landing_pages
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
    END IF;
  END IF;
END $$;

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON TABLE public.landing_pages IS 'Stores AI-generated landing pages associated with products and clients.';
