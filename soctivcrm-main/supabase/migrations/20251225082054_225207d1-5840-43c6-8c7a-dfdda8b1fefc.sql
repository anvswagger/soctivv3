-- First update existing leads to use new status values
UPDATE public.leads SET status = 'new' WHERE status = 'new';
UPDATE public.leads SET status = 'new' WHERE status = 'contacted';
UPDATE public.leads SET status = 'new' WHERE status = 'qualified';
UPDATE public.leads SET status = 'new' WHERE status = 'converted';
UPDATE public.leads SET status = 'new' WHERE status = 'lost';

-- Drop existing enum and create new one with all stages
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.leads ALTER COLUMN status TYPE text;

DROP TYPE IF EXISTS public.lead_status;

CREATE TYPE public.lead_status AS ENUM (
  'new',
  'contacting', 
  'appointment_booked',
  'interviewed',
  'no_show',
  'sold',
  'cancelled'
);

ALTER TABLE public.leads 
  ALTER COLUMN status TYPE public.lead_status 
  USING status::public.lead_status;

ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'new'::public.lead_status;