-- Create admin_clients table for admin-to-client assignments
CREATE TABLE public.admin_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- Enable Row Level Security
ALTER TABLE public.admin_clients ENABLE ROW LEVEL SECURITY;

-- Create policies using subquery
CREATE POLICY "Super admins can view all admin_clients"
ON public.admin_clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can insert admin_clients"
ON public.admin_clients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can delete admin_clients"
ON public.admin_clients
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_admin_clients_user_id ON public.admin_clients(user_id);
CREATE INDEX idx_admin_clients_client_id ON public.admin_clients(client_id);