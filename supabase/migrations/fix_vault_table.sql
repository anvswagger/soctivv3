-- Create vault_items table
CREATE TABLE public.vault_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Create helper function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vault_items_updated_at
  BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies
-- Admins can view all vault items
CREATE POLICY "Admins can view all vault items" ON public.vault_items
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Admins can manage all vault items
CREATE POLICY "Admins can manage all vault items" ON public.vault_items
  FOR ALL USING (public.is_admin(auth.uid()));

-- Clients can view their own vault items
CREATE POLICY "Clients can view own vault items" ON public.vault_items
  FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

-- Clients cannot modify vault items (read-only for now, can change if requested)
-- If clients should be able to manage their own vault items:
-- CREATE POLICY "Clients can manage own vault items" ON public.vault_items
--   FOR ALL USING (client_id = public.get_user_client_id(auth.uid()));
