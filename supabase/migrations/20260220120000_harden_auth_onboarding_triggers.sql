-- Harden auth/onboarding triggers for deterministic approval request submission.

-- Ensure approval request submission can run on both INSERT and UPDATE transitions.
CREATE OR REPLACE FUNCTION public.on_onboarding_completed_submit_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_completed = true
    AND (
      TG_OP = 'INSERT'
      OR OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed
    )
  THEN
    PERFORM public.submit_approval_request(NEW.user_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_onboarding_submit_approval ON public.clients;
CREATE TRIGGER clients_onboarding_submit_approval
  AFTER INSERT OR UPDATE OF onboarding_completed ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.on_onboarding_completed_submit_approval();

-- Ensure signup trigger exists and is enabled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping trigger enable for auth.users (insufficient privilege).';
  END;
END;
$$;

-- Backfill missing pending approval rows for onboarded clients.
INSERT INTO public.approval_requests (
  user_id,
  client_id,
  status,
  attempt,
  submitted_at,
  sla_hours,
  sla_due_at
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
    SELECT 1
    FROM public.approval_requests ar
    WHERE ar.user_id = c.user_id
  )
ON CONFLICT (user_id) DO NOTHING;
