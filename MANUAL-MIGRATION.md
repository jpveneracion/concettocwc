# Manual Database Migration for Subscription Plans

Since the automated migration script lacks CREATE TABLE permissions, you'll need to run this migration manually.

## Migration Steps

### 1. Connect to your Neon Database
Use your database client (Neon console, pgAdmin, etc.) to connect to your database.

### 2. Run the following SQL commands

```sql
-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
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

-- Create unique index on name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_name_unique
ON subscription_plans(UPPER(name));

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_interval
ON subscription_plans(interval);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active
ON subscription_plans(is_active);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_price
ON subscription_plans(price);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_discount
ON subscription_plans(discount_percent);

-- Insert default plans
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
  )
ON CONFLICT (UPPER(name)) DO NOTHING;
```

### 3. Verify Migration

Run this query to verify the migration was successful:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'subscription_plans';

-- Check default plans
SELECT COUNT(*) as plan_count 
FROM subscription_plans;

-- View all plans
SELECT * FROM subscription_plans ORDER BY created_at;
```

## Troubleshooting

### Permission Issues
If you encounter permission issues, ensure your database user has:
- `CREATE TABLE` permission
- `CREATE INDEX` permission  
- `INSERT` permission on the table

### Alternative: Use Database Admin
Contact your database administrator to run these commands if you lack the necessary permissions.

## Post-Migration

Once the migration is complete, the admin subscription plans feature will be fully functional:

1. **Admin Interface**: Visit `/admin/plans` to manage subscription plans
2. **API Endpoints**: All CRUD operations will be available
3. **Type Safety**: Full TypeScript support for plan management

## Rollback (if needed)

To rollback the migration:

```sql
DROP TABLE IF EXISTS subscription_plans CASCADE;
```

---

**Note**: The migration script `src/lib/migrations/create-subscription-plans.ts` is included in the codebase but requires elevated database permissions to run automatically.