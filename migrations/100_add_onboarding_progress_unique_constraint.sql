-- Migration: 100_add_onboarding_progress_unique_constraint.sql
-- Description: Add unique constraint on (user_id, onboarding_type) to prevent duplicates and enable proper ON CONFLICT upserts
-- Date: 2026-08-12
-- Reason: The API route /api/auth/me/onboarding uses ON CONFLICT (user_id, onboarding_type) but no unique constraint exists

BEGIN;

-- Add unique constraint to ensure one record per user per onboarding type
-- This enables the ON CONFLICT clause in the API to work correctly for upserts
ALTER TABLE onboarding_progress
ADD CONSTRAINT unique_user_onboarding UNIQUE (user_id, onboarding_type);

-- Clean up any existing duplicates that may have been created before this constraint
-- Keep the most recent record for each user/onboarding_type pair (based on created_at)
-- Note: max(id) is invalid for UUIDs; DISTINCT ON is used instead
DELETE FROM onboarding_progress o
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, onboarding_type) id
    FROM onboarding_progress
    ORDER BY user_id, onboarding_type, created_at DESC
);

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- ALTER TABLE onboarding_progress DROP CONSTRAINT IF EXISTS unique_user_onboarding;
-- COMMIT;
