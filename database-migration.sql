-- ============================================================================
-- Subscription Plans Management System Migration (Fixed Version)
-- ============================================================================

-- Step 1: Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- Step 2: Create the subscription_plans table with all columns
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  interval VARCHAR(20) NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Create unique index on name (case-insensitive)
CREATE UNIQUE INDEX idx_subscription_plans_name_unique
ON subscription_plans(UPPER(name));

-- Step 4: Create performance indexes
CREATE INDEX idx_subscription_plans_interval
ON subscription_plans(interval);

CREATE INDEX idx_subscription_plans_is_active
ON subscription_plans(is_active);

CREATE INDEX idx_subscription_plans_price
ON subscription_plans(price);

CREATE INDEX idx_subscription_plans_discount
ON subscription_plans(discount_percent);

-- Step 5: Insert default plans
INSERT INTO subscription_plans (name, description, price, currency, interval, discount_percent, features, is_active)
VALUES
  (
    'Monthly',
    'Flexible monthly subscription',
    100.00,
    'PHP',
    'month',
    0,
    '{"quotes_limit": null, "support": "email", "features": ["basic_quotation", "email_support"]}'::jsonb,
    true
  ),
  (
    'Quarterly',
    'Save 25% with quarterly billing',
    75.00,
    'PHP',
    'quarter',
    25,
    '{"quotes_limit": null, "support": "priority_email", "features": ["basic_quotation", "priority_email_support", "quarterly_billing"]}'::jsonb,
    true
  ),
  (
    'Annual',
    'Best value - save 35% with annual billing',
    65.00,
    'PHP',
    'year',
    35,
    '{"quotes_limit": null, "support": "priority", "features": ["basic_quotation", "priority_support", "annual_billing", "advanced_analytics"]}'::jsonb,
    true
  );

-- ============================================================================
-- Verification Queries (run these to verify migration success)
-- ============================================================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'subscription_plans';

-- View all plans
SELECT id, name, price, currency, interval, discount_percent, is_active, created_at
FROM subscription_plans
ORDER BY created_at;