/**
 * Migration: 009_create_pricing_system.sql
 * Run with: npx ts-node src/lib/migrations/apply-pricing-system.ts
 *
 * This script applies the pricing system tables including:
 * - pricing_config: Stores pricing configuration with effective date ranges
 * - pricing_history: Audit trail for all pricing configuration changes
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

interface DatabaseSchema {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableInfo {
  table_name: string;
}

interface IndexInfo {
  index_name: string;
  index_definition: string;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

async function runMigration(): Promise<void> {
  console.log('🔄 Starting Pricing System migration (009)...');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('📋 Creating pricing_config table...');

    // Create pricing_config table
    await sql`
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

        CONSTRAINT fk_pricing_config_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_pricing_config_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT valid_percentage CHECK (
          quarterly_discount_percent >= 0 AND quarterly_discount_percent <= 100 AND
          annual_discount_percent >= 0 AND annual_discount_percent <= 100
        ),
        CONSTRAINT positive_rate CHECK (monthly_base_rate > 0),
        CONSTRAINT logical_thresholds CHECK (monthly_threshold < quarterly_threshold)
      )
    `;
    console.log('✅ pricing_config table created');

    console.log('📋 Creating pricing_history table...');

    // Create pricing_history table
    await sql`
      CREATE TABLE IF NOT EXISTS pricing_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pricing_config_id UUID,
        change_type VARCHAR(20) NOT NULL,
        changed_field VARCHAR(50),
        old_value TEXT,
        new_value TEXT,
        change_reason TEXT,
        changed_by UUID,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        previous_config JSONB,

        CONSTRAINT fk_pricing_history_config FOREIGN KEY (pricing_config_id) REFERENCES pricing_config(id) ON DELETE SET NULL,
        CONSTRAINT fk_pricing_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT valid_change_type CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE'))
      )
    `;
    console.log('✅ pricing_history table created');

    console.log('📋 Creating indexes...');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_config_active ON pricing_config(is_active, valid_from)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_history_config ON pricing_history(pricing_config_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_history_date ON pricing_history(changed_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_history_type ON pricing_history(change_type)`;
    console.log('✅ Indexes created');

    console.log('📋 Adding comments...');

    // Add comments
    await sql`COMMENT ON TABLE pricing_config IS 'Stores pricing configuration with effective date ranges'`;
    await sql`COMMENT ON TABLE pricing_history IS 'Audit trail for all pricing configuration changes'`;

    await sql`COMMENT ON COLUMN pricing_config.monthly_base_rate IS 'Base monthly subscription rate in PHP'`;
    await sql`COMMENT ON COLUMN pricing_config.quarterly_discount_percent IS 'Discount percentage for quarterly payments'`;
    await sql`COMMENT ON COLUMN pricing_config.annual_discount_percent IS 'Discount percentage for annual payments'`;
    await sql`COMMENT ON COLUMN pricing_config.monthly_threshold IS 'Monthly revenue threshold for special pricing'`;
    await sql`COMMENT ON COLUMN pricing_config.quarterly_threshold IS 'Quarterly revenue threshold for special pricing'`;
    await sql`COMMENT ON COLUMN pricing_config.is_active IS 'Whether this pricing configuration is currently active'`;
    await sql`COMMENT ON COLUMN pricing_config.valid_from IS 'Start date for when this configuration becomes effective'`;
    await sql`COMMENT ON COLUMN pricing_config.valid_until IS 'End date for when this configuration expires (NULL for active)'`;
    await sql`COMMENT ON COLUMN pricing_config.change_reason IS 'Reason for creating or modifying this configuration'`;

    await sql`COMMENT ON COLUMN pricing_history.pricing_config_id IS 'Reference to pricing_config (NULL for deleted configs)'`;
    await sql`COMMENT ON COLUMN pricing_history.change_type IS 'Type of change: CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE'`;
    await sql`COMMENT ON COLUMN pricing_history.changed_field IS 'Name of the field that was changed'`;
    await sql`COMMENT ON COLUMN pricing_history.old_value IS 'Previous value before the change'`;
    await sql`COMMENT ON COLUMN pricing_history.new_value IS 'New value after the change'`;
    await sql`COMMENT ON COLUMN pricing_history.previous_config IS 'Complete previous configuration state as JSONB'`;
    console.log('✅ Comments added');

    console.log('📋 Inserting default data...');

    // Check if default config already exists
    const existingConfig = await sql`
      SELECT COUNT(*) as count FROM pricing_config
    `;

    if (existingConfig[0]?.count === 0) {
      // Insert default pricing configuration
      await sql`
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
        )
      `;
      console.log('✅ Default pricing configuration inserted');

      // Create initial history entry
      await sql`
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
        )
      `;
      console.log('✅ Initial history entry created');
    } else {
      console.log('⚠️  Default configuration already exists, skipping data insertion');
    }

    console.log('✅ Migration completed successfully!');

    // Verification steps
    await verifyMigration(sql);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function verifyMigration(sql: any): Promise<void> {
  console.log('\n🔍 Verifying migration...');

  // 1. Check pricing_config table exists
  const pricingConfigCheck: TableInfo[] = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'pricing_config'
  `;

  if (pricingConfigCheck.length === 0) {
    throw new Error('❌ Table pricing_config was not created');
  }
  console.log('✅ pricing_config table exists');

  // 2. Check pricing_history table exists
  const pricingHistoryCheck: TableInfo[] = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'pricing_history'
  `;

  if (pricingHistoryCheck.length === 0) {
    throw new Error('❌ Table pricing_history was not created');
  }
  console.log('✅ pricing_history table exists');

  // 3. Verify pricing_config table structure (14 columns expected)
  const pricingConfigColumns: DatabaseSchema[] = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'pricing_config'
    ORDER BY ordinal_position
  `;

  console.log(`📋 pricing_config structure (${pricingConfigColumns.length} columns):`);

  const expectedConfigColumns = [
    'id', 'monthly_base_rate', 'quarterly_discount_percent', 'annual_discount_percent',
    'monthly_threshold', 'quarterly_threshold', 'is_active', 'valid_from', 'valid_until',
    'created_at', 'created_by', 'updated_at', 'updated_by', 'change_reason'
  ];

  const foundConfigColumns = pricingConfigColumns.map(col => col.column_name);
  const missingConfigColumns = expectedConfigColumns.filter(col => !foundConfigColumns.includes(col));

  if (missingConfigColumns.length > 0) {
    throw new Error(`❌ Missing required columns in pricing_config: ${missingConfigColumns.join(', ')}`);
  }
  console.log('✅ All required columns present in pricing_config');

  // 4. Verify pricing_history table structure (10 columns expected)
  const pricingHistoryColumns: DatabaseSchema[] = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'pricing_history'
    ORDER BY ordinal_position
  `;

  console.log(`📋 pricing_history structure (${pricingHistoryColumns.length} columns):`);

  const expectedHistoryColumns = [
    'id', 'pricing_config_id', 'change_type', 'changed_field', 'old_value',
    'new_value', 'change_reason', 'changed_by', 'changed_at', 'previous_config'
  ];

  const foundHistoryColumns = pricingHistoryColumns.map(col => col.column_name);
  const missingHistoryColumns = expectedHistoryColumns.filter(col => !foundHistoryColumns.includes(col));

  if (missingHistoryColumns.length > 0) {
    throw new Error(`❌ Missing required columns in pricing_history: ${missingHistoryColumns.join(', ')}`);
  }
  console.log('✅ All required columns present in pricing_history');

  // 5. Verify indexes
  const pricingConfigIndexes: IndexInfo[] = await sql`
    SELECT indexname as index_name, indexdef as index_definition
    FROM pg_indexes
    WHERE tablename = 'pricing_config'
    ORDER BY indexname
  `;

  const pricingHistoryIndexes: IndexInfo[] = await sql`
    SELECT indexname as index_name, indexdef as index_definition
    FROM pg_indexes
    WHERE tablename = 'pricing_history'
    ORDER BY indexname
  `;

  console.log(`📋 Indexes found:`);
  console.log(`  - pricing_config: ${pricingConfigIndexes.length} indexes`);
  pricingConfigIndexes.forEach((idx: IndexInfo) => console.log(`    • ${idx.index_name}`));
  console.log(`  - pricing_history: ${pricingHistoryIndexes.length} indexes`);
  pricingHistoryIndexes.forEach((idx: IndexInfo) => console.log(`    • ${idx.index_name}`));

  const expectedConfigIndexes = ['idx_pricing_config_active'];
  const expectedHistoryIndexes = ['idx_pricing_history_config', 'idx_pricing_history_date', 'idx_pricing_history_type'];

  const foundConfigIndexNames = pricingConfigIndexes.map(idx => idx.index_name);
  const foundHistoryIndexNames = pricingHistoryIndexes.map(idx => idx.index_name);

  const missingConfigIndexes = expectedConfigIndexes.filter(idx => !foundConfigIndexNames.includes(idx));
  const missingHistoryIndexes = expectedHistoryIndexes.filter(idx => !foundHistoryIndexNames.includes(idx));

  if (missingConfigIndexes.length > 0 || missingHistoryIndexes.length > 0) {
    console.warn('⚠️  Some expected indexes are missing:');
    if (missingConfigIndexes.length > 0) console.warn(`  pricing_config: ${missingConfigIndexes.join(', ')}`);
    if (missingHistoryIndexes.length > 0) console.warn(`  pricing_history: ${missingHistoryIndexes.join(', ')}`);
  } else {
    console.log('✅ All expected indexes created');
  }

  // 6. Verify constraints
  const pricingConfigConstraints: ConstraintInfo[] = await sql`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'pricing_config'
    AND constraint_type IN ('CHECK', 'FOREIGN KEY')
    ORDER BY constraint_name
  `;

  const pricingHistoryConstraints: ConstraintInfo[] = await sql`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'pricing_history'
    AND constraint_type IN ('CHECK', 'FOREIGN KEY')
    ORDER BY constraint_name
  `;

  console.log(`📋 Constraints found:`);
  console.log(`  - pricing_config: ${pricingConfigConstraints.length} constraints`);
  pricingConfigConstraints.forEach((con: ConstraintInfo) => console.log(`    • ${con.constraint_name} (${con.constraint_type})`));
  console.log(`  - pricing_history: ${pricingHistoryConstraints.length} constraints`);
  pricingHistoryConstraints.forEach((con: ConstraintInfo) => console.log(`    • ${con.constraint_name} (${con.constraint_type})`));

  // 7. Check default data
  const pricingConfigData: any[] = await sql`
    SELECT COUNT(*) as count FROM pricing_config
  `;

  const pricingHistoryData: any[] = await sql`
    SELECT COUNT(*) as count FROM pricing_history
  `;

  console.log(`📋 Data verification:`);
  console.log(`  - pricing_config rows: ${pricingConfigData[0]?.count || 0}`);
  console.log(`  - pricing_history rows: ${pricingHistoryData[0]?.count || 0}`);

  if ((pricingConfigData[0]?.count || 0) < 1) {
    console.warn('⚠️  No default pricing configuration found');
  } else {
    console.log('✅ Default pricing configuration present');
  }

  if ((pricingHistoryData[0]?.count || 0) < 1) {
    console.warn('⚠️  No initial history entry found');
  } else {
    console.log('✅ Initial history entry present');
  }

  // 8. Display current pricing configuration
  const currentPricing: any[] = await sql`
    SELECT
      monthly_base_rate,
      quarterly_discount_percent,
      annual_discount_percent,
      monthly_threshold,
      quarterly_threshold,
      is_active,
      valid_from
    FROM pricing_config
    WHERE is_active = true
    ORDER BY valid_from DESC
    LIMIT 1
  `;

  if (currentPricing.length > 0) {
    console.log('\n📋 Current Active Pricing Configuration:');
    console.log(`  Monthly Base Rate: ₱${currentPricing[0].monthly_base_rate}`);
    console.log(`  Quarterly Discount: ${currentPricing[0].quarterly_discount_percent}%`);
    console.log(`  Annual Discount: ${currentPricing[0].annual_discount_percent}%`);
    console.log(`  Monthly Threshold: ₱${currentPricing[0].monthly_threshold}`);
    console.log(`  Quarterly Threshold: ₱${currentPricing[0].quarterly_threshold}`);
    console.log(`  Valid From: ${currentPricing[0].valid_from}`);
  }

  console.log('\n✅ Verification complete - migration successful!');
}

// Main execution
runMigration()
  .then(() => {
    console.log('🎉 Pricing System migration (009) completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
