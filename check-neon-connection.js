const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to Neon database successfully\n');

    // Check all tables
    const tablesResult = await client.query(`
      SELECT
        tablename,
        rowsecurity as rls_enabled,
        CASE
          WHEN rowsecurity = true THEN '✅ RLS Enabled'
          ELSE '❌ No RLS'
        END as rls_status
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    console.log(`=== DATABASE TABLES: ${tablesResult.rows.length} total ===\n`);

    tablesResult.rows.forEach(row => {
      console.log(`${row.tablename.padEnd(30)} ${row.rls_status}`);
    });

    // Check tables with company_id
    const companyTables = await client.query(`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE column_name = 'company_id'
      AND table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`\n=== TABLES WITH COMPANY_ID: ${companyTables.rows.length} ===\n`);
    companyTables.rows.forEach(row => {
      console.log(`✅ ${row.table_name}`);
    });

    // Check for RLS policies
    const policiesResult = await client.query(`
      SELECT
        tablename,
        COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY tablename;
    `);

    console.log(`\n=== RLS POLICIES BY TABLE ===\n`);
    if (policiesResult.rows.length === 0) {
      console.log('No RLS policies found in database');
    } else {
      policiesResult.rows.forEach(row => {
        console.log(`${row.tablename.padEnd(30)} ${row.policy_count} policies`);
      });
    }

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();