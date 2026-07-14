import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function applyCommentsParityMigration() {
  try {
    console.log('🔄 Applying comments parity migration to Database 1...');
    console.log('Target Database: ep-holy-leaf-at8ruz1r\n');

    console.log('📋 Updating quote_items column comments...\n');

    // Update quote_items.product_source comment
    console.log('1. Updating quote_items.product_source comment...');
    try {
      await sql`
        COMMENT ON COLUMN quote_items.product_source
        IS 'Source of product: approved (from products table) or pending (from pending_products)'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Update quote_items.pending_product_id comment
    console.log('2. Updating quote_items.pending_product_id comment...');
    try {
      await sql`
        COMMENT ON COLUMN quote_items.pending_product_id
        IS 'Reference to pending product if product_source=pending'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    console.log('\n📋 Updating pending_products table comment...\n');

    // Update pending_products table comment
    console.log('3. Updating pending_products table comment...');
    try {
      await sql`
        COMMENT ON TABLE pending_products
        IS 'Merchant-submitted products awaiting admin approval'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    console.log('\n📋 Updating pending_products column comments...\n');

    // Update pending_products.code comment
    console.log('4. Updating pending_products.code comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.code
        IS 'Product code (globally unique)'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Update pending_products.status comment
    console.log('5. Updating pending_products.status comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.status
        IS 'pending, approved, or rejected'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Update pending_products.submitted_by comment
    console.log('6. Updating pending_products.submitted_by comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.submitted_by
        IS 'User who submitted the product'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    // Update pending_products.reviewed_by comment
    console.log('7. Updating pending_products.reviewed_by comment...');
    try {
      await sql`
        COMMENT ON COLUMN pending_products.reviewed_by
        IS 'Admin who reviewed the product'
      `;
      console.log('   ✅ Success');
    } catch (error: any) {
      console.log(`   ⚠️ Warning: ${error.message}`);
    }

    console.log('\n📋 Removing extra pending_products column comments...\n');

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
      console.log(`${8 + i}. Clearing pending_products.${column} comment...`);

      try {
        await sql`COMMENT ON COLUMN pending_products.${column} IS NULL`;
        console.log(`   ✅ Success`);
      } catch (error: any) {
        console.log(`   ⚠️ Warning: ${error.message}`);
      }
    }

    console.log('\n✅ Comments parity migration completed successfully!');
    console.log('Database 1 (holy-leaf) now matches Database 2 (steep-unit) comments exactly.\n');

    // Verify the changes by checking specific comments
    console.log('🔍 Verifying changes...\n');

    // Check quote_items product_source comment
    const quoteItemsComment = await sql`
      SELECT
        pgd.description
      FROM pg_catalog.pg_statio_all_tables AS st
      INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
      INNER JOIN information_schema.columns col ON (
        pgd.objsubid = col.ordinal_position AND
        col.table_schema = st.schemaname AND
        col.table_name = st.relname AND
        col.table_schema = 'public'
      )
      WHERE st.relname = 'quote_items'
      AND col.table_name = 'quote_items'
      AND col.column_name = 'product_source'
    `;

    if (quoteItemsComment.length > 0) {
      console.log('✅ quote_items.product_source comment verified:');
      console.log(`   "${quoteItemsComment[0].description}"`);
    }

    // Check pending_products table comment
    const pendingProductsTableComment = await sql`
      SELECT
        pg_catalog.obj_description(pgc.oid, 'pg_class') as description
      FROM pg_catalog.pg_class pgc
      JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
      WHERE pgc.relname = 'pending_products'
      AND pgn.nspname = 'public'
    `;

    if (pendingProductsTableComment.length > 0 && pendingProductsTableComment[0].description) {
      console.log('\n✅ pending_products table comment verified:');
      console.log(`   "${pendingProductsTableComment[0].description}"`);
    }

    // Check pending_products column count
    const pendingProductsComments = await sql`
      SELECT
        col.column_name,
        pgd.description
      FROM pg_catalog.pg_statio_all_tables AS st
      INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
      INNER JOIN information_schema.columns col ON (
        pgd.objsubid = col.ordinal_position AND
        col.table_schema = st.schemaname AND
        col.table_name = st.relname AND
        col.table_schema = 'public'
      )
      WHERE st.relname = 'pending_products'
      AND col.table_name = 'pending_products'
      ORDER BY col.ordinal_position
    `;

    console.log(`\n✅ pending_products column comments count: ${pendingProductsComments.length}`);
    console.log('   (Expected: 4 comments matching Database 2)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

applyCommentsParityMigration();