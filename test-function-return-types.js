require('dotenv').config();
const { Pool } = require('pg');

async function testFunctionReturnTypes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Testing SECURITY DEFINER function return types...\n');

    // Test create_user_with_oauth function
    console.log('Test 1: Check create_user_with_oauth return type');
    const result1 = await pool.query(`
      SELECT * FROM create_user_with_oauth(
        '00000000-0000-0000-0000-000000000001'::uuid,
        'test@example.com',
        'abc123'
      )
    `);

    console.log('Return type:', result1.rows[0]);
    console.log('Columns:', Object.keys(result1.rows[0]));

    // Test create_oauth_account function
    console.log('\nTest 2: Check create_oauth_account return type');
    const result2 = await pool.query(`
      SELECT * FROM create_oauth_account(
        '00000000-0000-0000-0000-000000000001'::uuid,
        'google',
        'google_user_123',
        'test@example.com',
        'testuser'
      )
    `);

    console.log('Return type:', result2.rows[0]);
    console.log('Columns:', Object.keys(result2.rows[0]));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testFunctionReturnTypes();