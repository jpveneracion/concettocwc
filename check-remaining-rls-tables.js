const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];

const sql = neon(process.env.DATABASE_URL);

const priorityTables = {
  high: [
    'quote_items',
    'subscription_items',
    'subscription_plans',
    'activation_codes',
    'payment_methods',
    'payment_settings',
    'gcash_webhook_data'
  ],
  medium: [
    'products',
    'pending_products',
    'pricing_config',
    'gateway_device_heartbeat'
  ],
  unknown: [
    'password_reset_tokens',
    'company_settings',
    'promo_codes',
    'revenue_sharing'
  ]
};

async function checkTableExists(tableName) {
  try {
    const result = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      );
    `, [tableName]);
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error.message);
    return false;
  }
}

async function getTableSchema(tableName) {
  try {
    const columns = await sql(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
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
    const result = await sql(`
      SELECT COUNT(*) as count FROM ${tableName};
    `);
    return result[0]?.count || 0;
  } catch (error) {
    console.error(`Error getting stats for ${tableName}:`, error.message);
    return null;
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
    console.error(`Error checking RLS status for ${tableName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== RLS IMPLEMENTATION STATUS CHECK ===\n');

  const allTables = [...priorityTables.high, ...priorityTables.medium, ...priorityTables.unknown];

  for (const tableName of allTables) {
    console.log(`=== TABLE: ${tableName} ===`);

    const exists = await checkTableExists(tableName);
    console.log(`STATUS: ${exists ? 'EXISTS' : 'DOES_NOT_EXIST'}`);

    if (exists) {
      const stats = await getTableStats(tableName);
      console.log(`ROW COUNT: ${stats}`);

      const rlsStatus = await checkRLSStatus(tableName);
      console.log(`RLS ENABLED: ${rlsStatus ? 'YES' : 'NO'}`);

      const schema = await getTableSchema(tableName);
      console.log('ACTUAL SCHEMA:');

      if (schema.length > 0) {
        for (const col of schema) {
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
      } else {
        console.log('  No columns found or error reading schema');
      }
    }

    console.log('');
  }
}

main().catch(console.error);