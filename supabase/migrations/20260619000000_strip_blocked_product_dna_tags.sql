-- ============================================
-- Strip blocked product tags from existing product_dna rows
-- ============================================
-- Mirror of BLOCKED_PRODUCT_TAGS in src/services/productDnaService.ts:
--   شريط لاصق, مانع تسريب, صيانة منزلية
-- Any DNA row that still carries one of these tags in core_facts->tags gets
-- it removed (trimmed + lowercased for comparison so variants are caught too).
-- Idempotent: re-running is a no-op once the tags are gone.

DO $$
DECLARE
    blocked text[] := ARRAY['شريط لاصق', 'مانع تسريب', 'صيانة منزلية'];
    affected_rows integer := 0;
BEGIN
    WITH cleaned AS (
        SELECT
            id,
            (
                SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                FROM jsonb_array_elements_text(
                    COALESCE(core_facts->'tags', '[]'::jsonb)
                ) AS elem
                WHERE NOT (lower(btrim(elem)) = ANY (blocked))
            ) AS new_tags
        FROM public.product_dna
        WHERE jsonb_typeof(core_facts->'tags') = 'array'
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(core_facts->'tags') AS elem
              WHERE lower(btrim(elem)) = ANY (blocked)
          )
    )
    UPDATE public.product_dna AS d
    SET core_facts = jsonb_set(d.core_facts, '{tags}', c.new_tags, true),
        -- Bump version so caches that key off `version` know to refresh.
        version = CASE
            WHEN d.version LIKE '%.%' THEN d.version
            ELSE '2.0'
        END
    FROM cleaned AS c
    WHERE d.id = c.id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Stripped blocked tags from % product_dna row(s)', affected_rows;
END $$;
