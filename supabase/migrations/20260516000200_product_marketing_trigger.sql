-- 003: Trigger to enqueue product marketing after a product is inserted

CREATE OR REPLACE FUNCTION enqueue_product_marketing()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_marketing_queue (product_id, client_id)
  VALUES (NEW.id, NEW.client_id)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_enqueue_product_marketing ON products;
CREATE TRIGGER trg_enqueue_product_marketing
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_product_marketing();
