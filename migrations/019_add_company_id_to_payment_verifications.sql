-- migrations/019_add_company_id_to_payment_verifications.sql
-- Add company_id column to payment_verifications table for multi-tenant RLS support
--
-- This migration adds the company_id foreign key column to the payment_verifications
-- table to enable Row-Level Security (RLS) policies for tenant isolation.
--
-- This migration must be applied BEFORE 020_enable_rls_payment_verifications.sql
-- (renamed from 019 to 020 to maintain proper dependency order)

BEGIN;

-- Add company_id column to payment_verifications table
ALTER TABLE payment_verifications
ADD COLUMN IF NOT EXISTS company_id UUID;

-- Add foreign key constraint to companies table
ALTER TABLE payment_verifications
ADD CONSTRAINT fk_payment_verifications_company_id
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Create index for company_id (required for RLS performance)
CREATE INDEX IF NOT EXISTS idx_payment_verifications_company_id
ON payment_verifications(company_id);

-- Add comment for documentation
COMMENT ON COLUMN payment_verifications.company_id IS 'Company identifier for multi-tenant payment verification isolation. Required for RLS policies.';

-- Migrate existing data: Set company_id based on user's company
-- This ensures all existing payment verifications are properly associated with companies
UPDATE payment_verifications pv
SET company_id = u.company_id
FROM users u
WHERE pv.user_id = u.id
AND pv.company_id IS NULL;

-- Set company_id to NOT NULL after data migration
ALTER TABLE payment_verifications
ALTER COLUMN company_id SET NOT NULL;

-- Verify the migration
SELECT
    'payment_verifications' as table_name,
    'company_id' as column_name,
    COUNT(*) as total_records,
    COUNT(company_id) as records_with_company_id,
    CASE
        WHEN COUNT(*) = COUNT(company_id) THEN 'All records migrated successfully'
        ELSE 'Some records missing company_id'
    END as migration_status
FROM payment_verifications;

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- ALTER TABLE payment_verifications DROP CONSTRAINT IF EXISTS fk_payment_verifications_company_id;
-- ALTER TABLE payment_verifications DROP COLUMN IF EXISTS company_id;
-- DROP INDEX IF EXISTS idx_payment_verifications_company_id;
-- COMMIT;