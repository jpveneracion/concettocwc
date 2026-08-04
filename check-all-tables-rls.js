const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];

const sql = neon(process.env.DATABASE_URL);

async function getAllTables() {
  try {
    const tables = await sql(`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    return tables;
  } catch (error) {
    console.error('Error getting tables:', error.message);
    return [];
  }
}

async function getTableStats(tableName) {
  try {
    const result = await sql(`SELECT COUNT(*) as count FROM ${tableName};`);
    return result[0]?.count || 0;
  } catch (error) {
    return 'ERROR';
  }
}

async function checkRLSStatus(tableName) {
  try {
    const result = await sql(`
      SELECT relrowsecurity as rls_enabled
      FROM pg_class
      WHERE relname = $1
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `, [tableName]);
    return result[0]?.rls_enabled || false;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('=== ALL DATABASE TABLES AND RLS STATUS ===\n');

  const tables = await getAllTables();

  let rlsProtected = 0;
  let rlsUnprotected = 0;

  for (const table of tables) {
    const tableName = table.table_name;
    const stats = await getTableStats(tableName);
    const rlsStatus = await checkRLSStatus(tableName);

    const status = rlsStatus ? '✅ RLS_ON' : '⚠️  RLS_OFF';

    console.log(`${status} | ${tableName} | ${stats} rows`);

    if (rlsStatus) {
      rlsProtected++;
    } else {
      rlsUnprotected++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total Tables: ${tables.length}`);
  console.log(`RLS Protected: ${rlsProtected} (${Math.round((rlsProtected/tables.length)*100)}%)`);
  console.log(`RLS Unprotected: ${rlsUnprotected} (${Math.round((rlsUnprotected/tables.length)*100)}%)`);
}

main().catch(console.error);