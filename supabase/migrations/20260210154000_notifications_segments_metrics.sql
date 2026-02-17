-- Segmented push notifications + delivery metrics

-- Expand automation event catalog
ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_event_type_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_event_type_check
  CHECK (
    event_type IN (
      'appointment_created',
      'appointment_updated',
      'appointment_rescheduled',
      'appointment_status_changed',
      'appointment_completed',
      'appointment_cancelled',
      'appointment_no_show',
      'appointment_no_show_after_48h',
      'appointment_after_1h',
      'lead_created',
      'lead_updated',
      'lead_status_changed',
      'lead_stage_changed',
      'lead_sold',
      'lead_pipeline_new',
      'lead_pipeline_contacting',
      'lead_pipeline_appointment_booked',
      'lead_pipeline_interviewed',
      'lead_pipeline_no_show',
      'lead_pipeline_sold',
      'lead_pipeline_cancelled',
      'lead_assigned',
      'approval_status_changed',
      'approval_approved',
      'approval_rejected'
    )
  ) NOT VALID;

-- Lead assignment support
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_id
  ON public.leads (assigned_user_id);

-- Extend lead trigger to emit assignment event
CREATE OR REPLACE FUNCTION public.trigger_lead_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  old_payload JSONB := '{}'::jsonb;
  pipeline_event TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'lead_id', NEW.id,
      'client_id', NEW.client_id,
      'status', NEW.status,
      'stage', NEW.stage,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'phone', NEW.phone,
      'email', NEW.email,
      'source', NEW.source,
      'worktype', NEW.worktype,
      'assigned_user_id', NEW.assigned_user_id
    );

    PERFORM public.fire_notification_automation_event(
      'lead_created',
      payload,
      old_payload
    );

    IF NEW.assigned_user_id IS NOT NULL THEN
      PERFORM public.fire_notification_automation_event(
        'lead_assigned',
        payload,
        old_payload
      );
    END IF;

    pipeline_event := CASE NEW.status::text
      WHEN 'new' THEN 'lead_pipeline_new'
      WHEN 'contacting' THEN 'lead_pipeline_contacting'
      WHEN 'appointment_booked' THEN 'lead_pipeline_appointment_booked'
      WHEN 'interviewed' THEN 'lead_pipeline_interviewed'
      WHEN 'no_show' THEN 'lead_pipeline_no_show'
      WHEN 'sold' THEN 'lead_pipeline_sold'
      WHEN 'cancelled' THEN 'lead_pipeline_cancelled'
      ELSE NULL
    END;

    IF pipeline_event IS NOT NULL THEN
      PERFORM public.fire_notification_automation_event(
        pipeline_event,
        payload,
        old_payload
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'lead_id', NEW.id,
    'client_id', NEW.client_id,
    'status', NEW.status,
    'stage', NEW.stage,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'phone', NEW.phone,
    'email', NEW.email,
    'source', NEW.source,
    'worktype', NEW.worktype,
    'assigned_user_id', NEW.assigned_user_id
  );

  old_payload := jsonb_build_object(
    'lead_id', OLD.id,
    'client_id', OLD.client_id,
    'status', OLD.status,
    'stage', OLD.stage,
    'first_name', OLD.first_name,
    'last_name', OLD.last_name,
    'phone', OLD.phone,
    'email', OLD.email,
    'source', OLD.source,
    'worktype', OLD.worktype,
    'assigned_user_id', OLD.assigned_user_id
  );

  PERFORM public.fire_notification_automation_event(
    'lead_updated',
    payload,
    old_payload
  );

  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id AND NEW.assigned_user_id IS NOT NULL THEN
    PERFORM public.fire_notification_automation_event(
      'lead_assigned',
      payload,
      old_payload
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.fire_notification_automation_event(
      'lead_status_changed',
      payload,
      old_payload
    );
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM public.fire_notification_automation_event(
      'lead_stage_changed',
      payload,
      old_payload
    );
  END IF;

  IF NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold' THEN
    PERFORM public.fire_notification_automation_event(
      'lead_sold',
      payload,
      old_payload
    );
  END IF;

  pipeline_event := CASE NEW.status::text
    WHEN 'new' THEN 'lead_pipeline_new'
    WHEN 'contacting' THEN 'lead_pipeline_contacting'
    WHEN 'appointment_booked' THEN 'lead_pipeline_appointment_booked'
    WHEN 'interviewed' THEN 'lead_pipeline_interviewed'
    WHEN 'no_show' THEN 'lead_pipeline_no_show'
    WHEN 'sold' THEN 'lead_pipeline_sold'
    WHEN 'cancelled' THEN 'lead_pipeline_cancelled'
    ELSE NULL
  END;

  IF pipeline_event IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.fire_notification_automation_event(
      pipeline_event,
      payload,
      old_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Approval status notifications
CREATE OR REPLACE FUNCTION public.trigger_profile_approval_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  old_payload JSONB := '{}'::jsonb;
  v_client_id UUID;
  v_rejection_reason TEXT;
  v_reviewer_notes TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    SELECT id INTO v_client_id FROM public.clients WHERE user_id = NEW.id LIMIT 1;
    SELECT rejection_reason, reviewer_notes INTO v_rejection_reason, v_reviewer_notes
      FROM public.approval_requests WHERE user_id = NEW.id;

    payload := jsonb_build_object(
      'user_id', NEW.id,
      'client_id', v_client_id,
      'approval_status', NEW.approval_status,
      'rejection_reason', v_rejection_reason,
      'reviewer_notes', v_reviewer_notes
    );

    old_payload := jsonb_build_object(
      'user_id', OLD.id,
      'client_id', v_client_id,
      'approval_status', OLD.approval_status
    );

    PERFORM public.fire_notification_automation_event(
      'approval_status_changed',
      payload,
      old_payload
    );

    IF NEW.approval_status = 'approved' THEN
      PERFORM public.fire_notification_automation_event(
        'approval_approved',
        payload,
        old_payload
      );
    ELSIF NEW.approval_status = 'rejected' THEN
      PERFORM public.fire_notification_automation_event(
        'approval_rejected',
        payload,
        old_payload
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_approval_notify ON public.profiles;
CREATE TRIGGER trg_profiles_approval_notify
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_profile_approval_notification_event();

-- Delivery metrics
CREATE TABLE IF NOT EXISTS public.notification_delivery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'automation',
  event_type TEXT NULL,
  rule_id UUID NULL,
  source TEXT NULL,
  actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  targets INTEGER NOT NULL DEFAULT 0,
  in_app_sent INTEGER NOT NULL DEFAULT 0,
  push_sent INTEGER NOT NULL DEFAULT 0,
  push_failed INTEGER NOT NULL DEFAULT 0,
  subscriptions_disabled INTEGER NOT NULL DEFAULT 0,
  subscriptions_found INTEGER NOT NULL DEFAULT 0,
  push_skipped_reason TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_delivery_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view delivery metrics" ON public.notification_delivery_metrics;
CREATE POLICY "Super admins can view delivery metrics"
ON public.notification_delivery_metrics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Seed segmented rules (idempotent)
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
  'عدم حضور الموعد - إشعار فوري',
  'appointment_no_show',
  'warning',
  '/appointments',
  'عدم حضور للموعد',
  'تم تسجيل الموعد كعدم حضور بتاريخ {{scheduled_at}} للعميل {{lead_name}}',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'عدم حضور الموعد - إشعار فوري'
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
  'عدم حضور الموعد - متابعة بعد 48 ساعة',
  'appointment_no_show_after_48h',
  'warning',
  '/appointments',
  'متابعة عدم حضور بعد 48 ساعة',
  'مرّت 48 ساعة على عدم حضور الموعد للعميل {{lead_name}}. يرجى المتابعة.',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'عدم حضور الموعد - متابعة بعد 48 ساعة'
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
  'تعيين عميل محتمل',
  'lead_assigned',
  'info',
  '/leads',
  'تم تعيين عميل محتمل',
  'تم تعيين العميل {{lead_name}} إليك.',
  true,
  true,
  ARRAY['admin']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'تعيين عميل محتمل'
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
  'اعتماد الحساب',
  'approval_approved',
  'success',
  '/dashboard',
  'تمت الموافقة على حسابك',
  'تمت الموافقة على حسابك. يمكنك البدء الآن.',
  true,
  true,
  ARRAY['client']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'اعتماد الحساب'
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
  'رفض الحساب',
  'approval_rejected',
  'error',
  '/pending-approval',
  'تم رفض طلبك',
  'تم رفض طلبك. السبب: {{rejection_reason}}',
  true,
  true,
  ARRAY['client']::public.app_role[],
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_automation_rules WHERE name = 'رفض الحساب'
);
