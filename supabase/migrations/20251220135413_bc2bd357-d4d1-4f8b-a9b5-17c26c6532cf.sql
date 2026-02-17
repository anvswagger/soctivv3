CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add webhook_code column to clients table
ALTER TABLE public.clients 
ADD COLUMN webhook_code TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Update existing clients with unique webhook codes
UPDATE public.clients 
SET webhook_code = replace(gen_random_uuid()::text, '-', '') 
WHERE webhook_code IS NULL;

-- Make webhook_code NOT NULL after populating
ALTER TABLE public.clients 
ALTER COLUMN webhook_code SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX idx_clients_webhook_code ON public.clients(webhook_code);
