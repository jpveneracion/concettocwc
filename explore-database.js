#!/usr/bin/env node

// Quick database exploration script
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function exploreDatabase() {
  console.log('🔍 Exploring Neon Database Structure...\n');

  try {
    // 1. List all tables
    console.log('📋 ALL TABLES:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    console.log('');

    // 2. Check for existing RLS
    console.log('🔒 CURRENT RLS STATUS:');
    const rlsStatus = await sql(`
      SELECT
        schemaname,
        tablename,
        rowsecurity as rls_enabled,
        forcerowsecurity as rls_forced
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    rlsStatus.forEach(t => {
      const status = t.rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`  ${t.tablename}: ${status}${t.rls_forced ? ' (FORCED)' : ''}`);
    });
    console.log('');

    // 3. Check data volumes
    console.log('📊 DATA VOLUMES:');
    for (const table of tables) {
      const result = await sql(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
      console.log(`  ${table.table_name}: ${result[0].count} rows`);
    }
    console.log('');

    // 4. Check existing policies
    console.log('🛡️ EXISTING RLS POLICIES:');
    const policies = await sql(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    if (policies.length === 0) {
      console.log('  No RLS policies found');
    } else {
      policies.forEach(p => {
        console.log(`  📋 ${p.policyname} on ${p.tablename}`);
        console.log(`     Command: ${p.cmd}`);
        console.log(`     Roles: ${p.roles || 'PUBLIC'}`);
      });
    }
    console.log('');

    // 5. Check for custom functions
    console.log('⚙️ CUSTOM FUNCTIONS:');
    const functions = await sql(`
      SELECT
        routine_name,
        routine_type,
        data_type,
        security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name NOT LIKE 'pg_%'
      ORDER BY routine_name
    `);

    if (functions.length === 0) {
      console.log('  No custom functions found');
    } else {
      functions.forEach(f => {
        console.log(`  🔧 ${f.routine_name}(${f.data_type}) [${f.security_type}]`);
      });
    }
    console.log('');

    // 6. Check indexes on key tables
    console.log('🗂️ KEY INDEXES:');
    const keyTables = ['users', 'companies', 'quotes', 'oauth_accounts', 'payment_verifications'];
    for (const table of keyTables) {
      const indexes = await sql(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = '${table}'
        AND schemaname = 'public'
      `);
      if (indexes.length > 0) {
        console.log(`  📑 ${table}:`);
        indexes.forEach(i => {
          console.log(`     - ${i.indexname}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Database exploration failed:', error.message);
    process.exit(1);
  }
}

exploreDatabase().then(() => {
  console.log('\n✅ Database exploration complete');
  process.exit(0);
});