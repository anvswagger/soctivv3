-- Web/PWA push subscriptions per device/browser
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
  ON public.push_subscriptions(is_active);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can view all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Super admins can view all push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_push_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- Super-admin reusable notification templates (no-code settings workflow)
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  url TEXT,
  target_roles public.app_role[] NOT NULL DEFAULT ARRAY['client']::public.app_role[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can view notification templates"
ON public.notification_templates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can insert notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can insert notification templates"
ON public.notification_templates
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can update notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can update notification templates"
ON public.notification_templates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can delete notification templates" ON public.notification_templates;
CREATE POLICY "Super admins can delete notification templates"
ON public.notification_templates
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notification_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON public.notification_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;
