-- Add error_message column to sms_logs table
-- This column is needed to see why SMS messages failed
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
