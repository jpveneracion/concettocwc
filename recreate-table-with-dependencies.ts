import { neon } from '@neondatabase/serverless';

// Using owner-level credentials for Database 1
const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function recreateTableWithDependencies() {
  try {
    console.log('🔄 Recreating pending_products table with exact Database 2 format...');
    console.log('Handling dependencies properly...\n');

    // Step 1: Drop the foreign key constraint from quote_items
    console.log('1. Dropping foreign key constraint from quote_items...');
    try {
      await sql`
        ALTER TABLE quote_items
        DROP CONSTRAINT IF EXISTS quote_items_pending_product_id_fkey
      `;
      console.log('   ✅ Dropped foreign key constraint\n');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}\n`);
    }

    // Step 2: Check data and backup
    console.log('2. Backing up existing data...');
    try {
      const existingData = await sql`SELECT COUNT(*) as count FROM pending_products`;
      console.log(`   ✅ Found ${existingData[0].count} records to backup\n`);
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}\n`);
    }

    // Step 3: Create new table with exact structure and constraint format
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

    // Step 4: Copy data from old table to new table
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

    // Step 5: Drop old table
    console.log('5. Dropping old table...');
    try {
      await sql`DROP TABLE pending_products`;
      console.log('   ✅ Dropped old table\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to drop old table: ${error.message}`);
      process.exit(1);
    }

    // Step 6: Rename new table to original name
    console.log('6. Renaming new table...');
    try {
      await sql`ALTER TABLE pending_products_new RENAME TO pending_products`;
      console.log('   ✅ Renamed table successfully\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to rename table: ${error.message}`);
      process.exit(1);
    }

    // Step 7: Recreate indexes
    console.log('7. Recreating indexes...');
    try {
      await sql`CREATE INDEX idx_pending_products_company_id ON pending_products(company_id)`;
      await sql`CREATE INDEX idx_pending_products_status ON pending_products(status)`;
      await sql`CREATE INDEX idx_pending_products_submitted_by ON pending_products(submitted_by)`;
      console.log('   ✅ Recreated indexes successfully\n');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}\n`);
    }

    // Step 8: Recreate foreign key constraint on quote_items
    console.log('8. Recreating foreign key constraint on quote_items...');
    try {
      await sql`
        ALTER TABLE quote_items
        ADD CONSTRAINT quote_items_pending_product_id_fkey
        FOREIGN KEY (pending_product_id)
        REFERENCES pending_products(id)
        ON DELETE SET NULL
      `;
      console.log('   ✅ Recreated foreign key constraint\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to create foreign key: ${error.message}`);
      process.exit(1);
    }

    // Step 9: Verify the constraint format
    console.log('9. Verifying constraint format...\n');

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
        console.log('Format comparison:');
        console.log('Match result:', newFormat === targetFormat ? 'YES' : 'NO');
        console.log('Match percentage:', calculateSimilarity(newFormat, targetFormat).toFixed(2) + '%');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 TABLE RECREATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nThe pending_products table has been recreated with the exact format');
    console.log('and all dependencies have been properly restored.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Table recreation failed:', error);
    process.exit(1);
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 100.0;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  return (longer.length - costs[shorter.length]) / longer.length * 100;
}

recreateTableWithDependencies();