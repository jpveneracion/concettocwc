-- migrations/002_fix_payment_verifications_plan_id_type.sql
-- Fix data type mismatch for payment_verifications.plan_id
-- Changes from VARCHAR(255) to UUID to match subscription_plans.id
-- Resolves JOIN operation errors: "operator does not exist: character varying = uuid"

BEGIN;

-- Step 1: Add a temporary UUID column to safely convert existing data
ALTER TABLE payment_verifications ADD COLUMN plan_id_new UUID;

-- Step 2: Migrate existing data from VARCHAR to UUID
-- This will only convert valid UUID strings, setting others to NULL
UPDATE payment_verifications
SET plan_id_new = plan_id::UUID
WHERE plan_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: Drop the old VARCHAR column
ALTER TABLE payment_verifications DROP COLUMN plan_id;

-- Step 4: Rename the new UUID column to plan_id
ALTER TABLE payment_verifications RENAME COLUMN plan_id_new TO plan_id;

-- Step 5: Set NOT NULL constraint on the new plan_id column
ALTER TABLE payment_verifications ALTER COLUMN plan_id SET NOT NULL;

-- Step 6: Re-create the index on plan_id for efficient queries
DROP INDEX IF EXISTS idx_payment_verifications_plan_id;
CREATE INDEX idx_payment_verifications_plan_id ON payment_verifications(plan_id);

-- Step 7: Add foreign key constraint to subscription_plans table
ALTER TABLE payment_verifications
ADD CONSTRAINT fk_payment_verifications_plan_id
FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN payment_verifications.plan_id IS 'UUID reference to subscription_plans table';

COMMIT;