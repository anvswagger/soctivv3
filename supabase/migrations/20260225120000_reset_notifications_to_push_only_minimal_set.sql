-- Reset notification templates and keep only the requested automation rules (push only).

BEGIN;

-- Remove all saved manual notification templates.
DELETE FROM public.notification_templates;

-- Keep only the requested automation notifications by recreating the rule set.
DELETE FROM public.notification_automation_rules;

INSERT INTO public.notification_automation_rules (
  name,
  event_type,
  enabled,
  notification_type,
  url,
  title_template,
  message_template,
  send_push,
  send_in_app,
  target_roles,
  only_event_client,
  timing_mode,
  timing_value,
  timing_unit,
  timing_anchor
)
VALUES
  (
    'lead_created_admins_push_only',
    'lead_created',
    true,
    'info',
    '/leads',
    'تمت إضافة عميل محتمل جديد',
    'تمت إضافة العميل المحتمل {{lead_name}}',
    true,
    false,
    ARRAY['admin','super_admin']::public.app_role[],
    true,
    'immediate',
    NULL,
    NULL,
    'event_time'
  ),
  (
    'appointment_created_client_push_only',
    'appointment_created',
    true,
    'info',
    '/appointments',
    'تمت إضافة موعد جديد',
    'تمت إضافة موعد جديد {{scheduled_at_display}}',
    true,
    false,
    ARRAY['client']::public.app_role[],
    true,
    'immediate',
    NULL,
    NULL,
    'event_time'
  ),
  (
    'appointment_1h_before_admins_clients_push_only',
    'appointment_start_time',
    true,
    'info',
    '/appointments',
    'تذكير بالموعد بعد ساعة',
    'باقي ساعة على موعد {{lead_name}} {{scheduled_at_display}}',
    true,
    false,
    ARRAY['client','admin','super_admin']::public.app_role[],
    true,
    'before',
    1,
    'hours',
    'appointment_start'
  );

COMMIT;
