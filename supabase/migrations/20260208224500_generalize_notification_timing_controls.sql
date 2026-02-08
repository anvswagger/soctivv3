-- Generalize IF timing controls: before/after with configurable duration,
-- and add an explicit "appointment_start_time" event.

ALTER TABLE public.notification_automation_rules
  ADD COLUMN IF NOT EXISTS timing_mode TEXT NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS timing_value INTEGER NULL,
  ADD COLUMN IF NOT EXISTS timing_unit TEXT NULL,
  ADD COLUMN IF NOT EXISTS timing_anchor TEXT NOT NULL DEFAULT 'event_time';

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_event_type_check;

-- Migrate legacy fixed timer events into generalized timing controls.
UPDATE public.notification_automation_rules
SET
  event_type = 'appointment_start_time',
  timing_mode = 'after',
  timing_value = 1,
  timing_unit = 'hours',
  timing_anchor = 'appointment_start'
WHERE event_type = 'appointment_after_1h';

UPDATE public.notification_automation_rules
SET
  event_type = 'appointment_no_show',
  timing_mode = 'after',
  timing_value = 48,
  timing_unit = 'hours',
  timing_anchor = 'no_show_time'
WHERE event_type = 'appointment_no_show_after_48h';

-- If start-time event has no anchor configured, normalize it.
UPDATE public.notification_automation_rules
SET timing_anchor = 'appointment_start'
WHERE event_type = 'appointment_start_time'
  AND timing_anchor = 'event_time';

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
      'appointment_start_time',
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
      'lead_pipeline_cancelled'
    )
  );

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_timing_mode_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_timing_mode_check
  CHECK (timing_mode IN ('immediate', 'before', 'after'));

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_timing_unit_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_timing_unit_check
  CHECK (timing_unit IS NULL OR timing_unit IN ('minutes', 'hours', 'days'));

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_timing_anchor_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_timing_anchor_check
  CHECK (timing_anchor IN ('event_time', 'appointment_start', 'no_show_time'));

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_timing_value_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_timing_value_check
  CHECK (timing_value IS NULL OR timing_value > 0);

ALTER TABLE public.notification_automation_rules
  DROP CONSTRAINT IF EXISTS notification_automation_rules_timing_consistency_check;

ALTER TABLE public.notification_automation_rules
  ADD CONSTRAINT notification_automation_rules_timing_consistency_check
  CHECK (
    (
      timing_mode = 'immediate'
      AND timing_value IS NULL
      AND timing_unit IS NULL
    )
    OR (
      timing_mode IN ('before', 'after')
      AND timing_value IS NOT NULL
      AND timing_unit IS NOT NULL
    )
  );

-- Generic timer runner for "before/after" timing controls.
-- Uses event_type='rule:<rule_id>' in dispatch markers to guarantee one fire per rule+entity+due_time.
CREATE OR REPLACE FUNCTION public.run_notification_automation_timers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule_row RECORD;
  appt RECORD;
  due_at TIMESTAMP WITH TIME ZONE;
  interval_value INTERVAL;
  marker_key TEXT;
  marker_event_type TEXT;
  dispatched_count INTEGER := 0;
BEGIN
  FOR rule_row IN
    SELECT
      id,
      event_type,
      timing_mode,
      timing_value,
      timing_unit,
      timing_anchor,
      created_at
    FROM public.notification_automation_rules
    WHERE enabled = true
      AND (
        (event_type = 'appointment_start_time' AND timing_anchor = 'appointment_start')
        OR (event_type = 'appointment_no_show' AND timing_anchor = 'no_show_time' AND timing_mode IN ('before', 'after'))
      )
  LOOP
    interval_value := CASE
      WHEN rule_row.timing_mode = 'immediate' THEN interval '0'
      WHEN rule_row.timing_unit = 'minutes' THEN make_interval(mins => rule_row.timing_value)
      WHEN rule_row.timing_unit = 'hours' THEN make_interval(hours => rule_row.timing_value)
      WHEN rule_row.timing_unit = 'days' THEN make_interval(days => rule_row.timing_value)
      ELSE interval '0'
    END;

    marker_event_type := 'rule:' || rule_row.id::text;

    IF rule_row.event_type = 'appointment_start_time' THEN
      FOR appt IN
        SELECT
          a.id AS appointment_id,
          a.client_id,
          a.lead_id,
          a.scheduled_at,
          a.status,
          a.duration_minutes,
          a.location,
          a.notes,
          l.first_name,
          l.last_name,
          l.stage,
          l.source,
          l.phone,
          l.email,
          l.status AS lead_status
        FROM public.appointments a
        LEFT JOIN public.leads l ON l.id = a.lead_id
        WHERE a.scheduled_at IS NOT NULL
          AND a.status IN ('scheduled', 'completed', 'no_show')
      LOOP
        due_at := CASE
          WHEN rule_row.timing_mode = 'before' THEN appt.scheduled_at - interval_value
          WHEN rule_row.timing_mode = 'after' THEN appt.scheduled_at + interval_value
          ELSE appt.scheduled_at
        END;

        IF due_at > now() OR due_at < rule_row.created_at THEN
          CONTINUE;
        END IF;

        marker_key := to_char(
          (due_at AT TIME ZONE 'UTC'),
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        );

        INSERT INTO public.notification_automation_event_dispatches (
          event_type,
          entity_type,
          entity_id,
          event_key
        )
        VALUES (
          marker_event_type,
          'appointment',
          appt.appointment_id,
          marker_key
        )
        ON CONFLICT (event_type, entity_type, entity_id, event_key) DO NOTHING;

        IF FOUND THEN
          PERFORM public.fire_notification_automation_event(
            'appointment_start_time',
            jsonb_build_object(
              'automation_rule_id', rule_row.id,
              'appointment_id', appt.appointment_id,
              'client_id', appt.client_id,
              'lead_id', appt.lead_id,
              'scheduled_at', appt.scheduled_at,
              'status', appt.status,
              'duration_minutes', appt.duration_minutes,
              'location', appt.location,
              'notes', appt.notes,
              'first_name', appt.first_name,
              'last_name', appt.last_name,
              'stage', appt.stage,
              'source', appt.source,
              'phone', appt.phone,
              'email', appt.email,
              'lead_status', appt.lead_status,
              'timer_due_at', due_at,
              'timer_mode', rule_row.timing_mode,
              'timer_value', rule_row.timing_value,
              'timer_unit', rule_row.timing_unit,
              'timer_anchor', rule_row.timing_anchor
            ),
            '{}'::jsonb
          );

          dispatched_count := dispatched_count + 1;
        END IF;
      END LOOP;
    ELSIF rule_row.event_type = 'appointment_no_show' THEN
      FOR appt IN
        SELECT
          a.id AS appointment_id,
          a.client_id,
          a.lead_id,
          a.scheduled_at,
          a.status,
          a.duration_minutes,
          a.location,
          a.notes,
          m.no_show_at,
          l.first_name,
          l.last_name,
          l.stage,
          l.source,
          l.phone,
          l.email,
          l.status AS lead_status
        FROM public.notification_appointment_no_show_markers m
        JOIN public.appointments a ON a.id = m.appointment_id
        LEFT JOIN public.leads l ON l.id = a.lead_id
        WHERE m.no_show_at IS NOT NULL
          AND a.status = 'no_show'
      LOOP
        due_at := CASE
          WHEN rule_row.timing_mode = 'before' THEN appt.no_show_at - interval_value
          WHEN rule_row.timing_mode = 'after' THEN appt.no_show_at + interval_value
          ELSE appt.no_show_at
        END;

        IF due_at > now() OR due_at < rule_row.created_at THEN
          CONTINUE;
        END IF;

        marker_key := to_char(
          (due_at AT TIME ZONE 'UTC'),
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        );

        INSERT INTO public.notification_automation_event_dispatches (
          event_type,
          entity_type,
          entity_id,
          event_key
        )
        VALUES (
          marker_event_type,
          'appointment',
          appt.appointment_id,
          marker_key
        )
        ON CONFLICT (event_type, entity_type, entity_id, event_key) DO NOTHING;

        IF FOUND THEN
          PERFORM public.fire_notification_automation_event(
            'appointment_no_show',
            jsonb_build_object(
              'automation_rule_id', rule_row.id,
              'appointment_id', appt.appointment_id,
              'client_id', appt.client_id,
              'lead_id', appt.lead_id,
              'scheduled_at', appt.scheduled_at,
              'status', appt.status,
              'duration_minutes', appt.duration_minutes,
              'location', appt.location,
              'notes', appt.notes,
              'no_show_at', appt.no_show_at,
              'first_name', appt.first_name,
              'last_name', appt.last_name,
              'stage', appt.stage,
              'source', appt.source,
              'phone', appt.phone,
              'email', appt.email,
              'lead_status', appt.lead_status,
              'timer_due_at', due_at,
              'timer_mode', rule_row.timing_mode,
              'timer_value', rule_row.timing_value,
              'timer_unit', rule_row.timing_unit,
              'timer_anchor', rule_row.timing_anchor
            ),
            '{}'::jsonb
          );

          dispatched_count := dispatched_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN dispatched_count;
END;
$$;

-- Optional default rule for appointment start time.
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
  timing_mode,
  timing_value,
  timing_unit,
  timing_anchor,
  enabled
)
SELECT
  'بدء وقت الموعد - فريق العميل',
  'appointment_start_time',
  'info',
  '/appointments',
  'بدأ وقت الموعد',
  'بدأ الآن موعد العميل {{lead_name}} في {{scheduled_at}}',
  true,
  true,
  ARRAY['client','admin']::public.app_role[],
  true,
  'immediate',
  NULL,
  NULL,
  'appointment_start',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_automation_rules
  WHERE name = 'بدء وقت الموعد - فريق العميل'
);
