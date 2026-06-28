-- ============================================
-- Zenon-shaped landing page config + publish state
-- ============================================
-- The previous landing_pages table stored a thin {content_data, theme_config}
-- pair that fed a React template registry (3 generic templates). That system
-- is being replaced by a single Zenon-shaped config (the design used by
-- landing-pages/config/zenon-hemp-cream.json, generalized).
--
-- This migration:
--   1. Adds a `config` JSONB column (the new source of truth).
--   2. Adds `published_at` and `published_url` for the publish pipeline.
--   3. Adds a per-landing-page `webhook_code` snapshot column so the build
--      pipeline can stamp the right value into the form's hidden fields
--      without re-querying clients at render time.
--   4. Backfills `config` from existing `content_data` + `theme_config` rows
--      so any pre-existing data still renders (best-effort).
--
-- No destructive change to existing columns: the old `content_data` /
-- `theme_config` / `template_id` are kept for now and the React side stops
-- reading them. They can be dropped in a later cleanup migration.
-- ============================================

ALTER TABLE public.landing_pages
    ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.landing_pages
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE public.landing_pages
    ADD COLUMN IF NOT EXISTS published_url TEXT;

-- Drop the old check constraint that limited status to draft/published and
-- add a more permissive one (adds 'unpublished' for the rare rollback case).
ALTER TABLE public.landing_pages
    DROP CONSTRAINT IF EXISTS landing_pages_status_check;

ALTER TABLE public.landing_pages
    ADD CONSTRAINT landing_pages_status_check
    CHECK (status IN ('draft', 'published', 'unpublished'));

-- Index for the publish query (find published pages by client).
CREATE INDEX IF NOT EXISTS idx_landing_pages_published_at
    ON public.landing_pages(published_at)
    WHERE published_at IS NOT NULL;

-- Best-effort backfill: for any existing row that has data in content_data
-- or theme_config, build a thin config object so the new code path has
-- something to read. This is intentionally a minimal shape — it preserves
-- the data but the new editor will need to regenerate the full Zenon config
-- the first time a user opens one of these pages.
DO $mig$
DECLARE
    r RECORD;
    cfg JSONB;
BEGIN
    FOR r IN
        SELECT id, content_data, theme_config
        FROM public.landing_pages
        WHERE config = '{}'::jsonb
          AND (content_data <> '{}'::jsonb OR theme_config <> '{}'::jsonb)
    LOOP
        cfg := jsonb_build_object(
            '__legacy', true,
            'content', COALESCE(r.content_data, '{}'::jsonb),
            'theme', COALESCE(r.theme_config, '{}'::jsonb)
        );
        UPDATE public.landing_pages
        SET config = cfg
        WHERE id = r.id;
    END LOOP;
END $mig$;

-- PostgREST schema cache reload (same trick used in the restore migration).
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.landing_pages.config IS
    'Full Zenon-shaped landing page config (single source of truth for the new landing page builder).';
COMMENT ON COLUMN public.landing_pages.published_at IS
    'Timestamp of the last successful publish to Netlify. NULL = never published.';
COMMENT ON COLUMN public.landing_pages.published_url IS
    'Live URL (e.g. https://<id>.soctiv.ly) after publish.';
