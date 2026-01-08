-- Create enums
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.sms_status AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  source TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sms_templates table
CREATE TABLE public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sms_logs table
CREATE TABLE public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.sms_templates(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status public.sms_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create helper function for client ownership
CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clients WHERE user_id = _user_id LIMIT 1
$$;

-- Clients RLS Policies
CREATE POLICY "Users can view own client profile" ON public.clients
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own client profile" ON public.clients
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client profile" ON public.clients
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients" ON public.clients
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all clients" ON public.clients
FOR ALL USING (public.is_admin(auth.uid()));

-- Leads RLS Policies
CREATE POLICY "Clients can view own leads" ON public.leads
FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Clients can insert own leads" ON public.leads
FOR INSERT WITH CHECK (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Clients can update own leads" ON public.leads
FOR UPDATE USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Clients can delete own leads" ON public.leads
FOR DELETE USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Admins can view all leads" ON public.leads
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all leads" ON public.leads
FOR ALL USING (public.is_admin(auth.uid()));

-- Appointments RLS Policies
CREATE POLICY "Clients can view own appointments" ON public.appointments
FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Clients can insert own appointments" ON public.appointments
FOR INSERT WITH CHECK (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Clients can update own appointments" ON public.appointments
FOR UPDATE USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Clients can delete own appointments" ON public.appointments
FOR DELETE USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Admins can view all appointments" ON public.appointments
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all appointments" ON public.appointments
FOR ALL USING (public.is_admin(auth.uid()));

-- SMS Templates RLS Policies
CREATE POLICY "Anyone can view system templates" ON public.sms_templates
FOR SELECT USING (is_system = true);

CREATE POLICY "Users can view own templates" ON public.sms_templates
FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert own templates" ON public.sms_templates
FOR INSERT WITH CHECK (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can update own templates" ON public.sms_templates
FOR UPDATE USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own templates" ON public.sms_templates
FOR DELETE USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Admins can manage all templates" ON public.sms_templates
FOR ALL USING (public.is_admin(auth.uid()));

-- SMS Logs RLS Policies
CREATE POLICY "Users can view own sms logs" ON public.sms_logs
FOR SELECT USING (sent_by = auth.uid());

CREATE POLICY "Clients can view their leads sms logs" ON public.sms_logs
FOR SELECT USING (
  lead_id IN (SELECT id FROM public.leads WHERE client_id = public.get_user_client_id(auth.uid()))
);

CREATE POLICY "Users can insert sms logs" ON public.sms_logs
FOR INSERT WITH CHECK (sent_by = auth.uid());

CREATE POLICY "Admins can view all sms logs" ON public.sms_logs
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all sms logs" ON public.sms_logs
FOR ALL USING (public.is_admin(auth.uid()));

-- Notifications RLS Policies
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON public.notifications
FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_templates_updated_at
BEFORE UPDATE ON public.sms_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;