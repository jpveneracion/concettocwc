// Migration: Subscription Plans Management System
// Run with: npm run db:migrate:subscription-plans
// This script applies the subscription_plans table for dynamic plan management

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface DatabaseSchema {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface IndexInfo {
  index_name: string;
  index_definition: string;
}

interface TableInfo {
  table_name: string;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

async function runMigration(): Promise<void> {
  console.log('🔄 Starting Subscription Plans migration...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Step 1: Create the subscription_plans table
    console.log('📋 Creating subscription_plans table...');

    await sql`
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
      )
    `;
    console.log('✅ Table created successfully');

    // Step 2: Create unique constraint for name (case-insensitive)
    console.log('📋 Creating unique index on name...');

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_name_unique
      ON subscription_plans(UPPER(name))
    `;
    console.log('✅ Unique index created');

    // Step 3: Create performance indexes
    console.log('📋 Creating performance indexes...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_plans_interval
      ON subscription_plans(interval)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active
      ON subscription_plans(is_active)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_plans_price
      ON subscription_plans(price)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_plans_discount
      ON subscription_plans(discount_percent)
    `;
    console.log('✅ Performance indexes created');

    // Step 4: Add comments for documentation
    console.log('📋 Adding table and column comments...');

    await sql`
      COMMENT ON TABLE subscription_plans
      IS 'Dynamic subscription plans for admin management'
    `;

    await sql`
      COMMENT ON COLUMN subscription_plans.price
      IS 'Base price for the subscription plan'
    `;

    await sql`
      COMMENT ON COLUMN subscription_plans.interval
      IS 'Billing interval: month, quarter, or year'
    `;

    await sql`
      COMMENT ON COLUMN subscription_plans.discount_percent
      IS 'Discount percentage (0-100) applied to base price'
    `;

    await sql`
      COMMENT ON COLUMN subscription_plans.features
      IS 'Plan features stored as JSON object'
    `;

    await sql`
      COMMENT ON COLUMN subscription_plans.is_active
      IS 'Whether the plan is currently available for new subscriptions'
    `;
    console.log('✅ Comments added');

    // Step 5: Insert default plans from existing hardcoded data
    console.log('📋 Inserting default subscription plans...');

    await sql`
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
      ON CONFLICT (UPPER(name)) DO NOTHING
    `;
    console.log('✅ Default plans inserted');

    console.log('\n✅ Migration completed successfully!');

    // Verification steps
    await verifyMigration(sql);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function verifyMigration(sql: any): Promise<void> {
  console.log('\n🔍 Verifying migration...');

  // 1. Check table exists
  const tableCheck: TableInfo[] = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'subscription_plans'
  `;

  if (tableCheck.length === 0) {
    throw new Error('❌ Table subscription_plans was not created');
  }
  console.log('✅ Table exists');

  // 2. Verify table structure
  const columns: DatabaseSchema[] = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    ORDER BY ordinal_position
  `;

  console.log(`📋 Table structure (${columns.length} columns):`);
  columns.forEach((col: DatabaseSchema) => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });

  const requiredColumns = [
    'id', 'name', 'description', 'price', 'currency', 'interval',
    'discount_percent', 'features', 'is_active', 'created_at', 'updated_at'
  ];

  const foundColumns = columns.map(col => col.column_name);
  const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

  if (missingColumns.length > 0) {
    throw new Error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
  }
  console.log('✅ All required columns present');

  // 3. Verify indexes
  const indexes: IndexInfo[] = await sql`
    SELECT index_name, index_definition
    FROM pg_indexes
    WHERE tablename = 'subscription_plans'
    ORDER BY index_name
  `;

  console.log(`📋 Indexes found (${indexes.length}):`);
  indexes.forEach((idx: IndexInfo) => {
    console.log(`  - ${idx.index_name}`);
  });

  if (indexes.length !== 5) {
    throw new Error(`❌ Expected 5 indexes, found ${indexes.length}`);
  }
  console.log('✅ All indexes created');

  // 4. Verify default data
  const planCount = await sql`
    SELECT COUNT(*) as count FROM subscription_plans
  `;

  const count = parseInt(planCount[0].count);
  console.log(`📋 Default plans inserted: ${count}`);

  if (count < 3) {
    throw new Error(`❌ Expected at least 3 default plans, found ${count}`);
  }
  console.log('✅ Default plans present');

  console.log('\n✅ Verification complete - migration successful!');
}

// Main execution
runMigration()
  .then(() => {
    console.log('🎉 Subscription Plans migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });