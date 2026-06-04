-- 002: product_marketing_queue table
-- Async work queue for processing product marketing generation

CREATE TABLE IF NOT EXISTS product_marketing_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | done | failed
  retries      INTEGER NOT NULL DEFAULT 0,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_marketing_queue_product_id
  ON product_marketing_queue(product_id);
CREATE INDEX IF NOT EXISTS idx_product_marketing_queue_status
  ON product_marketing_queue(status);
CREATE INDEX IF NOT EXISTS idx_product_marketing_queue_created_at
  ON product_marketing_queue(created_at);
ALTER TABLE product_marketing_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Product marketing queue viewable by service" ON product_marketing_queue;
CREATE POLICY "Product marketing queue viewable by service"
  ON product_marketing_queue FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Product marketing queue insertable by service" ON product_marketing_queue;
CREATE POLICY "Product marketing queue insertable by service"
  ON product_marketing_queue FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Product marketing queue updatable by service" ON product_marketing_queue;
CREATE POLICY "Product marketing queue updatable by service"
  ON product_marketing_queue FOR UPDATE
  USING (true);
GRANT ALL ON product_marketing_queue TO service_role;
