-- Security Fix: Add explicit DENY policies for anonymous users on sensitive tables
-- This prevents any anonymous access to leads and profiles tables

-- 1. Deny anonymous access to leads table (contains customer contact info)
CREATE POLICY "Deny anonymous access to leads" 
ON public.leads 
AS RESTRICTIVE
FOR ALL 
TO anon 
USING (false);

-- 2. Deny anonymous access to profiles table (contains user phone numbers)
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
AS RESTRICTIVE
FOR ALL 
TO anon 
USING (false);

-- 3. Fix get_dashboard_stats function to verify admin status server-side
-- instead of trusting client-supplied is_admin_query parameter
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    client_id_val uuid;
    week_start timestamptz;
    is_admin_user boolean;
    status_counts json;
BEGIN
    -- SERVER-SIDE: Check if user is actually an admin
    is_admin_user := is_admin(auth.uid());
    
    -- Get week start
    week_start := date_trunc('week', now());
    
    -- Get caller's client_id if not admin
    IF NOT is_admin_user THEN
        client_id_val := get_user_client_id(auth.uid());
        
        -- If not admin and no client_id, return empty stats
        IF client_id_val IS NULL THEN
            RETURN json_build_object(
                'total_leads', 0,
                'new_leads_24h', 0,
                'appointments_this_week', 0,
                'total_appointments', 0,
                'completed_appointments', 0,
                'total_users', 0,
                'total_sms', 0,
                'status_counts', '{}'::json
            );
        END IF;
    END IF;
    
    -- Get status counts
    SELECT json_object_agg(status, cnt) INTO status_counts
    FROM (
        SELECT status, count(*) as cnt 
        FROM leads 
        WHERE (is_admin_user OR client_id = client_id_val)
        GROUP BY status
    ) sub;
    
    -- Build result
    SELECT json_build_object(
        'total_leads', (
            SELECT count(*) FROM leads 
            WHERE (is_admin_user OR client_id = client_id_val)
        ),
        'new_leads_24h', (
            SELECT count(*) FROM leads 
            WHERE status = 'new' 
            AND created_at >= now() - interval '24 hours'
            AND (is_admin_user OR client_id = client_id_val)
        ),
        'appointments_this_week', (
            SELECT count(*) FROM appointments 
            WHERE scheduled_at >= week_start
            AND (is_admin_user OR client_id = client_id_val)
        ),
        'total_appointments', (
            SELECT count(*) FROM appointments 
            WHERE (is_admin_user OR client_id = client_id_val)
        ),
        'completed_appointments', (
            SELECT count(*) FROM appointments 
            WHERE status = 'completed'
            AND (is_admin_user OR client_id = client_id_val)
        ),
        'total_users', (
            CASE WHEN is_admin_user THEN 
                (SELECT count(*) FROM profiles) 
            ELSE 0 END
        ),
        'total_sms', (
            SELECT count(*) FROM sms_logs 
            WHERE (is_admin_user OR lead_id IN (
                SELECT id FROM leads WHERE client_id = client_id_val
            ))
        ),
        'status_counts', COALESCE(status_counts, '{}'::json)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;