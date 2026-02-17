-- Granular feature access for admin users, controlled by super admins.
CREATE TABLE IF NOT EXISTS public.admin_access_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_leads BOOLEAN NOT NULL DEFAULT true,
  can_appointments BOOLEAN NOT NULL DEFAULT true,
  can_library BOOLEAN NOT NULL DEFAULT true,
  can_clients BOOLEAN NOT NULL DEFAULT true,
  can_settings BOOLEAN NOT NULL DEFAULT true,
  can_sms BOOLEAN NOT NULL DEFAULT true,
  can_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_access_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all admin access permissions" ON public.admin_access_permissions;
DROP POLICY IF EXISTS "Super admins can insert admin access permissions" ON public.admin_access_permissions;
DROP POLICY IF EXISTS "Super admins can update admin access permissions" ON public.admin_access_permissions;
DROP POLICY IF EXISTS "Super admins can delete admin access permissions" ON public.admin_access_permissions;
DROP POLICY IF EXISTS "Admins can view own admin access permissions" ON public.admin_access_permissions;

CREATE POLICY "Super admins can view all admin access permissions"
ON public.admin_access_permissions
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert admin access permissions"
ON public.admin_access_permissions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update admin access permissions"
ON public.admin_access_permissions
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete admin access permissions"
ON public.admin_access_permissions
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can view own admin access permissions"
ON public.admin_access_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Ensure existing admins receive full access rows.
INSERT INTO public.admin_access_permissions (
  user_id,
  can_leads,
  can_appointments,
  can_library,
  can_clients,
  can_settings,
  can_sms,
  can_notifications
)
SELECT
  ur.user_id,
  true,
  true,
  true,
  true,
  true,
  true,
  true
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

DROP TRIGGER IF EXISTS update_admin_access_permissions_updated_at ON public.admin_access_permissions;

CREATE TRIGGER update_admin_access_permissions_updated_at
BEFORE UPDATE ON public.admin_access_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
