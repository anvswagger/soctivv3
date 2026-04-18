-- Add address column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;
