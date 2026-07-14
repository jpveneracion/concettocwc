import { neon } from '@neondatabase/serverless';

// Using owner-level credentials for Database 1
const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function recreateTableExactFormat() {
  try {
    console.log('🔄 Recreating pending_products table with exact Database 2 format...');
    console.log('Using OWNER credentials for ep-holy-leaf-at8ruz1r\n');

    // First, backup existing data
    console.log('1. Backing up existing data...');
    try {
      const existingData = await sql`
        SELECT * FROM pending_products
      `;
      console.log(`   ✅ Backed up ${existingData.length} records\n`);
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Get the current table structure
    console.log('2. Getting current table structure...');
    try {
      const tableStructure = await sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'pending_products'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      console.log(`   ✅ Found ${tableStructure.length} columns\n`);
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Create a new table with the exact structure and constraint format
    console.log('3. Creating new table with exact Database 2 format...');

    const createTableSQL = `
      CREATE TABLE pending_products_new (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        collection VARCHAR(100),
        description TEXT NOT NULL,
        unit VARCHAR(20) DEFAULT 'sqft',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        review_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ,
        CONSTRAINT pending_products_status_check
          CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[]))
      )
    `;

    try {
      await sql(createTableSQL);
      console.log('   ✅ Created new table with exact format\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to create new table: ${error.message}`);
      process.exit(1);
    }

    // Copy data from old table to new table
    console.log('4. Copying data to new table...');
    try {
      await sql`
        INSERT INTO pending_products_new
        SELECT * FROM pending_products
      `;
      console.log('   ✅ Copied data successfully\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to copy data: ${error.message}`);
      process.exit(1);
    }

    // Drop old table
    console.log('5. Dropping old table...');
    try {
      await sql`
        DROP TABLE pending_products
      `;
      console.log('   ✅ Dropped old table\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to drop old table: ${error.message}`);
      process.exit(1);
    }

    // Rename new table to original name
    console.log('6. Renaming new table...');
    try {
      await sql`
        ALTER TABLE pending_products_new RENAME TO pending_products
      `;
      console.log('   ✅ Renamed table successfully\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to rename table: ${error.message}`);
      process.exit(1);
    }

    // Recreate indexes
    console.log('7. Recreating indexes...');
    try {
      await sql`
        CREATE INDEX idx_pending_products_company_id ON pending_products(company_id)
      `;
      await sql`
        CREATE INDEX idx_pending_products_status ON pending_products(status)
      `;
      await sql`
        CREATE INDEX idx_pending_products_submitted_by ON pending_products(submitted_by)
      `;
      console.log('   ✅ Recreated indexes successfully\n');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Verify the constraint format
    console.log('8. Verifying constraint format...\n');

    const newConstraint = await sql`
      SELECT
        pg_get_constraintdef(pgc.oid, false) AS constraint_definition
      FROM pg_catalog.pg_constraint pgc
      JOIN pg_catalog.pg_class pgc1 ON pgc.conrelid = pgc1.oid
      JOIN pg_catalog.pg_namespace pgn ON pgc1.relnamespace = pgn.oid
      WHERE pgc1.relname = 'pending_products'
      AND pgn.nspname = 'public'
      AND pgc.conname = 'pending_products_status_check'
    `;

    if (newConstraint.length > 0) {
      const newFormat = newConstraint[0].constraint_definition;
      const targetFormat = "CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))";

      console.log('New format (Database 1):');
      console.log(newFormat);
      console.log('');

      console.log('Target format (Database 2):');
      console.log(targetFormat);
      console.log('');

      if (newFormat === targetFormat) {
        console.log('🎉 SUCCESS: Constraint format matches target EXACTLY!');
      } else {
        console.log('⚠️ Format still differs:');
        console.log('Match result:', newFormat === targetFormat ? 'YES' : 'NO');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 TABLE RECREATION COMPLETED');
    console.log('='.repeat(80));
    console.log('\nThe pending_products table has been recreated with the exact format.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Table recreation failed:', error);
    process.exit(1);
  }
}

recreateTableExactFormat();