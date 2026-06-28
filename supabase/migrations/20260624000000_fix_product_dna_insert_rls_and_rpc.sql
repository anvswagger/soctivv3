-- Migration: 20260624000000_fix_product_dna_insert_rls_and_rpc.sql
--
-- Why this exists:
-- The product-onboarding flow does `INSERT INTO products` from the browser.
-- The live database has an AFTER INSERT trigger on `products` (added outside
-- this repo, not present in supabase/migrations/) that writes a stub row
-- into `product_dna` for the newly inserted product. The previous
-- `product_dna` INSERT RLS policy was:
--
--   client_id = public.get_user_client_id(auth.uid())
--
-- That fails inside the trigger context (the trigger may run as
-- SECURITY DEFINER, or auth.uid() may otherwise be unavailable), so the
-- whole products insert rolls back with:
--
--   42501: new row violates row-level security policy for table "product_dna"
--
-- This migration does two things:
--
--   1. Relaxes the product_dna INSERT policy so a row is also accepted
--      when its `product_id` references a product owned by the same
--      `client_id`. The trigger writes `(client_id=NEW.client_id,
--      product_id=NEW.id)`, and the new product obviously belongs to the
--      same client, so the EXISTS check passes.
--
--   2. Adds a SECURITY DEFINER RPC `create_product_with_dna` that
--      atomically creates a product and its `product_dna` row in a
--      single transaction. This is a more robust path that does not
--      depend on the trigger's RLS behaviour, and centralises the
--      ownership check in one place.

-- ─── 1. Relax product_dna INSERT policy ────────────────────────────────

DROP POLICY IF EXISTS "Clients can insert own product_dna" ON public.product_dna;

CREATE POLICY "Clients can insert own product_dna"
    ON public.product_dna
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- (a) Direct client insert: client_id matches the caller's own client.
        client_id = public.get_user_client_id(auth.uid())
        -- (b) Trigger context: the product_id references a product that
        --     belongs to the same client_id. This is what the live
        --     AFTER INSERT trigger on `products` does.
        OR (
            product_id IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM public.products p
                WHERE p.id = product_dna.product_id
                  AND p.client_id = product_dna.client_id
            )
        )
    );

-- ─── 2. SECURITY DEFINER RPC: create_product_with_dna ──────────────────

CREATE OR REPLACE FUNCTION public.create_product_with_dna(
    p_name         TEXT,
    p_description  TEXT,
    p_price        NUMERIC,
    p_return_rate  NUMERIC,
    p_offer        TEXT,
    p_image_url    TEXT,
    p_client_id    UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    UUID;
    v_product_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Ownership check: the caller must be the user that owns this client.
    IF NOT EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id = p_client_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Not authorized for this client';
    END IF;

    -- Insert the product. The code trigger will fire here and stamp a
    -- product code; the AFTER INSERT trigger (if present) will attempt
    -- to write a product_dna row, which the relaxed policy above allows.
    INSERT INTO public.products (
        name,
        description,
        price,
        return_rate,
        offer,
        image_url,
        client_id,
        is_active
    )
    VALUES (
        p_name,
        p_description,
        p_price,
        p_return_rate,
        p_offer,
        p_image_url,
        p_client_id,
        TRUE
    )
    RETURNING id INTO v_product_id;

    -- Defensively ensure a product_dna row exists. If the live trigger
    -- already created one, ON CONFLICT (product_id) keeps things idempotent.
    -- Note: product_dna has no unique constraint on product_id by default
    -- (it allows multiple DNA versions per product), so we use a NOT EXISTS
    -- guard instead.
    IF NOT EXISTS (
        SELECT 1 FROM public.product_dna
        WHERE product_id = v_product_id
    ) THEN
        INSERT INTO public.product_dna (
            client_id,
            product_id,
            core_facts,
            icp_profile,
            marketing_synthesis,
            raw_input
        )
        VALUES (
            p_client_id,
            v_product_id,
            '{}'::jsonb,
            '{}'::jsonb,
            '{}'::jsonb,
            '{}'::jsonb
        );
    END IF;

    RETURN v_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_product_with_dna(
    TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID
) TO authenticated;

COMMENT ON FUNCTION public.create_product_with_dna(
    TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID
) IS
    'Atomically create a product and ensure a product_dna row exists. '
    'SECURITY DEFINER bypasses product_dna RLS. The caller must own the client_id.';
