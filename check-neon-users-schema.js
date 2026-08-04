// Check actual Neon database users table structure
const { Client } = require('pg');

async function checkUsersTableStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    // Get actual column information from users table
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('📋 Users table columns:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})${col.column_default ? ` default: ${col.column_default}` : ''}`);
    });

    // Try a test query to see what the actual structure looks like
    console.log('\n🔍 Testing sample user query...');
    const testUser = await client.query('SELECT * FROM users LIMIT 1');
    if (testUser.rows.length > 0) {
      console.log('Sample user fields:', Object.keys(testUser.rows[0]));
      console.log('Sample user data:', testUser.rows[0]);
    } else {
      console.log('No users in database');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkUsersTableStructure();