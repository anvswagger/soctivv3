-- Migration: 20260624001000_fill_product_dna_client_id_before_insert.sql
--
-- Why this exists:
-- After deploying 20260624000000_fix_product_dna_insert_rls_and_rpc.sql,
-- the original RLS error went away but a new error surfaced:
--
--   23502: null value in column "client_id" of relation "product_dna"
--          violates not-null constraint
--
-- This is a NOT NULL violation (not an RLS one). The AFTER INSERT trigger
-- on `products` (which lives in the live database, added outside this
-- repo) inserts a stub product_dna row but does NOT set its `client_id`.
-- Without our schema-level safety net, the insert fails before RLS is
-- even consulted, and the whole products insert rolls back.
--
-- The fix is a BEFORE INSERT trigger on `product_dna` that fills in
-- `client_id` from the related product when it's NULL. This is purely
-- additive and does not change the NOT NULL constraint: if both
-- `NEW.client_id` and `NEW.product_id` are NULL/missing, the trigger
-- still raises an exception.

CREATE OR REPLACE FUNCTION public.fill_product_dna_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_client_id UUID;
BEGIN
    -- If client_id is already set, do nothing.
    IF NEW.client_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Try to recover it from the referenced product. The live trigger on
    -- `products` always sets `product_id = NEW.id` (it just forgets the
    -- `client_id`), so this lookup succeeds.
    IF NEW.product_id IS NOT NULL THEN
        SELECT client_id
          INTO v_client_id
        FROM public.products
        WHERE id = NEW.product_id;

        IF v_client_id IS NOT NULL THEN
            NEW.client_id := v_client_id;
            RETURN NEW;
        END IF;
    END IF;

    -- Last-resort: if we still don't have a client_id, surface a clear
    -- error instead of letting the NOT NULL constraint blow up with a
    -- less helpful message.
    RAISE EXCEPTION
        'product_dna.client_id is required and could not be inferred from product_id=%',
        NEW.product_id;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_product_dna_client_id ON public.product_dna;
CREATE TRIGGER trg_fill_product_dna_client_id
    BEFORE INSERT ON public.product_dna
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_product_dna_client_id();
