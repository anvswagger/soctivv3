
CREATE TABLE IF NOT EXISTS public.vault_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Make this migration idempotent if earlier migrations already created the trigger/policies.
DROP TRIGGER IF EXISTS update_vault_items_updated_at ON public.vault_items;

CREATE TRIGGER update_vault_items_updated_at
BEFORE UPDATE ON public.vault_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Admins can manage all vault items" ON public.vault_items;
DROP POLICY IF EXISTS "Admins can view all vault items" ON public.vault_items;
DROP POLICY IF EXISTS "Clients can view own vault items" ON public.vault_items;
DROP POLICY IF EXISTS "Clients can insert own vault items" ON public.vault_items;
DROP POLICY IF EXISTS "Clients can update own vault items" ON public.vault_items;
DROP POLICY IF EXISTS "Clients can delete own vault items" ON public.vault_items;

-- Admins can do everything
CREATE POLICY "Admins can manage all vault items" ON public.vault_items
FOR ALL USING (public.is_admin(auth.uid()));

-- Admins can view all
CREATE POLICY "Admins can view all vault items" ON public.vault_items
FOR SELECT USING (public.is_admin(auth.uid()));

-- Clients can view their own
CREATE POLICY "Clients can view own vault items" ON public.vault_items
FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

-- Clients can insert their own
CREATE POLICY "Clients can insert own vault items" ON public.vault_items
FOR INSERT WITH CHECK (client_id = public.get_user_client_id(auth.uid()));

-- Clients can update their own
CREATE POLICY "Clients can update own vault items" ON public.vault_items
FOR UPDATE USING (client_id = public.get_user_client_id(auth.uid()));

-- Clients can delete their own
CREATE POLICY "Clients can delete own vault items" ON public.vault_items
FOR DELETE USING (client_id = public.get_user_client_id(auth.uid()));
