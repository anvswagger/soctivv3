-- Backfill support for appointment_start_time on projects that missed earlier schema migrations.

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
      'appointment_start_time',
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
