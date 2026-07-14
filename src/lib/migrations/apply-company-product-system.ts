/**
 * Migration: Apply company_product_definitions table to Database 1
 * Run with: npx ts-node src/lib/migrations/apply-company-product-system.ts
 *
 * This script applies the company_product_definitions table from Database 2 to Database 1
 * including all indexes, constraints, and comments.
 */

import { neon } from '@neondatabase/serverless';

// Database 1 connection string
// For migration purposes, ensure the user has CREATE TABLE permissions
// You can use process.env.DATABASE_URL or set a specific admin connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

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
  console.log('🔄 Starting Company Product System migration to Database 1...');

  const sql = neon(DATABASE_URL);

  try {
    // Step 1: Create the company_product_definitions table
    console.log('📋 Creating company_product_definitions table...');

    await sql`
      CREATE TABLE IF NOT EXISTS company_product_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        collection VARCHAR(100),
        description TEXT NOT NULL,
        unit VARCHAR(20) DEFAULT 'sqft',
        submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_approved_for_global BOOLEAN DEFAULT FALSE,
        global_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    console.log('✅ Table created successfully');

    // Step 2: Create unique constraint for company_id + code (case-insensitive)
    console.log('📋 Creating unique index on company_id and UPPER(code)...');

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_company_products_company_code_unique
      ON company_product_definitions(company_id, UPPER(code))
    `;
    console.log('✅ Unique index created');

    // Step 3: Create performance indexes
    console.log('📋 Creating performance indexes...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_company_products_company_id
      ON company_product_definitions(company_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_company_products_code
      ON company_product_definitions(code)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_company_products_approval_status
      ON company_product_definitions(is_approved_for_global)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_company_products_submitted_by
      ON company_product_definitions(submitted_by)
    `;
    console.log('✅ Performance indexes created');

    // Step 4: Add comments for documentation
    console.log('📋 Adding table and column comments...');

    await sql`
      COMMENT ON TABLE company_product_definitions
      IS 'Company-specific product definitions awaiting admin promotion'
    `;

    await sql`
      COMMENT ON COLUMN company_product_definitions.is_approved_for_global
      IS 'Whether this product has been promoted to global catalog'
    `;

    await sql`
      COMMENT ON COLUMN company_product_definitions.global_product_id
      IS 'Reference to global product if promoted'
    `;
    console.log('✅ Comments added');

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
    WHERE table_name = 'company_product_definitions'
  `;

  if (tableCheck.length === 0) {
    throw new Error('❌ Table company_product_definitions was not created');
  }
  console.log('✅ Table exists');

  // 2. Verify table structure (11 columns)
  const columns: DatabaseSchema[] = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'company_product_definitions'
    ORDER BY ordinal_position
  `;

  console.log(`📋 Table structure (${columns.length} columns):`);
  columns.forEach((col: DatabaseSchema) => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });

  if (columns.length !== 11) {
    throw new Error(`❌ Expected 11 columns, found ${columns.length}`);
  }

  // Verify key columns exist
  const requiredColumns = [
    'id', 'company_id', 'code', 'collection', 'description',
    'unit', 'submitted_by', 'is_approved_for_global',
    'global_product_id', 'created_at', 'updated_at'
  ];

  const foundColumns = columns.map(col => col.column_name);
  const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

  if (missingColumns.length > 0) {
    throw new Error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
  }
  console.log('✅ All required columns present');

  // 3. Verify indexes (6 indexes expected)
  const indexes: IndexInfo[] = await sql`
    SELECT indexname as index_name, indexdef as index_definition
    FROM pg_indexes
    WHERE tablename = 'company_product_definitions'
    ORDER BY indexname
  `;

  console.log(`📋 Indexes found (${indexes.length}):`);
  indexes.forEach((idx: IndexInfo) => {
    console.log(`  - ${idx.index_name}`);
  });

  if (indexes.length !== 6) {
    throw new Error(`❌ Expected 6 indexes, found ${indexes.length}`);
  }
  console.log('✅ All indexes created');

  // 4. Verify foreign key constraints
  const constraints: ConstraintInfo[] = await sql`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'company_product_definitions'
    AND constraint_type = 'FOREIGN KEY'
  `;

  console.log(`📋 Foreign key constraints (${constraints.length}):`);
  constraints.forEach((con: ConstraintInfo) => {
    console.log(`  - ${con.constraint_name}`);
  });

  // Should have 3 foreign keys: companies, users, products
  if (constraints.length !== 3) {
    throw new Error(`❌ Expected 3 foreign key constraints, found ${constraints.length}`);
  }
  console.log('✅ Foreign key constraints verified');

  // 5. Verify comments using simpler approach
  const tableComment: any[] = await sql`
    SELECT obj_description('company_product_definitions'::regclass) as comment
  `;

  const approvalColumnComment: any[] = await sql`
    SELECT pg_catalog.col_description(
      'company_product_definitions'::regclass::oid,
      (SELECT ordinal_position FROM information_schema.columns
       WHERE table_name = 'company_product_definitions' AND column_name = 'is_approved_for_global')
    ) as comment
  `;

  const productColumnComment: any[] = await sql`
    SELECT pg_catalog.col_description(
      'company_product_definitions'::regclass::oid,
      (SELECT ordinal_position FROM information_schema.columns
       WHERE table_name = 'company_product_definitions' AND column_name = 'global_product_id')
    ) as comment
  `;

  if (tableComment[0].comment) {
    console.log(`✅ Table comment: "${tableComment[0].comment}"`);
  } else {
    console.log('⚠️  Table comment missing');
  }

  if (approvalColumnComment[0].comment) {
    console.log(`✅ Column comment (is_approved_for_global): "${approvalColumnComment[0].comment}"`);
  } else {
    console.log('⚠️  Column comment missing for is_approved_for_global');
  }

  if (productColumnComment[0].comment) {
    console.log(`✅ Column comment (global_product_id): "${productColumnComment[0].comment}"`);
  } else {
    console.log('⚠️  Column comment missing for global_product_id');
  }

  console.log('\n✅ Verification complete - migration successful!');
}

// Main execution
runMigration()
  .then(() => {
    console.log('🎉 Company Product System migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });