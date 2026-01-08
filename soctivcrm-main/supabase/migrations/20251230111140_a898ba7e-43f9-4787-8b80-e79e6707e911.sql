-- Add phone column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone text;

-- Create appointment_reminders table to track sent reminders
CREATE TABLE public.appointment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('24h', '6h', '1h')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sms_log_id UUID REFERENCES public.sms_logs(id),
  error_message text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for appointment_reminders
CREATE POLICY "Admins can manage all reminders"
ON public.appointment_reminders
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view all reminders"
ON public.appointment_reminders
FOR SELECT
USING (is_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_appointment_reminders_appointment_id ON public.appointment_reminders(appointment_id);
CREATE INDEX idx_appointment_reminders_reminder_type ON public.appointment_reminders(reminder_type);

-- Add unique constraint to prevent duplicate reminders
CREATE UNIQUE INDEX idx_unique_reminder ON public.appointment_reminders(appointment_id, reminder_type);