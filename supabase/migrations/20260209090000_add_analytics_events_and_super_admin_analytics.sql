-- Analytics events table for user behavior tracking
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own analytics events
CREATE POLICY "Users can insert their own analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only super admins can read analytics events
CREATE POLICY "Super admins can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_client_id ON public.analytics_events(client_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_lead_id ON public.analytics_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);

-- Additional index to speed call log analytics
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_created_at ON public.call_logs(lead_id, created_at);

-- Super admin analytics RPC
CREATE OR REPLACE FUNCTION public.get_super_admin_analytics(
  start_at TIMESTAMPTZ DEFAULT NULL,
  end_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  start_ts TIMESTAMPTZ;
  end_ts TIMESTAMPTZ;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  start_ts := start_at;
  end_ts := end_at;

  WITH leads_base AS (
    SELECT l.*
    FROM public.leads l
    WHERE (start_ts IS NULL OR l.created_at >= start_ts)
      AND (end_ts IS NULL OR l.created_at <= end_ts)
  ),
  call_logs_base AS (
    SELECT cl.*
    FROM public.call_logs cl
    WHERE (start_ts IS NULL OR cl.created_at >= start_ts)
      AND (end_ts IS NULL OR cl.created_at <= end_ts)
  ),
  call_logs_enriched AS (
    SELECT cl.*, COALESCE(cl.client_id, l.client_id) AS resolved_client_id
    FROM call_logs_base cl
    LEFT JOIN public.leads l ON l.id = cl.lead_id
  ),
  first_calls AS (
    SELECT cl.lead_id,
           MIN(cl.created_at) AS first_call_at,
           COUNT(*) AS call_count
    FROM call_logs_base cl
    GROUP BY cl.lead_id
  ),
  appointments_base AS (
    SELECT a.*
    FROM public.appointments a
    WHERE (start_ts IS NULL OR a.scheduled_at >= start_ts)
      AND (end_ts IS NULL OR a.scheduled_at <= end_ts)
  ),
  appointment_call_stats AS (
    SELECT
      a.id AS appointment_id,
      a.client_id,
      COUNT(cl.id) FILTER (WHERE cl.created_at <= a.scheduled_at) AS calls_before,
      BOOL_OR(cl.created_at <= a.scheduled_at) AS has_call_before
    FROM appointments_base a
    LEFT JOIN call_logs_enriched cl ON cl.lead_id = a.lead_id
    GROUP BY a.id, a.client_id
  ),
  company_metrics AS (
    SELECT
      c.id AS client_id,
      c.company_name,
      COUNT(DISTINCT l.id) AS leads_count,
      COUNT(DISTINCT a.id) AS appointments_count,
      COUNT(DISTINCT cl.id) AS calls_count,
      AVG(EXTRACT(EPOCH FROM (fc.first_call_at - l.created_at)) / 60.0) AS avg_lead_response_minutes,
      AVG(fc.call_count) AS avg_calls_per_lead,
      AVG(EXTRACT(EPOCH FROM (a.scheduled_at - fc.first_call_at)) / 60.0) AS avg_first_call_to_appointment_minutes,
      (SUM(CASE WHEN acs.has_call_before THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(acs.appointment_id), 0)) AS calls_before_appointment_rate,
      AVG(acs.calls_before)::FLOAT AS avg_calls_before_appointment
    FROM public.clients c
    LEFT JOIN leads_base l ON l.client_id = c.id
    LEFT JOIN appointments_base a ON a.client_id = c.id
    LEFT JOIN call_logs_enriched cl ON cl.resolved_client_id = c.id
    LEFT JOIN first_calls fc ON fc.lead_id = l.id
    LEFT JOIN appointment_call_stats acs ON acs.appointment_id = a.id
    GROUP BY c.id, c.company_name
  ),
  call_hourly AS (
    SELECT EXTRACT(HOUR FROM cl.created_at)::INT AS hour, COUNT(*) AS count
    FROM call_logs_enriched cl
    GROUP BY 1
  ),
  summary AS (
    SELECT
      (SELECT COUNT(*) FROM leads_base) AS total_leads,
      (SELECT COUNT(*) FROM appointments_base) AS total_appointments,
      (SELECT COUNT(*) FROM call_logs_enriched) AS total_calls,
      (SELECT AVG(EXTRACT(EPOCH FROM (fc.first_call_at - l.created_at)) / 60.0)
       FROM leads_base l
       JOIN first_calls fc ON fc.lead_id = l.id) AS avg_lead_response_minutes,
      (SELECT AVG(EXTRACT(EPOCH FROM (a.scheduled_at - fc.first_call_at)) / 60.0)
       FROM appointments_base a
       JOIN first_calls fc ON fc.lead_id = a.lead_id) AS avg_first_call_to_appointment_minutes,
      (SELECT SUM(CASE WHEN acs.has_call_before THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)
       FROM appointment_call_stats acs) AS calls_before_appointment_rate,
      (SELECT AVG(acs.calls_before)::FLOAT FROM appointment_call_stats acs) AS avg_calls_before_appointment
  )
  SELECT json_build_object(
    'summary', (SELECT row_to_json(summary) FROM summary),
    'company_metrics', COALESCE((SELECT json_agg(company_metrics ORDER BY company_name) FROM company_metrics), '[]'::JSON),
    'call_hourly', COALESCE((SELECT json_agg(call_hourly ORDER BY hour) FROM call_hourly), '[]'::JSON)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
