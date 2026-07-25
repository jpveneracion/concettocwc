-- Rollback Migration 008: Revert from billing period-based to tier-based QR code columns
-- This rollback restores the original tier-based column naming scheme

-- Step 1: Add back old tier-based columns
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS gcash_basic_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gcash_pro_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gcash_premium_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_basic_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_pro_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_premium_qr_url TEXT;

-- Step 2: Migrate data back from period-based to tier-based columns
UPDATE payment_settings
SET
  gcash_basic_qr_url = gcash_monthly_qr_url,
  gcash_pro_qr_url = gcash_quarterly_qr_url,
  gcash_premium_qr_url = gcash_annual_qr_url,
  gotyme_basic_qr_url = gotyme_monthly_qr_url,
  gotyme_pro_qr_url = gotyme_quarterly_qr_url,
  gotyme_premium_qr_url = gotyme_annual_qr_url
WHERE
  gcash_monthly_qr_url IS NOT NULL OR
  gcash_quarterly_qr_url IS NOT NULL OR
  gcash_annual_qr_url IS NOT NULL OR
  gotyme_monthly_qr_url IS NOT NULL OR
  gotyme_quarterly_qr_url IS NOT NULL OR
  gotyme_annual_qr_url IS NOT NULL;

-- Step 3: Drop period-based columns
ALTER TABLE payment_settings
DROP COLUMN IF EXISTS gcash_monthly_qr_url,
DROP COLUMN IF EXISTS gcash_quarterly_qr_url,
DROP COLUMN IF EXISTS gcash_annual_qr_url,
DROP COLUMN IF EXISTS gotyme_monthly_qr_url,
DROP COLUMN IF EXISTS gotyme_quarterly_qr_url,
DROP COLUMN IF EXISTS gotyme_annual_qr_url;

-- Add comment to document the rollback
COMMENT ON TABLE payment_settings IS 'Payment settings including QR codes organized by plan tier (basic, pro, premium)';
