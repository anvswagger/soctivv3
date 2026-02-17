-- Fix auth_rls_initplan linter issues
-- This fixes the performance issue where auth functions are re-evaluated for each row
-- by wrapping them in SELECT subqueries. This allows PostgreSQL to cache the result.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =============================================================================
-- profiles table policies (from 20251220120750_4e1305c0-ab25-4967-9ef2-2e8e0cd50e38.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- user_roles table policies (from 20251220120750_4e1305c0-ab25-4967-9ef2-2e8e0cd50e38.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- clients table policies (from 20251220122929_a3a68f1e-e160-4499-99f8-395d42f14af7.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own client profile" ON public.clients;
CREATE POLICY "Users can view own client profile" ON public.clients
FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own client profile" ON public.clients;
CREATE POLICY "Users can update own client profile" ON public.clients
FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own client profile" ON public.clients;
CREATE POLICY "Users can insert own client profile" ON public.clients
FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
CREATE POLICY "Admins can view all clients" ON public.clients
FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage all clients" ON public.clients
FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- leads table policies (from 20251220122929_a3a68f1e-e160-4499-99f8-395d42f14af7.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view own leads" ON public.leads;
CREATE POLICY "Clients can view own leads" ON public.leads
FOR SELECT USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can insert own leads" ON public.leads;
CREATE POLICY "Clients can insert own leads" ON public.leads
FOR INSERT WITH CHECK (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can update own leads" ON public.leads;
CREATE POLICY "Clients can update own leads" ON public.leads
FOR UPDATE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can delete own leads" ON public.leads;
CREATE POLICY "Clients can delete own leads" ON public.leads
FOR DELETE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads" ON public.leads
FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;
CREATE POLICY "Admins can manage all leads" ON public.leads
FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- appointments table policies (from 20251220122929_a3a68f1e-e160-4499-99f8-395d42f14af7.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;
CREATE POLICY "Clients can view own appointments" ON public.appointments
FOR SELECT USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can insert own appointments" ON public.appointments;
CREATE POLICY "Clients can insert own appointments" ON public.appointments
FOR INSERT WITH CHECK (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can update own appointments" ON public.appointments;
CREATE POLICY "Clients can update own appointments" ON public.appointments
FOR UPDATE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can delete own appointments" ON public.appointments;
CREATE POLICY "Clients can delete own appointments" ON public.appointments
FOR DELETE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
CREATE POLICY "Admins can view all appointments" ON public.appointments
FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all appointments" ON public.appointments;
CREATE POLICY "Admins can manage all appointments" ON public.appointments
FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- sms_templates table policies (from 20251220122929_a3a68f1e-e160-4499-99f8-395d42f14af7.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own templates" ON public.sms_templates;
CREATE POLICY "Users can view own templates" ON public.sms_templates
FOR SELECT USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own templates" ON public.sms_templates;
CREATE POLICY "Users can insert own templates" ON public.sms_templates
FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()) AND is_system = false);

DROP POLICY IF EXISTS "Users can update own templates" ON public.sms_templates;
CREATE POLICY "Users can update own templates" ON public.sms_templates
FOR UPDATE USING (created_by = (SELECT auth.uid()) AND is_system = false);

DROP POLICY IF EXISTS "Users can delete own templates" ON public.sms_templates;
CREATE POLICY "Users can delete own templates" ON public.sms_templates
FOR DELETE USING (created_by = (SELECT auth.uid()) AND is_system = false);

DROP POLICY IF EXISTS "Admins can manage all templates" ON public.sms_templates;
CREATE POLICY "Admins can manage all templates" ON public.sms_templates
FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- sms_logs table policies (from 20251220122929_a3a68f1e-e160-4499-99f8-395d42f14af7.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own sms logs" ON public.sms_logs;
CREATE POLICY "Users can view own sms logs" ON public.sms_logs
FOR SELECT USING (sent_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clients can view their leads sms logs" ON public.sms_logs;
CREATE POLICY "Clients can view their leads sms logs" ON public.sms_logs
FOR SELECT USING (
  lead_id IN (SELECT id FROM public.leads WHERE client_id = (SELECT public.get_user_client_id(auth.uid())))
);

DROP POLICY IF EXISTS "Users can insert sms logs" ON public.sms_logs;
CREATE POLICY "Users can insert sms logs" ON public.sms_logs
FOR INSERT WITH CHECK (sent_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all sms logs" ON public.sms_logs;
CREATE POLICY "Admins can view all sms logs" ON public.sms_logs
FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all sms logs" ON public.sms_logs;
CREATE POLICY "Admins can manage all sms logs" ON public.sms_logs
FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- notifications table policies (from 20251220122929_a3a68f1e-e160-4499-99f8-395d42f14af7.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications
FOR INSERT WITH CHECK ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- user_gold_points table policies (from 20251225083905_35b28785-ff38-4e84-bd76-25dcaf7dfe95.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own gold points" ON public.user_gold_points;
CREATE POLICY "Users can view own gold points"
  ON public.user_gold_points
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own gold points" ON public.user_gold_points;
CREATE POLICY "Users can insert own gold points"
  ON public.user_gold_points
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all gold points" ON public.user_gold_points;
CREATE POLICY "Admins can view all gold points"
  ON public.user_gold_points
  FOR SELECT
  USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- appointment_reminders table policies (from 20251230111140_a898ba7e-43f9-4787-8b80-e79e6707e911.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can manage all reminders" ON public.appointment_reminders;
CREATE POLICY "Admins can manage all reminders" ON public.appointment_reminders
FOR ALL
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can view all reminders" ON public.appointment_reminders;
CREATE POLICY "Admins can view all reminders" ON public.appointment_reminders
FOR SELECT
USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- call_logs table policies (from 20260131120000_create_call_logs_table.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own call logs" ON public.call_logs;
CREATE POLICY "Users can view their own call logs"
ON public.call_logs
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own call logs" ON public.call_logs;
CREATE POLICY "Users can insert their own call logs"
ON public.call_logs
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own call logs" ON public.call_logs;
CREATE POLICY "Users can update their own call logs"
ON public.call_logs
FOR UPDATE
USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- client_media table policies (from 20260120103726_48858704-73ee-4e67-960e-f7bad95d4307.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view own media" ON public.client_media;
CREATE POLICY "Clients can view own media" ON public.client_media
  FOR SELECT USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can insert own media" ON public.client_media;
CREATE POLICY "Clients can insert own media" ON public.client_media
  FOR INSERT WITH CHECK (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can update own media" ON public.client_media;
CREATE POLICY "Clients can update own media" ON public.client_media
  FOR UPDATE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can delete own media" ON public.client_media;
CREATE POLICY "Clients can delete own media" ON public.client_media
  FOR DELETE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can view all media" ON public.client_media;
CREATE POLICY "Admins can view all media" ON public.client_media
  FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all media" ON public.client_media;
CREATE POLICY "Admins can manage all media" ON public.client_media
  FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- vault_items table policies (from 20260207135619_dc39bb87-4019-44d5-a6d6-f969f025a067.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can manage all vault items" ON public.vault_items;
CREATE POLICY "Admins can manage all vault items" ON public.vault_items
FOR ALL USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can view all vault items" ON public.vault_items;
CREATE POLICY "Admins can view all vault items" ON public.vault_items
FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Clients can view own vault items" ON public.vault_items;
CREATE POLICY "Clients can view own vault items" ON public.vault_items
FOR SELECT USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can insert own vault items" ON public.vault_items;
CREATE POLICY "Clients can insert own vault items" ON public.vault_items
FOR INSERT WITH CHECK (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can update own vault items" ON public.vault_items;
CREATE POLICY "Clients can update own vault items" ON public.vault_items
FOR UPDATE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

DROP POLICY IF EXISTS "Clients can delete own vault items" ON public.vault_items;
CREATE POLICY "Clients can delete own vault items" ON public.vault_items
FOR DELETE USING (client_id = (SELECT public.get_user_client_id(auth.uid())));

-- =============================================================================
-- push_subscriptions table policies (from 20260208124500_manage_push_notifications.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Super admins can view all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Super admins can view all push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- notification_templates table policies (from 20260208124500_manage_push_notifications.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can view notification templates"
ON public.notification_templates
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "Super admins can insert notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can insert notification templates"
ON public.notification_templates
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "Super admins can update notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can update notification templates"
ON public.notification_templates
FOR UPDATE
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')))
WITH CHECK ((SELECT public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "Super admins can delete notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can delete notification templates"
ON public.notification_templates
FOR DELETE
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- notification_automation_rules table policies (from 20260208143000_notification_automation_rules.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can view automation rules"
ON public.notification_automation_rules
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "Super admins can insert automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can insert automation rules"
ON public.notification_automation_rules
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "Super admins can update automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can update automation rules"
ON public.notification_automation_rules
FOR UPDATE
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')))
WITH CHECK ((SELECT public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "Super admins can delete automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can delete automation rules"
ON public.notification_automation_rules
FOR DELETE
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- analytics_events table policies (from 20260209090000_add_analytics_events_and_super_admin_analytics.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert their own analytics events" ON public.analytics_events;
CREATE POLICY "Users can insert their own analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Super admins can read analytics events" ON public.analytics_events;
CREATE POLICY "Super admins can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- approval_requests table policies (from 20260210123000_approval_pipeline.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own approval request" ON public.approval_requests;
CREATE POLICY "Users can view own approval request"
ON public.approval_requests FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all approval requests" ON public.approval_requests;
CREATE POLICY "Admins can view all approval requests"
ON public.approval_requests FOR SELECT
TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admins can update approval requests" ON public.approval_requests;
CREATE POLICY "Admins can update approval requests"
ON public.approval_requests FOR UPDATE
TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- approval_events table policies (from 20260210123000_approval_pipeline.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own approval events" ON public.approval_events;
CREATE POLICY "Users can view own approval events"
ON public.approval_events FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all approval events" ON public.approval_events;
CREATE POLICY "Admins can view all approval events"
ON public.approval_events FOR SELECT
TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- =============================================================================
-- admin_clients table policies (from 20260130142605_7e9474d2-4694-4c4f-a5d8-8bc76b6afdff.sql)
-- Note: These already use EXISTS subqueries which is the optimal pattern
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view all admin_clients" ON public.admin_clients;
CREATE POLICY "Super admins can view all admin_clients"
ON public.admin_clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Super admins can insert admin_clients" ON public.admin_clients;
CREATE POLICY "Super admins can insert admin_clients"
ON public.admin_clients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Super admins can delete admin_clients" ON public.admin_clients;
CREATE POLICY "Super admins can delete admin_clients"
ON public.admin_clients
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'super_admin'
  )
);

-- =============================================================================
-- appointment_reminder_cron_runs table policies (from 20260209001000_harden_appointment_reminders_cron.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view appointment reminder cron runs" ON public.appointment_reminder_cron_runs;
CREATE POLICY "Super admins can view appointment reminder cron runs"
ON public.appointment_reminder_cron_runs
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- notification_automation_event_dispatches table policies (from 20260209093100_lockdown_rls_tables.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view automation dispatches" ON public.notification_automation_event_dispatches;
CREATE POLICY "Super admins can view automation dispatches"
ON public.notification_automation_event_dispatches
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- notification_appointment_no_show_markers table policies (from 20260209093100_lockdown_rls_tables.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view no show markers" ON public.notification_appointment_no_show_markers;
CREATE POLICY "Super admins can view no show markers"
ON public.notification_appointment_no_show_markers
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- job_runs table policies (from 20260210193000_job_observability.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view job runs" ON public.job_runs;
CREATE POLICY "Super admins can view job runs"
  ON public.job_runs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- job_dead_letters table policies (from 20260210193000_job_observability.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view dead letters" ON public.job_dead_letters;
CREATE POLICY "Super admins can view dead letters"
  ON public.job_dead_letters
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- webhook_events table policies (from 20260210193000_job_observability.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view webhook events" ON public.webhook_events;
CREATE POLICY "Super admins can view webhook events"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'super_admin')));

-- =============================================================================
-- notification_delivery_metrics table policies (from 20260210154000_notifications_segments_metrics.sql)
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view delivery metrics" ON public.notification_delivery_metrics;
CREATE POLICY "Super admins can view delivery metrics"
ON public.notification_delivery_metrics
FOR SELECT
TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'super_admin')));
