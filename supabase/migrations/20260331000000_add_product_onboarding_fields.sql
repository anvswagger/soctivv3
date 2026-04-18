-- Add product onboarding fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_rate DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer TEXT;
