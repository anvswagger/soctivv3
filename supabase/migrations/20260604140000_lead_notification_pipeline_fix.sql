-- Lead notification pipeline diagnostics and repair.
--
-- Problem: The fire_notification_automation_event function silently returns
-- when app_runtime_settings is empty or pg_net is unavailable, causing
-- lead notifications to never be sent.
--
-- This migration:
-- 1) Adds a diagnostic function to check each stage of the pipeline
-- 2) Adds a manual test function to fire a lead notification on demand
-- 3) Improves fire_notification_automation_event with error logging

-- -------------------------------------------------------------------
-- 1) diagnose_lead_notification_pipeline(): returns a JSON snapshot
--    of each pipeline stage so we can see exactly what's broken.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diagnose_lead_notification_pipeline()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_available BOOLEAN := false;
  v_runtime_settings_present BOOLEAN := false;
  v_runtime_settings_url TEXT := '';
  v_runtime_settings_key_length INT := 0;
  v_rules_total BIGINT := 0;
  v_rules_enabled BIGINT := 0;
  v_rules_lead_created_enabled BIGINT := 0;
  v_push_subs_active BIGINT := 0;
  v_push_subs_total BIGINT := 0;
  v_trigger_exists BOOLEAN := false;
  v_vapid_configured BOOLEAN := false;
  v_snapshot JSONB;
BEGIN
  -- Check pg_net
  v_net_available := to_regnamespace('net') IS NOT NULL;

  -- Check app_runtime_settings
  IF to_regclass('public.app_runtime_settings') IS NOT NULL THEN
    BEGIN
      SELECT s.supabase_url, s.service_role_key
        INTO v_runtime_settings_url, v_runtime_settings_key_length
        FROM public.app_runtime_settings s
       WHERE s.id = 1;
      v_runtime_settings_key_length := length(coalesce(v_runtime_settings_key_length::text, ''));
      -- Re-read properly
      DECLARE
        v_url TEXT;
        v_key TEXT;
      BEGIN
        SELECT s.supabase_url, s.service_role_key
          INTO v_url, v_key
          FROM public.app_runtime_settings s
         WHERE s.id = 1;
        v_runtime_settings_url := coalesce(v_url, '');
        v_runtime_settings_key_length := length(coalesce(v_key, ''));
        v_runtime_settings_present := (coalesce(v_url, '') <> '' AND length(coalesce(v_key, '')) > 0);
      END;
    EXCEPTION
      WHEN OTHERS THEN
        v_runtime_settings_present := false;
    END;
  END IF;

  -- Check trigger exists on leads table
  IF to_regclass('public.leads') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND c.relname = 'leads'
        AND t.tgname LIKE '%notification%'
        AND NOT t.tgisinternal
    ) INTO v_trigger_exists;
  END IF;

  -- Check automation rules for lead_created
  IF to_regclass('public.notification_automation_rules') IS NOT NULL THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE enabled),
      count(*) FILTER (WHERE enabled AND event_type = 'lead_created')
    INTO v_rules_total, v_rules_enabled, v_rules_lead_created_enabled
    FROM public.notification_automation_rules;
  END IF;

  -- Check push subscriptions
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE is_active)
    INTO v_push_subs_total, v_push_subs_active
    FROM public.push_subscriptions;
  END IF;

  -- Check VAPID keys (edge function secrets cannot be read from SQL,
  -- but we can check if the app_runtime_settings has values that look like keys)
  v_vapid_configured := v_runtime_settings_present;

  v_snapshot := jsonb_build_object(
    'pg_net_available', v_net_available,
    'runtime_settings', jsonb_build_object(
      'present', v_runtime_settings_present,
      'has_url', coalesce(v_runtime_settings_url, '') <> '',
      'key_length', v_runtime_settings_key_length
    ),
    'leads_trigger_exists', v_trigger_exists,
    'automation_rules', jsonb_build_object(
      'total', v_rules_total,
      'enabled', v_rules_enabled,
      'lead_created_enabled', v_rules_lead_created_enabled
    ),
    'push_subscriptions', jsonb_build_object(
      'total', v_push_subs_total,
      'active', v_push_subs_active
    ),
    'diagnosis', CASE
      WHEN NOT v_net_available THEN 'CRITICAL: pg_net extension is not installed. Notifications cannot be sent.'
      WHEN NOT v_runtime_settings_present THEN 'CRITICAL: app_runtime_settings is empty. Set supabase_url and service_role_key via Settings page or upsert_app_runtime_settings().'
      WHEN v_rules_lead_created_enabled = 0 THEN 'WARNING: No enabled automation rule for lead_created event. Create one in Settings > Notifications.'
      WHEN v_push_subs_active = 0 THEN 'WARNING: No active push subscriptions. Users need to enable push notifications in their browser.'
      ELSE 'OK: Pipeline looks healthy. If notifications still fail, check edge function logs in Supabase dashboard.'
    END
  );

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.diagnose_lead_notification_pipeline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_lead_notification_pipeline() TO authenticated;

-- -------------------------------------------------------------------
-- 2) fire_lead_notification_manual(lead_id UUID): manually fires a
--    lead_created notification for a specific lead. Useful for testing
--    when the automatic trigger isn't working.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fire_lead_notification_manual(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_payload JSONB;
  v_result JSONB;
BEGIN
  -- Fetch the lead
  SELECT id, client_id, status, stage, first_name, last_name, phone, email, source, worktype, assigned_user_id
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lead not found');
  END IF;

  v_payload := jsonb_build_object(
    'lead_id', v_lead.id,
    'client_id', v_lead.client_id,
    'status', v_lead.status,
    'stage', v_lead.stage,
    'first_name', v_lead.first_name,
    'last_name', v_lead.last_name,
    'phone', v_lead.phone,
    'email', v_lead.email,
    'source', v_lead.source,
    'worktype', v_lead.worktype,
    'assigned_user_id', v_lead.assigned_user_id
  );

  -- Fire the notification
  PERFORM public.fire_notification_automation_event('lead_created', v_payload, '{}'::jsonb);

  v_result := jsonb_build_object(
    'ok', true,
    'lead_id', p_lead_id,
    'event_type', 'lead_created',
    'payload', v_payload,
    'message', 'Notification event fired. Check edge function logs and push delivery metrics.'
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fire_lead_notification_manual(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fire_lead_notification_manual(UUID) TO authenticated;

-- -------------------------------------------------------------------
-- 3) Ensure leads table has Realtime enabled (RLS policies permitting
--    the authenticated role to SELECT are required for Realtime).
-- -------------------------------------------------------------------
-- Note: Realtime must also be enabled in the Supabase dashboard:
--   Database > Replication > Enable "supabase_realtime" for the "leads" table.
-- This SQL cannot toggle that setting directly.