const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];

const sql = neon(process.env.DATABASE_URL);

const unprotectedTables = ['activation_codes', 'gateway_device_heartbeat', 'gcash_webhook_data'];

async function getDetailedSchema(tableName) {
  try {
    const columns = await sql(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    const constraints = await sql(`
      SELECT
        con.conname as constraint_name,
        con.contype as constraint_type,
        con.consrc as constraint_source
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = $1
      AND nsp.nspname = 'public';
    `, [tableName]);

    return { columns, constraints };
  } catch (error) {
    console.error(`Error getting schema for ${tableName}:`, error.message);
    return { columns: [], constraints: [] };
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
  console.log('=== DETAILED SCHEMA ANALYSIS FOR UNPROTECTED TABLES ===\n');

  for (const tableName of unprotectedTables) {
    console.log(`=== TABLE: ${tableName} ===`);

    const stats = await getTableStats(tableName);
    console.log(`ROW COUNT: ${stats}`);
    console.log(`STATUS: EXISTS (needs RLS implementation)`);

    const { columns, constraints } = await getDetailedSchema(tableName);

    console.log('\nCOLUMNS:');
    for (const col of columns) {
      let colInfo = `  ${col.column_name}: ${col.data_type}`;
      if (col.character_maximum_length) {
        colInfo += `(${col.character_maximum_length})`;
      }
      if (col.is_nullable === 'NO') {
        colInfo += ' NOT NULL';
      }
      if (col.column_default) {
        colInfo += ` DEFAULT ${col.column_default}`;
      }
      console.log(colInfo);
    }

    if (constraints.length > 0) {
      console.log('\nCONSTRAINTS:');
      for (const constraint of constraints) {
        const type = constraint.constraint_type === 'c' ? 'CHECK' :
                     constraint.constraint_type === 'f' ? 'FOREIGN KEY' :
                     constraint.constraint_type === 'p' ? 'PRIMARY KEY' :
                     constraint.constraint_type === 'u' ? 'UNIQUE' : 'UNKNOWN';
        console.log(`  ${type}: ${constraint.constraint_source || constraint.constraint_name}`);
      }
    }

    // Check for company context
    const hasCompanyId = columns.some(col => col.column_name === 'company_id');
    const hasUserId = columns.some(col => col.column_name === 'user_id' || col.column_name === 'created_by' || col.column_name === 'used_by');

    console.log('\nCOMPANY CONTEXT ANALYSIS:');
    console.log(`  Has company_id column: ${hasCompanyId ? 'YES' : 'NO'}`);
    console.log(`  Has user context columns: ${hasUserId ? 'YES' : 'NO'}`);

    if (!hasCompanyId && !hasUserId) {
      console.log('  ⚠️  WARNING: No obvious company or user context - requires schema analysis');
    } else if (!hasCompanyId && hasUserId) {
      console.log('  ℹ️  Will need indirect company context through users relationship');
    } else if (hasCompanyId) {
      console.log('  ✅ Has direct company_id column - RLS implementation straightforward');
    }

    console.log('\n');
  }
}

main().catch(console.error);