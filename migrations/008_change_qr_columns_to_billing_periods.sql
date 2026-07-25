-- Migration 008: Change QR code columns from tier-based to billing period-based
-- This migration fixes the incorrect naming scheme where QR codes were stored
-- by plan tier (basic, pro, premium) instead of billing period (monthly, quarterly, annual)

-- Step 1: Add new billing period columns
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS gcash_monthly_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gcash_quarterly_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gcash_annual_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_monthly_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_quarterly_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_annual_qr_url TEXT;

-- Step 2: Migrate data from old tier-based columns to new period-based columns
-- Note: This is a lossy migration since we're mapping from 3 tiers to 3 periods
-- Any existing data will be migrated, but the semantic meaning changes
UPDATE payment_settings
SET
  gcash_monthly_qr_url = gcash_basic_qr_url,
  gcash_quarterly_qr_url = gcash_pro_qr_url,
  gcash_annual_qr_url = gcash_premium_qr_url,
  gotyme_monthly_qr_url = gotyme_basic_qr_url,
  gotyme_quarterly_qr_url = gotyme_pro_qr_url,
  gotyme_annual_qr_url = gotyme_premium_qr_url
WHERE
  gcash_basic_qr_url IS NOT NULL OR
  gcash_pro_qr_url IS NOT NULL OR
  gcash_premium_qr_url IS NOT NULL OR
  gotyme_basic_qr_url IS NOT NULL OR
  gotyme_pro_qr_url IS NOT NULL OR
  gotyme_premium_qr_url IS NOT NULL;

-- Step 3: Drop old tier-based columns
ALTER TABLE payment_settings
DROP COLUMN IF EXISTS gcash_basic_qr_url,
DROP COLUMN IF EXISTS gcash_pro_qr_url,
DROP COLUMN IF EXISTS gcash_premium_qr_url,
DROP COLUMN IF EXISTS gotyme_basic_qr_url,
DROP COLUMN IF EXISTS gotyme_pro_qr_url,
DROP COLUMN IF EXISTS gotyme_premium_qr_url;

-- Add comment to document the change
COMMENT ON TABLE payment_settings IS 'Payment settings including QR codes organized by billing period (monthly, quarterly, annual)';
