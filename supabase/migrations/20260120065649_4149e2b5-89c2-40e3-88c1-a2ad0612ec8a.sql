-- Add onboarding columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS specialty text,
ADD COLUMN IF NOT EXISTS work_area text,
ADD COLUMN IF NOT EXISTS strength text,
ADD COLUMN IF NOT EXISTS min_contract_value text,
ADD COLUMN IF NOT EXISTS headquarters text,
ADD COLUMN IF NOT EXISTS achievements text,
ADD COLUMN IF NOT EXISTS promotional_offer text;