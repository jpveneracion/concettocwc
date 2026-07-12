const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
  try {
    console.log('Checking database schema...\n');

    // Check users table for trial columns
    const usersResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('trial_expires_at', 'subscription_activated', 'activation_code', 'discount_percent', 'subscription_plan')
      ORDER BY column_name
    `);

    console.log('📋 USERS TABLE TRIAL COLUMNS:');
    if (usersResult.rows.length === 0) {
      console.log('❌ No trial columns found in users table - MIGRATION NOT APPLIED');
    } else {
      usersResult.rows.forEach(row => {
        console.log(`✅ ${row.column_name}: ${row.data_type}`);
      });
    }

    // Check if activation_codes table exists
    const activationTableResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'activation_codes'
    `);

    console.log('\n📋 ACTIVATION_CODES TABLE:');
    if (activationTableResult.rows.length === 0) {
      console.log('❌ activation_codes table does not exist - MIGRATION NOT APPLIED');
    } else {
      console.log('✅ activation_codes table exists');

      // Check columns in activation_codes
      const columnsResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'activation_codes'
        ORDER BY column_name
      `);

      console.log('📋 ACTIVATION_CODES TABLE COLUMNS:');
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();