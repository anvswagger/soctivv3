-- Create call_logs table to track phone call activities
CREATE TABLE public.call_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    status text NOT NULL,
    duration integer NOT NULL DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for call_logs
-- Users can only see their own call logs
CREATE POLICY "Users can view their own call logs"
ON public.call_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own call logs
CREATE POLICY "Users can insert their own call logs"
ON public.call_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own call logs
CREATE POLICY "Users can update their own call logs"
ON public.call_logs
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all call logs
CREATE POLICY "Admins can view all call logs"
ON public.call_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);

-- Create indexes for better performance
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);
CREATE INDEX idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_client_id ON public.call_logs(client_id);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);