-- Migration: 011_create_onboarding_progress_table.sql
-- Description: Create onboarding progress tracking system for user-specific onboarding experiences
-- Version: 1.0
-- Author: Concetto WC Development Team

BEGIN;

-- Create onboarding_progress table
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  onboarding_type VARCHAR(50) NOT NULL,
  route_path VARCHAR(255),
  completed BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_onboarding_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT valid_onboarding_type CHECK (
    onboarding_type IN ('general', 'orders_traditional', 'orders_wizard', 'dashboard', 'products')
  ),
  CONSTRAINT completion_logic CHECK (
    (completed = true AND skipped = false) OR
    (completed = false AND skipped IN (true, false)) OR
    (completed = true AND completed_at IS NOT NULL) OR
    (completed = false AND completed_at IS NULL)
  )

);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_type ON onboarding_progress(onboarding_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_type ON onboarding_progress(user_id, onboarding_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_completed ON onboarding_progress(completed);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_created ON onboarding_progress(created_at);

-- Add comments for documentation
COMMENT ON TABLE onboarding_progress IS 'Tracks user-specific onboarding progress across different modal types and routes';
COMMENT ON COLUMN onboarding_progress.id IS 'Unique identifier for each onboarding progress record';
COMMENT ON COLUMN onboarding_progress.user_id IS 'Reference to the user experiencing the onboarding';
COMMENT ON COLUMN onboarding_progress.onboarding_type IS 'Type of onboarding: general, orders_traditional, orders_wizard, dashboard, products';
COMMENT ON COLUMN onboarding_progress.route_path IS 'The route path where the onboarding was triggered (e.g., /dashboard, /orders)';
COMMENT ON COLUMN onboarding_progress.completed IS 'Whether the user has completed this onboarding experience';
COMMENT ON COLUMN onboarding_progress.skipped IS 'Whether the user skipped this onboarding (default: true)';
COMMENT ON COLUMN onboarding_progress.started_at IS 'Timestamp when the onboarding experience was first presented';
COMMENT ON COLUMN onboarding_progress.completed_at IS 'Timestamp when the user completed the onboarding (NULL if not completed)';
COMMENT ON COLUMN onboarding_progress.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN onboarding_progress.updated_at IS 'Record last update timestamp';

-- Create trigger for automatic updated_at timestamp management
CREATE OR REPLACE FUNCTION update_onboarding_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_onboarding_progress_updated_at
    BEFORE UPDATE ON onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_progress_updated_at();

-- Verification query to check table creation
SELECT
    'onboarding_progress' as table_name,
    COUNT(*) as row_count
FROM onboarding_progress;

-- Check table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'onboarding_progress'
ORDER BY ordinal_position;

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_update_onboarding_progress_updated_at ON onboarding_progress;
-- DROP FUNCTION IF EXISTS update_onboarding_progress_updated_at();
-- DROP TABLE IF EXISTS onboarding_progress CASCADE;
-- COMMIT;