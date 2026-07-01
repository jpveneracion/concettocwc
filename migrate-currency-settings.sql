-- Add Currency Settings to Companies Table
-- Run this in Neon's SQL Editor

-- Add currency column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'PHP';

-- Set default currency for existing companies
UPDATE companies SET currency = 'PHP' WHERE currency IS NULL;

-- Migration complete!
-- Default currency: Philippine Peso (PHP)
-- Supported currencies: USD, EUR, GBP, JPY, AUD, CAD, PHP, etc.
