const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function applyMigrations() {
  console.log('🚀 Applying RLS Migrations...\n');

  try {
    // Apply migration 013: RLS Foundation
    console.log('📋 Applying Migration 013: RLS Foundation...');
    const migration013 = fs.readFileSync(
      path.join(__dirname, 'migrations/013_enable_rls_foundation.sql'),
      'utf8'
    );

    await sql(migration013);
    console.log('  ✅ Migration 013 applied successfully\n');

    // Test RLS foundation
    console.log('🧪 Testing RLS Foundation...');
    const testResult = await sql`SELECT test_rls_foundation() as result`;
    console.log(`  ✅ RLS foundation test: ${testResult[0].result}\n`);

    // Apply migration 002: Quotes RLS
    console.log('📋 Applying Migration 002: Quotes Table RLS...');
    const migration002 = fs.readFileSync(
      path.join(__dirname, 'migrations/002_enable_rls_quotes.sql'),
      'utf8'
    );

    await sql(migration002);
    console.log('  ✅ Migration 002 applied successfully\n');

    // Verify RLS is enabled
    console.log('🔍 Verifying RLS Status...');
    const rlsStatus = await sql(`
      SELECT tablename, rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'quotes'
    `);

    if (rlsStatus[0] && rlsStatus[0].rls_enabled) {
      console.log('  ✅ RLS is enabled on quotes table\n');
    } else {
      console.log('  ❌ RLS is NOT enabled on quotes table\n');
    }

    // List RLS policies
    console.log('📋 RLS Policies on Quotes Table:');
    const policies = await sql(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'quotes'
      ORDER BY policyname
    `);

    if (policies.length === 0) {
      console.log('  ❌ No policies found');
    } else {
      policies.forEach(p => {
        console.log(`  ✅ ${p.policyname} (${p.cmd})`);
      });
    }

    console.log('\n✅ All RLS migrations applied successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

applyMigrations().then(() => {
  console.log('\n✅ Migration process complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});