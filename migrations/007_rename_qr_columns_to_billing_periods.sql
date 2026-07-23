-- Migration: Rename QR code columns from plan tiers to billing periods
-- Description: Complete the migration from basic/pro/premium to monthly/quarterly/annual naming
-- This removes the dual naming scheme and aligns database schema with current business logic

BEGIN;

-- Step 1: Rename GCash QR code columns
ALTER TABLE payment_settings RENAME COLUMN gcash_basic_qr_url TO gcash_monthly_qr_url;
ALTER TABLE payment_settings RENAME COLUMN gcash_pro_qr_url TO gcash_quarterly_qr_url;
ALTER TABLE payment_settings RENAME COLUMN gcash_premium_qr_url TO gcash_annual_qr_url;

-- Step 2: Rename GoTyme QR code columns
ALTER TABLE payment_settings RENAME COLUMN gotyme_basic_qr_url TO gotyme_monthly_qr_url;
ALTER TABLE payment_settings RENAME COLUMN gotyme_pro_qr_url TO gotyme_quarterly_qr_url;
ALTER TABLE payment_settings RENAME COLUMN gotyme_premium_qr_url TO gotyme_annual_qr_url;

-- Step 3: Update comments to reflect new naming convention
COMMENT ON COLUMN payment_settings.gcash_monthly_qr_url IS 'GCash QR code URL for monthly subscription plans';
COMMENT ON COLUMN payment_settings.gcash_quarterly_qr_url IS 'GCash QR code URL for quarterly subscription plans';
COMMENT ON COLUMN payment_settings.gcash_annual_qr_url IS 'GCash QR code URL for annual subscription plans';

COMMENT ON COLUMN payment_settings.gotyme_monthly_qr_url IS 'GoTyme QR code URL for monthly subscription plans';
COMMENT ON COLUMN payment_settings.gotyme_quarterly_qr_url IS 'GoTyme QR code URL for quarterly subscription plans';
COMMENT ON COLUMN payment_settings.gotyme_annual_qr_url IS 'GoTyme QR code URL for annual subscription plans';

-- Step 4: Verify the changes
SELECT
  payment_method,
  gcash_monthly_qr_url,
  gcash_quarterly_qr_url,
  gcash_annual_qr_url,
  gotyme_monthly_qr_url,
  gotyme_quarterly_qr_url,
  gotyme_annual_qr_url
FROM payment_settings;

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- ALTER TABLE payment_settings RENAME COLUMN gcash_monthly_qr_url TO gcash_basic_qr_url;
-- ALTER TABLE payment_settings RENAME COLUMN gcash_quarterly_qr_url TO gcash_pro_qr_url;
-- ALTER TABLE payment_settings RENAME COLUMN gcash_annual_qr_url TO gcash_premium_qr_url;
-- ALTER TABLE payment_settings RENAME COLUMN gotyme_monthly_qr_url TO gotyme_basic_qr_url;
-- ALTER TABLE payment_settings RENAME COLUMN gotyme_quarterly_qr_url TO gotyme_pro_qr_url;
-- ALTER TABLE payment_settings RENAME COLUMN gotyme_annual_qr_url TO gotyme_premium_qr_url;
-- COMMIT;