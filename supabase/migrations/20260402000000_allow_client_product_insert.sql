-- Allow clients to insert their own products (for product onboarding)
CREATE POLICY "Clients can insert own products" ON products FOR INSERT WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);
