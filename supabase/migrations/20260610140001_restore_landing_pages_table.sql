-- ============================================
-- Restore public.landing_pages table
-- ============================================
-- The original migration 20260529140000_create_landing_pages_table.sql was
-- recorded as applied, but the table was dropped by something external
-- afterwards (no later migration references it). This re-creates the table,
-- RLS policies, indexes, and trigger using the same idempotent logic as the
-- original so the app stops erroring with "Could not find the table
-- 'public.landing_pages' in the schema cache".
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'landing_pages'
  ) THEN
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

-- Enable RLS (no-op if already enabled)
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies (DROP IF EXISTS makes these safe to re-run)
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
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
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
-- Trigger (recreate function + trigger if missing)
-- ============================================
-- Use distinct dollar-quote tags to avoid the nested $$-parsing issue that
-- caused the original migration to fail silently. The outer block is tagged
-- $mig$, the inner function body uses $fn$.

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.handle_updated_at()
      RETURNS TRIGGER AS $body$
      BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql;
    $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_landing_pages_updated_at') THEN
    EXECUTE 'CREATE TRIGGER trigger_update_landing_pages_updated_at
      BEFORE UPDATE ON public.landing_pages
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at()';
  END IF;
END $mig$;

-- ============================================
-- PostgREST schema cache reload
-- ============================================
-- The PostgREST schema cache is what surfaces the "table not found in schema
-- cache" error to the client even after the table is created. Notify it to
-- reload by issuing a dummy DDL. This is the same trick Supabase uses
-- internally in its migrate path.
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.landing_pages IS 'Stores AI-generated landing pages associated with products and clients.';
