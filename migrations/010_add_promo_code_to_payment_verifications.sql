-- Migration: 010_add_promo_code_to_payment_verifications.sql
-- Description: Add promo_code field to payment_verifications table to track promo codes used in payments
-- Version: 1.0
-- Author: Concetto WC Development Team

BEGIN;

-- Add promo_code column to payment_verifications
ALTER TABLE payment_verifications
ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50);

-- Add index for efficient queries on promo codes
CREATE INDEX IF NOT EXISTS idx_payment_verifications_promo_code
ON payment_verifications(promo_code)
WHERE promo_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN payment_verifications.promo_code IS 'Promo code used for this payment verification, if any';

-- Verification query
SELECT
    'payment_verifications' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_verifications'
AND column_name = 'promo_code';

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_payment_verifications_promo_code;
-- ALTER TABLE payment_verifications DROP COLUMN IF EXISTS promo_code;
-- COMMIT;