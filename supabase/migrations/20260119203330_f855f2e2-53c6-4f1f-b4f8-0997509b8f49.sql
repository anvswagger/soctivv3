-- Add INSERT policy for notifications table
-- Only admins should be able to create notifications (system-generated)
CREATE POLICY "Admins can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));