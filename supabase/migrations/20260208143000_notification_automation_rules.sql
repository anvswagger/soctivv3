-- IF -> THEN automation rules for notifications (super admin controlled)
CREATE TABLE IF NOT EXISTS public.notification_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('appointment_created', 'appointment_updated')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_type TEXT NOT NULL DEFAULT 'info',
  url TEXT NOT NULL DEFAULT '/appointments',
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  send_push BOOLEAN NOT NULL DEFAULT true,
  send_in_app BOOLEAN NOT NULL DEFAULT true,
  target_roles public.app_role[] NOT NULL DEFAULT ARRAY['admin']::public.app_role[],
  only_event_client BOOLEAN NOT NULL DEFAULT true,
  client_id_filter UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_automation_rules_event_type
  ON public.notification_automation_rules(event_type);

CREATE INDEX IF NOT EXISTS idx_notification_automation_rules_enabled
  ON public.notification_automation_rules(enabled);

ALTER TABLE public.notification_automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can view automation rules"
ON public.notification_automation_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can insert automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can insert automation rules"
ON public.notification_automation_rules
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can update automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can update automation rules"
ON public.notification_automation_rules
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can delete automation rules" ON public.notification_automation_rules;
CREATE POLICY "Super admins can delete automation rules"
ON public.notification_automation_rules
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notification_automation_rules_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_automation_rules_updated_at
    BEFORE UPDATE ON public.notification_automation_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- Seed default rules (idempotent)
INSERT INTO public.notification_automation_rules (
  name,
  event_type,
  notification_type,
  url,
  title_template,
  message_template,
  send_push,
  send_in_app,
  target_roles,
  only_event_client,
  enabled
)
SELECT
  'موعد جديد - فريق العميل',
  'appointment_created',
  'info',
  '/appointments',
  'تمت إضافة موعد جديد',
  'تمت إضافة موعد جديد بتاريخ {{scheduled_at}} (الحالة: {{status}})',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'موعد جديد - فريق العميل'
);

INSERT INTO public.notification_automation_rules (
  name,
  event_type,
  notification_type,
  url,
  title_template,
  message_template,
  send_push,
  send_in_app,
  target_roles,
  only_event_client,
  enabled
)
SELECT
  'تحديث موعد - فريق العميل',
  'appointment_updated',
  'warning',
  '/appointments',
  'تم تحديث موعد',
  'تم تحديث الموعد من {{old_scheduled_at}} إلى {{scheduled_at}} (الحالة: {{status}})',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'تحديث موعد - فريق العميل'
);

-- Trigger function to call edge function for appointment events
CREATE OR REPLACE FUNCTION public.trigger_appointment_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_name TEXT;
  payload JSONB;
  old_payload JSONB := '{}'::jsonb;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If project-level settings are not configured yet, skip quietly.
  IF coalesce(supabase_url, '') = '' OR coalesce(service_role_key, '') = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    event_name := 'appointment_created';
    payload := jsonb_build_object(
      'appointment_id', NEW.id,
      'client_id', NEW.client_id,
      'lead_id', NEW.lead_id,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ignore no-op updates where only updated_at changed
    IF (to_jsonb(NEW) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
      RETURN NEW;
    END IF;

    event_name := 'appointment_updated';
    payload := jsonb_build_object(
      'appointment_id', NEW.id,
      'client_id', NEW.client_id,
      'lead_id', NEW.lead_id,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status
    );
    old_payload := jsonb_build_object(
      'appointment_id', OLD.id,
      'client_id', OLD.client_id,
      'lead_id', OLD.lead_id,
      'scheduled_at', OLD.scheduled_at,
      'status', OLD.status
    );
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'event_type', event_name,
      'event_payload', payload,
      'old_payload', old_payload,
      'source', 'db_trigger'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_notify_insert ON public.appointments;
CREATE TRIGGER trg_appointments_notify_insert
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_notification_event();

DROP TRIGGER IF EXISTS trg_appointments_notify_update ON public.appointments;
CREATE TRIGGER trg_appointments_notify_update
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_notification_event();
