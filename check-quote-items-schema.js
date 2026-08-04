const { neon } = require('@neondatabase/serverless');

require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkQuoteItemsSchema() {
  console.log('🔍 Checking quote_items table schema...\n');

  try {
    // 1. Check if quote_items table exists
    const tableCheck = await sql(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'quote_items'
      AND table_schema = 'public'
    `);

    if (tableCheck.length === 0) {
      console.log('❌ quote_items table does not exist');
      process.exit(1);
    }

    console.log('✅ quote_items table exists\n');

    // 2. Get detailed schema
    const schema = await sql(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'quote_items'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('📋 SCHEMA STRUCTURE:');
    console.table(schema);
    console.log('');

    // 3. Check for company_id column
    const hasCompanyId = schema.some(col => col.column_name === 'company_id');
    console.log(`🔍 Company ID column: ${hasCompanyId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log('');

    // 4. Check for quote_id column
    const hasQuoteId = schema.some(col => col.column_name === 'quote_id');
    console.log(`🔍 Quote ID column: ${hasQuoteId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log('');

    // 5. Get foreign key constraints
    const constraints = await sql(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(c.oid) as constraint_definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'quote_items'
      AND c.contype = 'f'
    `);

    console.log('🔗 FOREIGN KEY CONSTRAINTS:');
    if (constraints.length === 0) {
      console.log('  No foreign key constraints found');
    } else {
      constraints.forEach(con => {
        console.log(`  📋 ${con.constraint_name}:`);
        console.log(`     ${con.constraint_definition}`);
      });
    }
    console.log('');

    // 6. Check existing indexes
    const indexes = await sql(`
      SELECT
        indexname as index_name,
        indexdef as index_definition
      FROM pg_indexes
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
      ORDER BY indexname
    `);

    console.log('📊 EXISTING INDEXES:');
    if (indexes.length === 0) {
      console.log('  No indexes found');
    } else {
      indexes.forEach(idx => {
        console.log(`  📋 ${idx.index_name}:`);
        console.log(`     ${idx.index_definition}`);
      });
    }
    console.log('');

    // 7. Check RLS status
    const rlsStatus = await sql(`
      SELECT rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'quote_items'
    `);

    console.log('🔒 RLS STATUS:');
    if (rlsStatus.length === 0) {
      console.log('  Unable to determine RLS status');
    } else {
      const status = rlsStatus[0].rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`  ${status}`);
    }
    console.log('');

    // 8. Current data volume
    const count = await sql(`SELECT COUNT(*) as count FROM quote_items`);
    console.log(`📊 DATA VOLUME: ${count[0].count} rows`);
    console.log('');

    // 9. Sample data analysis
    if (count[0].count > 0) {
      console.log('📋 SAMPLE DATA:');
      const sample = await sql(`
        SELECT * FROM quote_items
        LIMIT 3
      `);
      console.table(sample);
      console.log('');

      // 10. Check if quote_items are associated with quotes
      const quoteAssociation = await sql(`
        SELECT DISTINCT
          q.company_id as quote_company_id,
          COUNT(*) as item_count
        FROM quote_items qi
        JOIN quotes q ON qi.quote_id = q.id
        GROUP BY q.company_id
      `);

      console.log('🔗 QUOTE ASSOCIATION ANALYSIS:');
      if (quoteAssociation.length === 0) {
        console.log('  No quote associations found');
      } else {
        quoteAssociation.forEach(assoc => {
          console.log(`  Company ${assoc.quote_company_id}: ${assoc.item_count} items`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

checkQuoteItemsSchema().then(() => {
  console.log('\n✅ Schema analysis complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});