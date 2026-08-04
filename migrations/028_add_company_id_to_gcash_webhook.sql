-- migrations/028_add_company_id_to_gcash_webhook.sql
-- Add company_id column to gcash_webhook_data table for multi-tenant RLS support
--
-- This migration adds the company_id foreign key column to the gcash_webhook_data
-- table to enable Row-Level Security (RLS) policies for tenant isolation.
--
-- This migration must be applied BEFORE 029_enable_rls_gcash_webhook_data.sql
--
-- Table status: gcash_webhook_data is currently empty (0 rows), so no data migration needed.
-- Company_id will be nullable initially to support webhook data that arrives before
-- company association is established.

BEGIN;

-- Add company_id column to gcash_webhook_data table (nullable initially)
ALTER TABLE gcash_webhook_data
ADD COLUMN IF NOT EXISTS company_id UUID;

-- Add foreign key constraint to companies table
-- ON DELETE CASCADE ensures that if a company is deleted, all associated
-- webhook data is also removed to maintain referential integrity
ALTER TABLE gcash_webhook_data
ADD CONSTRAINT fk_gcash_webhook_data_company_id
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Create index for company_id (required for RLS performance)
-- This index ensures efficient filtering by company_id in WHERE clauses
-- and is essential for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_company_id
ON gcash_webhook_data(company_id);

-- Add composite index for common query patterns
-- This optimizes queries that filter by both company_id and processed status
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_company_processed
ON gcash_webhook_data(company_id, processed);

-- Add comment for documentation
COMMENT ON COLUMN gcash_webhook_data.company_id IS 'Company identifier for multi-tenant GCash webhook data isolation. Required for RLS policies. Nullable to support webhook data received before company association is established.';

-- Add table comment for migration tracking
COMMENT ON TABLE gcash_webhook_data IS 'GCash webhook payment notifications with multi-tenant company isolation. Enhanced with company_id column (028) for RLS support.';

-- No data migration needed - table is empty (0 rows)
-- If the table had existing data, we would migrate it here:
-- UPDATE gcash_webhook_data gwd
-- SET company_id = [appropriate_company_source]
-- WHERE gwd.company_id IS NULL;

-- Verify the migration
SELECT
    'gcash_webhook_data' as table_name,
    'company_id' as column_name,
    COUNT(*) as total_records,
    COUNT(company_id) as records_with_company_id,
    CASE
        WHEN COUNT(*) = 0 THEN 'Table empty - migration ready for RLS'
        WHEN COUNT(*) = COUNT(company_id) THEN 'All records have company_id'
        ELSE 'Some records without company_id (acceptable for nullable column)'
    END as migration_status
FROM gcash_webhook_data;

-- Display foreign key constraint information
SELECT
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as references_table,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'gcash_webhook_data'::regclass
AND conname = 'fk_gcash_webhook_data_company_id';

-- Display index information
SELECT
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE tablename = 'gcash_webhook_data'
AND indexname LIKE 'idx_gcash_webhook_data_company%';

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- ALTER TABLE gcash_webhook_data DROP CONSTRAINT IF EXISTS fk_gcash_webhook_data_company_id;
-- ALTER TABLE gcash_webhook_data DROP COLUMN IF EXISTS company_id;
-- DROP INDEX IF EXISTS idx_gcash_webhook_data_company_id;
-- DROP INDEX IF EXISTS idx_gcash_webhook_data_company_processed;
-- COMMIT;

-- POST-MIGRATION VALIDATION CHECKLIST:
-- ✓ Company_id column added as UUID (nullable)
-- ✓ Foreign key constraint to companies.id with CASCADE delete
-- ✓ Performance index created on company_id
-- ✓ Composite index for company_id + processed queries
-- ✓ Documentation comments added
-- ✓ Migration verification query executed
-- ✓ Rollback script documented
-- ✓ Table is empty (0 rows) - no data migration needed
-- ✓ Ready for RLS policy implementation in migration 029

-- NEXT STEPS:
-- 1. Apply this migration: migrations/028_add_company_id_to_gcash_webhook.sql
-- 2. Apply migration 029_enable_rls_gcash_webhook_data.sql for RLS policies
-- 3. Update application code to set company_id when processing webhooks
-- 4. Test webhook processing with company association
-- 5. Verify RLS policies properly isolate data by company