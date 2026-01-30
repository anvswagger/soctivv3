-- Create a consolidated function for dashboard stats to reduce network round-trips
-- Optimized for high-scale with composite indexes

-- 1. Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_leads_client_status ON public.leads (client_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_client_created ON public.leads (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_client_scheduled ON public.appointments (client_id, scheduled_at ASC);

-- 2. Create the consolidated RPC
CREATE OR REPLACE FUNCTION get_dashboard_stats(is_admin_query boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    client_id_val uuid;
    week_start timestamptz;
BEGIN
    -- Get caller's client_id if not admin
    IF NOT is_admin_query THEN
        client_id_val := get_user_client_id(auth.uid());
    END IF;

    week_start := date_trunc('week', now());

    SELECT json_build_object(
        'total_leads', count(*),
        'new_leads_24h', count(*) FILTER (WHERE created_at > now() - interval '24 hours'),
        'appointments_this_week', (
            SELECT count(*) 
            FROM appointments 
            WHERE (is_admin_query OR client_id = client_id_val)
            AND scheduled_at >= week_start
            AND scheduled_at < week_start + interval '1 week'
        ),
        'total_appointments', (
            SELECT count(*) FROM appointments WHERE (is_admin_query OR client_id = client_id_val)
        ),
        'completed_appointments', (
            SELECT count(*) FROM appointments WHERE (is_admin_query OR client_id = client_id_val) AND status = 'completed'
        ),
        'total_users', (
            CASE WHEN is_admin_query THEN (SELECT count(*) FROM profiles) ELSE 0 END
        ),
        'total_sms', (
            SELECT count(*) FROM sms_logs WHERE (is_admin_query OR EXISTS (
                SELECT 1 FROM leads l WHERE l.id = sms_logs.lead_id AND l.client_id = client_id_val
            ))
        ),
        'status_counts', (
            SELECT json_object_agg(status, count)
            FROM (
                SELECT status, count(*) as count
                FROM leads
                WHERE (is_admin_query OR client_id = client_id_val)
                GROUP BY status
            ) s
        )
    ) INTO result
    FROM leads
    WHERE (is_admin_query OR client_id = client_id_val);

    RETURN result;
END;
$$;
