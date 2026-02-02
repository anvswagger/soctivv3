-- Add error_message column to sms_logs table to track failure reasons from SMS providers
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_logs' AND column_name = 'error_message') THEN
    ALTER TABLE public.sms_logs ADD COLUMN error_message TEXT;
  END IF;
END $$;
