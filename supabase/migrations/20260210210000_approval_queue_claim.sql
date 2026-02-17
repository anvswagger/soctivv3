-- Approval queue claim and reviewer assignment

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS reviewer_assigned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS approval_requests_reviewer_idx
  ON public.approval_requests (reviewer_id);

CREATE OR REPLACE FUNCTION public.claim_approval_request(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.approval_requests
     SET reviewer_id = auth.uid(),
         reviewer_assigned_at = now()
   WHERE user_id = p_user_id
     AND status = 'pending'
     AND (reviewer_id IS NULL OR reviewer_id = auth.uid());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Approval request already claimed';
  END IF;
END;
$$;
