-- Migration: 006_add_configurable_term_discounts.sql
-- Description: Add configurable term discount rates to payment_settings
-- Version: 1.0
-- Author: Concetto WC Development Team

BEGIN;

-- Add configurable term discount rates to payment_settings
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS quarterly_discount_percent DECIMAL(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS annual_discount_percent DECIMAL(5,2) DEFAULT 8.00;

-- Add validation constraint to prevent excessive discounts
ALTER TABLE payment_settings
ADD CONSTRAINT check_quarterly_discount_valid
  CHECK (quarterly_discount_percent >= 0 AND quarterly_discount_percent <= 33.33),
ADD CONSTRAINT check_annual_discount_valid
  CHECK (annual_discount_percent >= 0 AND annual_discount_percent <= 8.33);

-- Add comments for documentation
COMMENT ON COLUMN payment_settings.quarterly_discount_percent IS
  'Discount percentage PER MONTH for quarterly payments (3+ months). Rate is multiplied by months to get total discount. Max safe value: 33.33% (100% total / 3 months)';
COMMENT ON COLUMN payment_settings.annual_discount_percent IS
  'Discount percentage PER MONTH for annual payments (12 months). Rate is multiplied by months to get total discount. Max safe value: 8.33% (100% total / 12 months)';

COMMIT;