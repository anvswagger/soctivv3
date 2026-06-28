-- ============================================
-- Restore correct columns on public.product_dna
-- ============================================
-- The original migration 20260528141900_create_product_dna_table.sql
-- defines these columns:
--   core_facts, icp_profile, marketing_synthesis, raw_input, version, generated_at
--
-- But the live table was recreated (or otherwise modified) with a different
-- schema that exposes columns from the marketing tables (headline, usp, icp,
-- testimonials, tone_of_voice, brand_colors, faqs, target_audience, ...).
-- The application code that calls save() in ProductDnaReview and
-- useProductDna.upsert writes to core_facts / icp_profile / marketing_synthesis
-- / raw_input / version / generated_at — which now do not exist.
--
-- The table is currently empty (verified via SELECT count(*)), so adding the
-- expected columns back with the same types and defaults as the original
-- migration is safe and will let save() succeed.
--
-- Existing "marketing" columns are left in place to avoid surprising
-- other code paths that might be reading them; they can be removed in a
-- follow-up once confirmed unused.
-- ============================================

ALTER TABLE public.product_dna
    ADD COLUMN IF NOT EXISTS core_facts          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS icp_profile         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS marketing_synthesis JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS raw_input           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS version             TEXT         NOT NULL DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS generated_at        TIMESTAMPTZ  NOT NULL DEFAULT now();

-- Reload PostgREST schema cache so the new columns are immediately visible
-- to the REST API. Without this, the next save() call would still trip
-- the "column not found in schema cache" error.
NOTIFY pgrst, 'reload schema';
