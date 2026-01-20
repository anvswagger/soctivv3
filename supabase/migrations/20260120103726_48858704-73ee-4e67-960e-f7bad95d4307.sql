-- Create client_media table for storing video/image references from ImageKit
CREATE TABLE public.client_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,           -- ImageKit file ID
  file_url TEXT NOT NULL,          -- ImageKit URL
  thumbnail_url TEXT,              -- Video thumbnail from ImageKit
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'video',  -- 'video' | 'image'
  file_size BIGINT,
  source TEXT NOT NULL DEFAULT 'library',   -- 'onboarding' | 'library'
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.client_media ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Clients can view their own media
CREATE POLICY "Clients can view own media" ON public.client_media
  FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

-- Clients can insert their own media
CREATE POLICY "Clients can insert own media" ON public.client_media
  FOR INSERT WITH CHECK (client_id = public.get_user_client_id(auth.uid()));

-- Clients can update their own media
CREATE POLICY "Clients can update own media" ON public.client_media
  FOR UPDATE USING (client_id = public.get_user_client_id(auth.uid()));

-- Clients can delete their own media
CREATE POLICY "Clients can delete own media" ON public.client_media
  FOR DELETE USING (client_id = public.get_user_client_id(auth.uid()));

-- Admins can view all media
CREATE POLICY "Admins can view all media" ON public.client_media
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Admins can manage all media
CREATE POLICY "Admins can manage all media" ON public.client_media
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_client_media_updated_at
  BEFORE UPDATE ON public.client_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();