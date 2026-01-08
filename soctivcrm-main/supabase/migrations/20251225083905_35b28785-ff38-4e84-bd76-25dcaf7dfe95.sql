-- Add first_contact_at column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_contact_at timestamp with time zone;

-- Create user_gold_points table for gamification
CREATE TABLE IF NOT EXISTS public.user_gold_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 1,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, lead_id)
);

-- Enable RLS
ALTER TABLE public.user_gold_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_gold_points
CREATE POLICY "Users can view own gold points"
  ON public.user_gold_points
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own gold points"
  ON public.user_gold_points
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all gold points"
  ON public.user_gold_points
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_gold_points_user_id ON public.user_gold_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gold_points_earned_at ON public.user_gold_points(earned_at);