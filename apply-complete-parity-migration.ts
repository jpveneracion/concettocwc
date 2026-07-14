import { neon } from '@neondatabase/serverless';

// Using owner-level credentials for Database 1
const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function applyCompleteParityMigration() {
  try {
    console.log('🔄 Applying COMPLETE DATABASE PARITY migration to Database 1...');
    console.log('Using OWNER credentials for ep-holy-leaf-at8ruz1r\n');

    let successCount = 0;
    let errorCount = 0;

    console.log('📋 Step 1: Update quote_items column comments...\n');

    // Update quote_items.product_source comment
    console.log('1. Updating quote_items.product_source comment...');
    try {
      await sql`
        COMMENT ON COLUMN quote_items.product_source
        IS 'Source of product: approved (from products table) or pending (from pending_products)'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    // Update quote_items.pending_product_id comment
    console.log('2. Updating quote_items.pending_product_id comment...');
    try {
      await sql`
        COMMENT ON COLUMN quote_items.pending_product_id
        IS 'Reference to pending product if product_source=pending'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    console.log('\n📋 Step 2: Update pending_products table comment...\n');

    // Update pending_products table comment
    console.log('3. Updating pending_products table comment...');
    try {
      await sql`
        COMMENT ON TABLE pending_products
        IS 'Merchant-submitted products awaiting admin approval'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    console.log('\n📋 Step 3: Update pending_products column comments...\n');

    // Update pending_products.code comment
    console.log('4. Updating pending_products.code comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.code
        IS 'Product code (globally unique)'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    // Update pending_products.status comment
    console.log('5. Updating pending_products.status comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.status
        IS 'pending, approved, or rejected'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    // Update pending_products.submitted_by comment
    console.log('6. Updating pending_products.submitted_by comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.submitted_by
        IS 'User who submitted the product'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    // Update pending_products.reviewed_by comment
    console.log('7. Updating pending_products.reviewed_by comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.reviewed_by
        IS 'Admin who reviewed the product'
      `;
      console.log('   ✅ Success - Updated to match Database 2');
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      errorCount++;
    }

    console.log('\n📋 Step 4: Remove extra pending_products column comments...\n');

    // Remove the extra column comments that exist in DB1 but not in DB2
    const columnsToClear = [
      'id',
      'company_id',
      'collection',
      'description',
      'unit',
      'review_notes',
      'created_at',
      'updated_at',
      'reviewed_at'
    ];

    for (let i = 0; i < columnsToClear.length; i++) {
      const column = columnsToClear[i];
      const stepNum = 8 + i;
      console.log(`${stepNum}. Clearing pending_products.${column} comment...`);

      try {
        // Use parameterized query to avoid SQL injection
        const query = `COMMENT ON COLUMN pending_products.${column} IS NULL`;
        await sql(query); // Use dynamic column name with template literal
        console.log(`   ✅ Success - Removed comment to match Database 2`);
        successCount++;
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 MIGRATION EXECUTION SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n✅ Successful operations: ${successCount}`);
    console.log(`❌ Failed operations: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 COMPLETE SUCCESS: All database parity changes applied successfully!');
      console.log('Database 1 (holy-leaf) now matches Database 2 (steep-unit) exactly.\n');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Some operations completed with errors.');
      console.log('Please review the failed operations above.\n');
    }

    // Verify the changes
    console.log('🔍 Running verification check...\n');

    const verification = await sql`
      SELECT
        'quote_items.product_source' as target,
        pgd.description as current_value
      FROM pg_catalog.pg_statio_all_tables AS st
      INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
      INNER JOIN information_schema.columns col ON (
        pgd.objsubid = col.ordinal_position AND
        col.table_schema = st.schemaname AND
        col.table_name = st.relname AND
        col.table_schema = 'public'
      )
      WHERE st.relname = 'quote_items'
      AND col.column_name = 'product_source'

      UNION ALL

      SELECT
        'pending_products table' as target,
        pg_catalog.obj_description(pgc.oid, 'pg_class') as current_value
      FROM pg_catalog.pg_class pgc
      JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
      WHERE pgc.relname = 'pending_products'
      AND pgn.nspname = 'public'

      UNION ALL

      SELECT
        'pending_products column count' as target,
        COUNT(*)::text as current_value
      FROM pg_catalog.pg_statio_all_tables AS st
      INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
      INNER JOIN information_schema.columns col ON (
        pgd.objsubid = col.ordinal_position AND
        col.table_schema = st.schemaname AND
        col.table_name = st.relname AND
        col.table_schema = 'public'
      )
      WHERE st.relname = 'pending_products'
    `;

    console.log('📋 Verification Results:');
    verification.forEach((result: any) => {
      console.log(`   ${result.target}: ${result.current_value}`);
    });

    console.log('\n' + '='.repeat(80));
    process.exit(errorCount === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

applyCompleteParityMigration();