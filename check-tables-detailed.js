const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];

const sql = neon(process.env.DATABASE_URL);

const unprotectedTables = ['activation_codes', 'gateway_device_heartbeat', 'gcash_webhook_data'];

async function getTableSchema(tableName) {
  try {
    const columns = await sql(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    return columns;
  } catch (error) {
    console.error(`Error getting schema for ${tableName}:`, error.message);
    return [];
  }
}

async function getTableStats(tableName) {
  try {
    const result = await sql(`SELECT COUNT(*) as count FROM ${tableName};`);
    return result[0]?.count || 0;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('=== UNPROTECTED TABLES REQUIRING RLS ===\n');

  for (const tableName of unprotectedTables) {
    console.log(`=== TABLE: ${tableName} ===`);
    console.log(`STATUS: EXISTS`);
    console.log(`RLS: NOT ENABLED ⚠️`);

    const stats = await getTableStats(tableName);
    console.log(`ROW COUNT: ${stats}`);

    const columns = await getTableSchema(tableName);

    console.log(`\nACTUAL SCHEMA:`);
    if (columns.length > 0) {
      for (const col of columns) {
        let colInfo = `  ${col.column_name}: ${col.data_type}`;
        if (col.is_nullable === 'NO') {
          colInfo += ' NOT NULL';
        }
        if (col.column_default) {
          colInfo += ` DEFAULT ${col.column_default}`;
        }
        console.log(colInfo);
      }
    } else {
      console.log('  No columns found');
    }

    // Check for company context
    const hasCompanyId = columns.some(col => col.column_name === 'company_id');
    const hasUserId = columns.some(col => col.column_name.includes('user') && col.column_name.includes('_id'));

    console.log(`\nCOMPANY CONTEXT ANALYSIS:`);
    console.log(`  Has company_id: ${hasCompanyId ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Has user context: ${hasUserId ? 'YES ✅' : 'NO ❌'}`);

    if (!hasCompanyId && !hasUserId) {
      console.log(`  ⚠️  SCHEMA MIGRATION NEEDED: No company context found`);
    } else if (!hasCompanyId) {
      console.log(`  ℹ️  Will use indirect company context through users`);
    }

    console.log(`\n`);
  }

  console.log(`=== SUMMARY ===`);
  console.log(`Total unprotected tables: ${unprotectedTables.length}`);
  console.log(`Tables requiring schema migration: Need analysis`);
  console.log(`Estimated RLS migrations needed: 3`);
}

main().catch(console.error);