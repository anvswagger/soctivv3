-- Lock down RLS for internal-only tables that lacked policies

-- 1) notification_automation_event_dispatches
ALTER TABLE public.notification_automation_event_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view automation dispatches" ON public.notification_automation_event_dispatches;
CREATE POLICY "Super admins can view automation dispatches"
ON public.notification_automation_event_dispatches
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 2) notification_appointment_no_show_markers
ALTER TABLE public.notification_appointment_no_show_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view no show markers" ON public.notification_appointment_no_show_markers;
CREATE POLICY "Super admins can view no show markers"
ON public.notification_appointment_no_show_markers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) app_runtime_settings (deny all for anon/authenticated)
ALTER TABLE public.app_runtime_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny access to app runtime settings" ON public.app_runtime_settings;
CREATE POLICY "Deny access to app runtime settings"
ON public.app_runtime_settings
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
