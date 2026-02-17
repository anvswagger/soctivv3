-- Add api_message_id and cost columns to sms_logs table
-- These are used to track details returned by the SMS provider
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS api_message_id TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS cost NUMERIC;

