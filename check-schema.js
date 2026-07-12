const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Check users table for trial columns
    const usersResult = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('trial_expires_at', 'subscription_activated', 'activation_code', 'discount_percent', 'subscription_plan')
      ORDER BY column_name
    `;

    console.log('📋 USERS TABLE TRIAL COLUMNS:');
    if (usersResult.length === 0) {
      console.log('❌ No trial columns found in users table - MIGRATION NOT APPLIED');
    } else {
      usersResult.forEach(row => {
        console.log(`✅ ${row.column_name}: ${row.data_type}`);
      });
    }

    // Check if activation_codes table exists
    const activationTableResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'activation_codes'
    `;

    console.log('\n📋 ACTIVATION_CODES TABLE:');
    if (activationTableResult.length === 0) {
      console.log('❌ activation_codes table does not exist - MIGRATION NOT APPLIED');
    } else {
      console.log('✅ activation_codes table exists');

      // Check columns in activation_codes
      const columnsResult = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'activation_codes'
        ORDER BY column_name
      `;

      console.log('📋 ACTIVATION_CODES TABLE COLUMNS:');
      columnsResult.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });

      // Check for any existing activation codes
      const codesCount = await sql`SELECT COUNT(*) as count FROM activation_codes`;
      console.log(`📊 Total activation codes: ${codesCount[0].count}`);
    }

    // Check for existing users with trial/subscription info
    const usersWithTrial = await sql`
      SELECT COUNT(*) as count FROM users
      WHERE trial_expires_at IS NOT NULL OR subscription_activated = true
    `;
    console.log(`📊 Users with trial/subscription: ${usersWithTrial[0].count}`);

  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkSchema();