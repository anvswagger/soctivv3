-- 001: product_marketing_assets table
-- Stores auto-generated marketing content per product

CREATE TABLE IF NOT EXISTS product_marketing_assets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending',   -- pending | generating | completed | failed
  landing_html     TEXT,                               -- generated landing page HTML
  ad_copies        JSONB,                              -- array of 5 ad variations
  error_message    TEXT,
  generated_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_marketing_assets_product_id
  ON product_marketing_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_marketing_assets_status
  ON product_marketing_assets(status);
CREATE INDEX IF NOT EXISTS idx_product_marketing_assets_client_id
  ON product_marketing_assets(client_id);
ALTER TABLE product_marketing_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Product marketing assets viewable by authenticated" ON product_marketing_assets;
CREATE POLICY "Product marketing assets viewable by authenticated"
  ON product_marketing_assets FOR SELECT
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Product marketing assets insertable by service" ON product_marketing_assets;
CREATE POLICY "Product marketing assets insertable by service"
  ON product_marketing_assets FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Product marketing assets updatable by service" ON product_marketing_assets;
CREATE POLICY "Product marketing assets updatable by service"
  ON product_marketing_assets FOR UPDATE
  USING (true);
DROP POLICY IF EXISTS "Product marketing assets deletable by admins" ON product_marketing_assets;
CREATE POLICY "Product marketing assets deletable by admins"
  ON product_marketing_assets FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
GRANT ALL ON product_marketing_assets TO authenticated;
GRANT ALL ON product_marketing_assets TO service_role;
