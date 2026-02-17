-- Approval pipeline: queue, SLA, reviewer notes, rejection loop

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sla_hours INTEGER NOT NULL DEFAULT 48,
  sla_due_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours'),
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  rejection_reason TEXT,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS approval_requests_status_idx ON public.approval_requests (status);
CREATE INDEX IF NOT EXISTS approval_requests_sla_due_idx ON public.approval_requests (sla_due_at);

CREATE TABLE IF NOT EXISTS public.approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

-- Approval requests policies
CREATE POLICY "Users can view own approval request"
ON public.approval_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all approval requests"
ON public.approval_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update approval requests"
ON public.approval_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Approval events policies
CREATE POLICY "Users can view own approval events"
ON public.approval_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all approval events"
ON public.approval_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Update timestamp trigger for approval_requests
CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submit or resubmit approval request
CREATE OR REPLACE FUNCTION public.submit_approval_request(p_user_id UUID, p_client_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_request_id UUID;
BEGIN
  v_client_id := p_client_id;
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM public.clients WHERE user_id = p_user_id LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Client not found for user %', p_user_id;
  END IF;

  UPDATE public.profiles
    SET approval_status = 'pending'
    WHERE id = p_user_id;

  SELECT id INTO v_request_id FROM public.approval_requests WHERE user_id = p_user_id;

  IF v_request_id IS NULL THEN
    INSERT INTO public.approval_requests (
      user_id, client_id, status, attempt, submitted_at, sla_hours, sla_due_at
    )
    VALUES (
      p_user_id, v_client_id, 'pending', 1, now(), 48, now() + interval '48 hours'
    )
    RETURNING id INTO v_request_id;
  ELSE
    UPDATE public.approval_requests
      SET status = 'pending',
          attempt = attempt + 1,
          submitted_at = now(),
          sla_hours = 48,
          sla_due_at = now() + interval '48 hours',
          reviewer_id = NULL,
          reviewer_notes = NULL,
          rejection_reason = NULL,
          last_reviewed_at = NULL,
          approved_at = NULL,
          rejected_at = NULL,
          client_id = v_client_id
      WHERE id = v_request_id;
  END IF;

  INSERT INTO public.approval_events (
    request_id, user_id, client_id, status
  ) VALUES (
    v_request_id, p_user_id, v_client_id, 'pending'
  );

  RETURN v_request_id;
END;
$$;

-- Approve/reject
CREATE OR REPLACE FUNCTION public.set_approval_status(
  p_user_id UUID,
  p_status public.approval_status,
  p_reviewer_id UUID DEFAULT NULL,
  p_reviewer_notes TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_reviewer_id UUID;
  v_client_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_reviewer_id := COALESCE(p_reviewer_id, auth.uid());
  SELECT id, client_id INTO v_request_id, v_client_id FROM public.approval_requests WHERE user_id = p_user_id;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Approval request not found for user %', p_user_id;
  END IF;

  UPDATE public.profiles
    SET approval_status = p_status
    WHERE id = p_user_id;

  UPDATE public.approval_requests
    SET status = p_status,
        reviewer_id = v_reviewer_id,
        reviewer_notes = p_reviewer_notes,
        rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
        last_reviewed_at = now(),
        approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
        rejected_at = CASE WHEN p_status = 'rejected' THEN now() ELSE NULL END
    WHERE id = v_request_id;

  INSERT INTO public.approval_events (
    request_id, user_id, client_id, status, reviewer_id, reviewer_notes, rejection_reason
  ) VALUES (
    v_request_id, p_user_id, v_client_id, p_status, v_reviewer_id, p_reviewer_notes, p_rejection_reason
  );
END;
$$;

-- Trigger: submit approval request when onboarding completes
CREATE OR REPLACE FUNCTION public.on_onboarding_completed_submit_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed) THEN
    PERFORM public.submit_approval_request(NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_onboarding_submit_approval ON public.clients;
CREATE TRIGGER clients_onboarding_submit_approval
  AFTER UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.on_onboarding_completed_submit_approval();

-- Backfill pending requests for existing onboarded clients
INSERT INTO public.approval_requests (
  user_id, client_id, status, attempt, submitted_at, sla_hours, sla_due_at
)
SELECT
  c.user_id,
  c.id,
  'pending',
  1,
  now(),
  48,
  now() + interval '48 hours'
FROM public.clients c
JOIN public.profiles p ON p.id = c.user_id
WHERE c.onboarding_completed = true
  AND p.approval_status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.approval_requests ar WHERE ar.user_id = c.user_id
  );
