-- ============================================
-- Ads table — AI-generated ad scripts
-- Super-admin only in v1.
-- ============================================

-- Reusable updated_at trigger function. Idempotent.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ads'
  ) THEN
    CREATE TABLE public.ads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        client_id  UUID NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
        angle_name TEXT NOT NULL,
        topic      TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 10 AND 120),
        hooks      JSONB NOT NULL DEFAULT '[]'::jsonb,
        copy       TEXT NOT NULL,
        headline   TEXT NOT NULL,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_ads_set_updated_at ON public.ads;
CREATE TRIGGER trg_ads_set_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS Policies (super_admin only)
-- ============================================

DROP POLICY IF EXISTS "Super admins can view all ads" ON public.ads;
CREATE POLICY "Super admins can view all ads"
    ON public.ads
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can insert ads" ON public.ads;
CREATE POLICY "Super admins can insert ads"
    ON public.ads
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can update ads" ON public.ads;
CREATE POLICY "Super admins can update ads"
    ON public.ads
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can delete ads" ON public.ads;
CREATE POLICY "Super admins can delete ads"
    ON public.ads
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ads_product_id    ON public.ads(product_id);
CREATE INDEX IF NOT EXISTS idx_ads_client_id     ON public.ads(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_product_angle ON public.ads(product_id, angle_name);
CREATE INDEX IF NOT EXISTS idx_ads_created_at    ON public.ads(created_at DESC);

COMMENT ON TABLE  public.ads       IS 'AI-generated ad scripts. Super-admin only.';
COMMENT ON COLUMN public.ads.hooks  IS 'Exactly 5 hook strings (jsonb array).';
COMMENT ON COLUMN public.ads.copy   IS 'Multi-line teleprompter-ready body.';
COMMENT ON COLUMN public.ads.topic  IS 'AI-picked unique topic per (product, angle).';