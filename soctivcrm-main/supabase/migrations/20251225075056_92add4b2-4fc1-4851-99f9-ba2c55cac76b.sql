-- Add worktype and stage columns to leads table
ALTER TABLE public.leads ADD COLUMN worktype text;
ALTER TABLE public.leads ADD COLUMN stage text;