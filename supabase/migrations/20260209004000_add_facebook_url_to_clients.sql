-- Clients onboarding + profile UI expects this column.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS facebook_url text;

