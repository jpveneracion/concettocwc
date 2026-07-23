const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkDatabaseContext() {
  try {
    console.log('🔍 Checking current database context...\n');

    // Get current database
    const currentDB = await sql('SELECT current_database();');
    console.log('📊 Current Database:', currentDB[0].current_database);

    // Get current schema
    const currentSchema = await sql('SELECT current_schema();');
    console.log('📊 Current Schema:', currentSchema[0].current_schema);

    // Check if payment_settings exists in current schema
    const tableCheck = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = current_schema()
        AND table_name = 'payment_settings'
      );
    `);

    console.log('payment_settings exists in current schema:', tableCheck[0].exists);

    // Search for payment_settings in all schemas
    const allSchemas = await sql(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'payment_settings'
    `);

    if (allSchemas.length > 0) {
      console.log('\n🎯 Found payment_settings in these schemas:');
      allSchemas.forEach(schema => {
        console.log(`  - ${schema.table_schema}.${schema.table_name}`);
      });
    } else {
      console.log('\n❌ payment_settings not found in any schema');
    }

    // List all tables in current schema
    const tables = await sql(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
      ORDER BY table_name
      LIMIT 20
    `);

    console.log('\n📋 First 20 tables in current schema:');
    tables.forEach(table => console.log(`  - ${table.table_name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkDatabaseContext();