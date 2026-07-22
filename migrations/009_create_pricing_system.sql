-- Migration: 009_create_pricing_system.sql
-- Description: Create database-driven pricing system with audit trail
-- Version: 1.0
-- Author: Concetto WC Development Team

BEGIN;

-- Create pricing_config table
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_base_rate DECIMAL(10,2) NOT NULL DEFAULT 499.00,
  quarterly_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  annual_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  monthly_threshold DECIMAL(10,2) NOT NULL DEFAULT 600.00,
  quarterly_threshold DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  change_reason TEXT,

  -- Foreign key constraints
  CONSTRAINT fk_pricing_config_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_pricing_config_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

  -- Check constraints
  CONSTRAINT valid_percentage CHECK (
    quarterly_discount_percent >= 0 AND quarterly_discount_percent <= 100 AND
    annual_discount_percent >= 0 AND annual_discount_percent <= 100
  ),
  CONSTRAINT positive_rate CHECK (monthly_base_rate > 0),
  CONSTRAINT logical_thresholds CHECK (monthly_threshold < quarterly_threshold)
);

-- Create pricing_history table for audit trail
CREATE TABLE IF NOT EXISTS pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_config_id UUID,
  change_type VARCHAR(20) NOT NULL,
  changed_field TEXT,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_config JSONB,

  -- Foreign key constraints
  CONSTRAINT fk_pricing_history_config FOREIGN KEY (pricing_config_id) REFERENCES pricing_config(id) ON DELETE SET NULL,
  CONSTRAINT fk_pricing_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL

);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pricing_config_active ON pricing_config(is_active, valid_from);
CREATE INDEX IF NOT EXISTS idx_pricing_history_config ON pricing_history(pricing_config_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_date ON pricing_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_pricing_history_type ON pricing_history(change_type);

-- Add comments for documentation
COMMENT ON TABLE pricing_config IS 'Stores pricing configuration with effective date ranges';
COMMENT ON TABLE pricing_history IS 'Audit trail for all pricing configuration changes';

COMMENT ON COLUMN pricing_config.monthly_base_rate IS 'Base monthly subscription rate in PHP';
COMMENT ON COLUMN pricing_config.quarterly_discount_percent IS 'Discount percentage for quarterly payments';
COMMENT ON COLUMN pricing_config.annual_discount_percent IS 'Discount percentage for annual payments';
COMMENT ON COLUMN pricing_config.monthly_threshold IS 'Monthly revenue threshold for special pricing';
COMMENT ON COLUMN pricing_config.quarterly_threshold IS 'Quarterly revenue threshold for special pricing';
COMMENT ON COLUMN pricing_config.is_active IS 'Whether this pricing configuration is currently active';
COMMENT ON COLUMN pricing_config.valid_from IS 'Start date for when this configuration becomes effective';
COMMENT ON COLUMN pricing_config.valid_until IS 'End date for when this configuration expires (NULL for active)';
COMMENT ON COLUMN pricing_config.change_reason IS 'Reason for creating or modifying this configuration';

COMMENT ON COLUMN pricing_history.pricing_config_id IS 'Reference to pricing_config (NULL for deleted configs)';
COMMENT ON COLUMN pricing_history.change_type IS 'Type of change: CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE';
COMMENT ON COLUMN pricing_history.changed_field IS 'Name of the field that was changed';
COMMENT ON COLUMN pricing_history.old_value IS 'Previous value before the change';
COMMENT ON COLUMN pricing_history.new_value IS 'New value after the change';
COMMENT ON COLUMN pricing_history.previous_config IS 'Complete previous configuration state as JSONB';

-- Insert default pricing configuration
INSERT INTO pricing_config (
  monthly_base_rate,
  quarterly_discount_percent,
  annual_discount_percent,
  monthly_threshold,
  quarterly_threshold,
  is_active,
  valid_from,
  change_reason
) VALUES (
  499.00,
  5.00,
  8.00,
  600.00,
  1500.00,
  true,
  NOW(),
  'Initial default pricing configuration'
);

-- Create initial history entry for default config
INSERT INTO pricing_history (
  pricing_config_id,
  change_type,
  change_reason,
  new_value,
  previous_config
) VALUES (
  (SELECT id FROM pricing_config WHERE is_active = true LIMIT 1),
  'CREATE',
  'Initial default pricing configuration created',
  'Monthly Base Rate: 499.00, Quarterly Discount: 5.00%, Annual Discount: 8.00%',
  '{"monthly_base_rate": 499.00, "quarterly_discount_percent": 5.00, "annual_discount_percent": 8.00, "monthly_threshold": 600.00, "quarterly_threshold": 1500.00}'
);

-- Verification query to check table creation and data
SELECT 'pricing_config' as table_name, COUNT(*) as row_count FROM pricing_config
UNION ALL
SELECT 'pricing_history', COUNT(*) FROM pricing_history;

COMMIT;

-- ROLLBACK SCRIPT (if needed):
-- BEGIN;
-- DROP TABLE IF EXISTS pricing_history CASCADE;
-- DROP TABLE IF EXISTS pricing_config CASCADE;
-- COMMIT;
