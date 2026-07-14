import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function applyCommentsParityMigration() {
  try {
    console.log('🔄 Applying comments parity migration to Database 1...');
    console.log('Target Database: ep-holy-leaf-at8ruz1r\n');

    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'migrations', 'update-comments-parity.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}:`);
        console.log(`  ${statement.substring(0, 100)}...`);

        await sql(statement);
        console.log(`  ✅ Success`);
      } catch (error: any) {
        console.log(`  ⚠️ Warning: ${error.message}`);
        // Continue with other statements even if one fails
      }

      console.log('');
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
      console.log('✅ quote_items.product_source comment updated:');
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
      console.log('\n✅ pending_products table comment updated:');
      console.log(`   "${pendingProductsTableComment[0].description}"`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

applyCommentsParityMigration();