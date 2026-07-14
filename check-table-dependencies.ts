import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function checkTableDependencies() {
  try {
    console.log('🔍 Checking objects that depend on pending_products table...\n');

    // Check for foreign key dependencies
    const fkDependencies = await sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'pending_products'
      AND ccu.table_schema = 'public'
      ORDER BY tc.table_name
    `;

    if (fkDependencies.length > 0) {
      console.log('Foreign Key Dependencies:');
      fkDependencies.forEach((dep: any) => {
        console.log(`  - ${dep.table_name}.${dep.column_name} -> pending_products.${dep.foreign_column_name}`);
      });
      console.log('');
    }

    // Check for views that depend on this table
    const viewDependencies = await sql`
      SELECT
        viewname as view_name,
        definition
      FROM pg_views
      WHERE schemaname = 'public'
      AND definition LIKE '%pending_products%'
    `;

    if (viewDependencies.length > 0) {
      console.log('View Dependencies:');
      viewDependencies.forEach((view: any) => {
        console.log(`  - ${view.view_name}`);
      });
      console.log('');
    }

    // Check for any quote_items dependencies (since we know it references pending_products)
    const quoteItemsCheck = await sql`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'quote_items'
      AND column_name LIKE '%pending%'
    `;

    if (quoteItemsCheck.length > 0) {
      console.log('quote_items columns that reference pending_products:');
      quoteItemsCheck.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('📋 DEPENDENCY SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total dependencies found: ${fkDependencies.length + viewDependencies.length}`);
    console.log('\n⚠️ These dependencies need to be handled before dropping the table.');
    console.log('   Usually, dropping the foreign key constraints first will resolve this.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkTableDependencies();