const { neon } = require('@neondatabase/serverless');

require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function verifyQuoteItemsRLS() {
  console.log('🔍 Verifying quote_items RLS implementation...\n');

  try {
    // 1. Check if quote_items table exists
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'quote_items'
      AND table_schema = 'public'
    `;

    if (tableCheck.length > 0) {
      console.log('✅ quote_items table exists');
    } else {
      console.log('❌ quote_items table does not exist');
      process.exit(1);
    }

    // 2. Get table schema
    const schema = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quote_items'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 Table Schema:');
    console.table(schema);

    // 3. Check RLS status
    const rlsCheck = await sql`
      SELECT rowsecurity as rls_enabled
      FROM pg_tables
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
    `;

    if (rlsCheck.length > 0 && rlsCheck[0].rls_enabled) {
      console.log('✅ RLS is enabled on quote_items table');
    } else {
      console.log('❌ RLS is NOT enabled on quote_items table');
    }

    // 4. List RLS policies
    const policies = await sql`
      SELECT
        policyname,
        permissive,
        cmd,
        roles
      FROM pg_policies
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
      ORDER BY policyname
    `;

    console.log(`\n🛡️  RLS Policies (${policies.length}):`);
    if (policies.length === 0) {
      console.log('  ❌ No RLS policies found');
    } else {
      policies.forEach(p => {
        console.log(`   - ${p.policyname}`);
        console.log(`     Command: ${p.cmd}`);
        console.log(`     Roles: ${p.roles || 'PUBLIC'}`);
      });
    }

    // 5. List indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
      ORDER BY indexname
    `;

    console.log(`\n📊 Indexes (${indexes.length}):`);
    if (indexes.length === 0) {
      console.log('  ❌ No indexes found');
    } else {
      indexes.forEach(i => {
        console.log(`   - ${i.indexname}`);
      });
    }

    // 6. Check data volume
    const count = await sql`SELECT COUNT(*) as count FROM quote_items`;
    console.log(`\n📊 Current data volume: ${count[0].count} rows`);

    // 7. Check if test functions exist
    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND (routine_name = 'test_quote_items_rls' OR routine_name = 'audit_quote_items_security')
    `;

    console.log(`\n🔧 Test functions (${functions.length}):`);
    if (functions.length === 0) {
      console.log('  ❌ No test functions found');
    } else {
      functions.forEach(f => {
        console.log(`   - ${f.routine_name}`);
      });
    }

    // 8. Sample data analysis
    if (count[0].count > 0) {
      console.log('\n📋 Sample data:');
      const sample = await sql`
        SELECT * FROM quote_items
        LIMIT 3
      `;
      console.table(sample);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyQuoteItemsRLS().then(() => {
  console.log('\n✅ Verification complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});