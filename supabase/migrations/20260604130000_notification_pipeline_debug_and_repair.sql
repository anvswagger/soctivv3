-- Notification pipeline diagnostics + browser-side repair helpers.
--
-- 1) debug_notification_pipeline(): returns a JSON snapshot of the whole
--    notification stack so the Settings -> Notifications health panel
--    can render it in one round trip:
--      - app_runtime_settings (supabase_url / service_role_key populated?)
--      - net schema availability
--      - cron schema + job presence
--      - push_subscriptions counts (active, total, per user)
--      - notification_automation_rules summary
--      - last 10 delivery metrics
--
-- 2) upsert_app_runtime_settings(p_supabase_url TEXT, p_service_role_key TEXT):
--    lets the super-admin Settings UI populate the runtime settings row
--    from the browser so DB triggers stop returning early without
--    requiring a CLI run. Service-role scope is required to write to the
--    already-revoked table.

CREATE OR REPLACE FUNCTION public.debug_notification_pipeline()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT := '';
  v_service_role_key TEXT := '';
  v_net_available BOOLEAN := false;
  v_cron_available BOOLEAN := false;
  v_appointment_cron_job BOOLEAN := false;
  v_runtime_settings_present BOOLEAN := false;
  v_runtime_settings_url TEXT := '';
  v_runtime_settings_key_length INT := 0;
  v_push_subs_total BIGINT := 0;
  v_push_subs_active BIGINT := 0;
  v_push_subs_inactive BIGINT := 0;
  v_push_subs_recent JSONB := '[]'::jsonb;
  v_rules_total BIGINT := 0;
  v_rules_enabled BIGINT := 0;
  v_rules_immediate_enabled BIGINT := 0;
  v_rules_by_event JSONB := '[]'::jsonb;
  v_last_metrics JSONB := '[]'::jsonb;
  v_snapshot JSONB;
BEGIN
  -- app_runtime_settings
  IF to_regclass('public.app_runtime_settings') IS NOT NULL THEN
    SELECT s.supabase_url, s.service_role_key
      INTO v_supabase_url, v_service_role_key
      FROM public.app_runtime_settings s
     WHERE s.id = 1;
    v_runtime_settings_present := (v_supabase_url IS NOT NULL AND v_supabase_url <> '')
                                  OR (v_service_role_key IS NOT NULL AND v_service_role_key <> '');
    v_runtime_settings_url := v_supabase_url;
    v_runtime_settings_key_length := length(coalesce(v_service_role_key, ''));
  END IF;

  -- pg_net / pg_cron availability
  v_net_available := to_regnamespace('net') IS NOT NULL;
  v_cron_available := to_regnamespace('cron') IS NOT NULL;

  IF v_cron_available THEN
    SELECT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'appointment-reminders-cron'
    ) INTO v_appointment_cron_job;
  END IF;

  -- push_subscriptions summary
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE is_active),
      count(*) FILTER (WHERE NOT is_active)
    INTO v_push_subs_total, v_push_subs_active, v_push_subs_inactive
    FROM public.push_subscriptions;

    SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.last_seen_at DESC), '[]'::jsonb)
    INTO v_push_subs_recent
    FROM (
      SELECT id, user_id, platform, is_active, last_seen_at, created_at
      FROM public.push_subscriptions
      ORDER BY last_seen_at DESC
      LIMIT 10
    ) t;
  END IF;

  -- automation rules summary
  IF to_regclass('public.notification_automation_rules') IS NOT NULL THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE enabled),
      count(*) FILTER (WHERE enabled AND timing_mode = 'immediate')
    INTO v_rules_total, v_rules_enabled, v_rules_immediate_enabled
    FROM public.notification_automation_rules;

    SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_rules_by_event
    FROM (
      SELECT event_type, count(*) AS rule_count,
             bool_or(enabled) AS any_enabled,
             bool_or(enabled AND send_push) AS any_enabled_push
      FROM public.notification_automation_rules
      GROUP BY event_type
      ORDER BY event_type
    ) t;
  END IF;

  -- last 10 delivery metrics
  IF to_regclass('public.notification_delivery_metrics') IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_last_metrics
    FROM (
      SELECT id, mode, event_type, source, targets, in_app_sent, push_sent, push_failed,
             subscriptions_found, subscriptions_disabled, push_skipped_reason, created_at
      FROM public.notification_delivery_metrics
      ORDER BY created_at DESC
      LIMIT 10
    ) t;
  END IF;

  v_snapshot := jsonb_build_object(
    'runtime_settings', jsonb_build_object(
      'present', v_runtime_settings_present,
      'supabase_url', v_runtime_settings_url,
      'service_role_key_length', v_runtime_settings_key_length,
      'has_supabase_url', coalesce(v_runtime_settings_url, '') <> '',
      'has_service_role_key', v_runtime_settings_key_length > 0
    ),
    'extensions', jsonb_build_object(
      'net_available', v_net_available,
      'cron_available', v_cron_available,
      'appointment_reminders_cron_job', v_appointment_cron_job
    ),
    'push_subscriptions', jsonb_build_object(
      'total', v_push_subs_total,
      'active', v_push_subs_active,
      'inactive', v_push_subs_inactive,
      'recent', v_push_subs_recent
    ),
    'automation_rules', jsonb_build_object(
      'total', v_rules_total,
      'enabled', v_rules_enabled,
      'immediate_enabled', v_rules_immediate_enabled,
      'by_event', v_rules_by_event
    ),
    'last_delivery_metrics', v_last_metrics
  );

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_notification_pipeline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_notification_pipeline() TO authenticated;

-- -------------------------------------------------------------------
-- upsert_app_runtime_settings: lets the super admin Settings UI seed
-- app_runtime_settings from the browser, equivalent to what
-- scripts/setup-notifications.ps1 does via REST.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_app_runtime_settings(
  p_supabase_url TEXT,
  p_service_role_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_super_admin BOOLEAN := false;
  v_normalized_url TEXT := trim(both '/' FROM coalesce(p_supabase_url, ''));
  v_normalized_key TEXT := coalesce(p_service_role_key, '');
  v_result JSONB;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = v_caller
        AND role = 'super_admin'
    ) INTO v_is_super_admin;
  END IF;

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can update app_runtime_settings' USING ERRCODE = '42501';
  END IF;

  IF v_normalized_url = '' OR v_normalized_key = '' THEN
    RAISE EXCEPTION 'Both supabase_url and service_role_key are required' USING ERRCODE = '22023';
  END IF;

  IF to_regclass('public.app_runtime_settings') IS NULL THEN
    RAISE EXCEPTION 'app_runtime_settings table is missing. Run the latest migrations first.' USING ERRCODE = '42P01';
  END IF;

  INSERT INTO public.app_runtime_settings (id, supabase_url, service_role_key, updated_at)
  VALUES (1, v_normalized_url, v_normalized_key, now())
  ON CONFLICT (id) DO UPDATE
    SET supabase_url = EXCLUDED.supabase_url,
        service_role_key = EXCLUDED.service_role_key,
        updated_at = now();

  SELECT jsonb_build_object(
    'ok', true,
    'id', 1,
    'supabase_url', v_normalized_url,
    'service_role_key_length', length(v_normalized_key),
    'updated_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_app_runtime_settings(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_app_runtime_settings(TEXT, TEXT) TO authenticated;
