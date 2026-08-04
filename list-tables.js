/**
 * Simple script to list all tables in the Neon database
 * Usage: node list-tables.js
 */

// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false,
  },
});

async function listTables() {
  const client = await pool.connect();

  try {
    // Query to get all tables in the current database
    // Excluding system tables and schemas
    const query = `
      SELECT
        schemaname,
        tablename,
        tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `;

    const result = await client.query(query);

    console.log('📊 Tables in Neon Database:');
    console.log('===========================================');

    if (result.rows.length === 0) {
      console.log('No tables found in user schemas.');
    } else {
      // Group by schema
      const tablesBySchema = result.rows.reduce((acc, row) => {
        if (!acc[row.schemaname]) {
          acc[row.schemaname] = [];
        }
        acc[row.schemaname].push(row.tablename);
        return acc;
      }, {});

      // Display tables grouped by schema
      for (const [schema, tables] of Object.entries(tablesBySchema)) {
        console.log(`\n📁 Schema: ${schema}`);
        console.log(`   Tables: ${tables.length}`);
        tables.forEach(table => {
          console.log(`   - ${table}`);
        });
      }
    }

    console.log(`\n📈 Total: ${result.rows.length} tables`);

  } catch (error) {
    console.error('❌ Error listing tables:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

listTables().then(() => {
  console.log('\n✅ Successfully listed all tables');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});