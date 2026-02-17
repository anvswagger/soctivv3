-- Job observability tables: runs, dead letters, webhook events

CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'function',
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  details JSONB NULL,
  error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name_started_at
  ON public.job_runs (job_name, started_at DESC);

CREATE TABLE IF NOT EXISTS public.job_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  job_name TEXT NULL,
  payload JSONB NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_dead_letters_created_at
  ON public.job_dead_letters (created_at DESC);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'facebook',
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed')),
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  payload JSONB NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON public.webhook_events (created_at DESC);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view job runs" ON public.job_runs;
CREATE POLICY "Super admins can view job runs"
  ON public.job_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can view dead letters" ON public.job_dead_letters;
CREATE POLICY "Super admins can view dead letters"
  ON public.job_dead_letters
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can view webhook events" ON public.webhook_events;
CREATE POLICY "Super admins can view webhook events"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
