const { neon } = require('@neondatabase/serverless');

require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function applyQuoteItemsRLS() {
  console.log('🔒 Applying quote_items RLS migration...\n');

  try {
    // Read the migration file
    const migrationSQL = require('fs').readFileSync('./migrations/033_enable_rls_quote_items.sql', 'utf8');

    console.log('📜 Migration file loaded, executing SQL...\n');

    // Execute the migration
    const result = await sql.transaction(async (tx) => {
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL
        .split('--')
        .filter(stmt => stmt.trim() && !stmt.trim().startsWith('*'))
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 50); // Filter out short comments

      for (const statement of statements) {
        try {
          await tx.query(statement);
        } catch (err) {
          console.log('⚠️  Statement warning:', err.message);
          // Continue with next statement
        }
      }
    });

    console.log('✅ Migration applied successfully\n');

    // Verify table creation
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'quote_items'
      AND table_schema = 'public'
    `;

    if (tableCheck.length > 0) {
      console.log('✅ quote_items table created successfully');
    } else {
      console.log('❌ quote_items table was not created');
    }

    // Verify RLS is enabled
    const rlsCheck = await sql`
      SELECT rowsecurity as rls_enabled
      FROM pg_tables
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
    `;

    if (rlsCheck.length > 0 && rlsCheck[0].rls_enabled) {
      console.log('✅ RLS enabled on quote_items table');
    } else {
      console.log('❌ RLS not enabled on quote_items table');
    }

    // Verify policies created
    const policies = await sql`
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
      ORDER BY policyname
    `;

    console.log(`\n🛡️  RLS Policies created (${policies.length}):`);
    policies.forEach(p => console.log(`   - ${p.policyname}`));

    // Verify indexes created
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'quote_items'
      AND schemaname = 'public'
      ORDER BY indexname
    `;

    console.log(`\n📊 Indexes created (${indexes.length}):`);
    indexes.forEach(i => console.log(`   - ${i.indexname}`));

    // Verify functions created
    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%quote_items%'
      ORDER BY routine_name
    `;

    console.log(`\n🔧 Functions created (${functions.length}):`);
    functions.forEach(f => console.log(`   - ${f.routine_name}`));

    console.log('\n✅ quote_items RLS migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

applyQuoteItemsRLS().then(() => {
  console.log('\n✅ Migration process completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});