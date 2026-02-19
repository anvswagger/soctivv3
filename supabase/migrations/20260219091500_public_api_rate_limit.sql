-- Durable rate limiting for public edge endpoints (booking/slots/analytics).
-- Uses one row per bucket key and updates counters atomically.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_rate_limits_updated_at_idx
  ON public.api_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_bucket_key IS NULL OR length(trim(p_bucket_key)) = 0 THEN
    RAISE EXCEPTION 'p_bucket_key is required';
  END IF;

  IF p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be greater than 0';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be greater than 0';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.api_rate_limits (bucket_key, window_start, request_count, updated_at)
  VALUES (p_bucket_key, v_window_start, 1, v_now)
  ON CONFLICT (bucket_key)
  DO UPDATE
    SET request_count = CASE
      WHEN public.api_rate_limits.window_start = EXCLUDED.window_start
        THEN public.api_rate_limits.request_count + 1
      ELSE 1
    END,
    window_start = EXCLUDED.window_start,
    updated_at = EXCLUDED.updated_at
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

