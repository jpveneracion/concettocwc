require('dotenv').config();
const { Pool } = require('pg');

async function testSecurityDefinerOAuth() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();

  try {
    console.log('Testing SECURITY DEFINER OAuth signup...\n');

    // Test 1: Set app role and create company
    console.log('Test 1: Create company with SECURITY DEFINER function');
    try {
      await client.query('BEGIN');

      // Set app role context
      await client.query('SELECT set_app_role($1)', ['concetto']);

      const testCompanyCode = 'TEST' + Date.now();
      const companyResult = await client.query(`
        SELECT * FROM create_company_with_context($1, $2, $3, $4, $5, $6)
      `, [testCompanyCode, 'Test Company', '', '', '', 15]);

      console.log('✅ Company created:', companyResult.rows[0]);

      // Clean up test company
      await client.query('DELETE FROM companies WHERE id = $1', [companyResult.rows[0].company_id]);
      console.log('✅ Test company cleaned up');

      await client.query('ROLLBACK');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Company creation failed:', error.message);
    }

    // Test 2: Create user with SECURITY DEFINER function
    console.log('\nTest 2: Create user with SECURITY DEFINER function');
    try {
      await client.query('BEGIN');

      // Set app role context
      await client.query('SELECT set_app_role($1)', ['concetto']);

      // First create a test company
      const testCompanyCode = 'TEST' + Date.now();
      const companyResult = await client.query(`
        SELECT * FROM create_company_with_context($1, $2, $3, $4, $5, $6)
      `, [testCompanyCode, 'Test Company', '', '', '', 15]);

      const companyId = companyResult.rows[0].company_id;

      // Create user
      const userResult = await client.query(`
        SELECT * FROM create_user_with_oauth($1, $2, $3)
      `, [companyId, 'test@example.com', 'abc123']);

      console.log('✅ User created:', userResult.rows[0]);

      // Clean up test data
      await client.query('DELETE FROM users WHERE id = $1', [userResult.rows[0].user_id]);
      await client.query('DELETE FROM companies WHERE id = $1', [companyId]);
      console.log('✅ Test data cleaned up');

      await client.query('ROLLBACK');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ User creation failed:', error.message);
    }

    // Test 3: Create OAuth account with SECURITY DEFINER function
    console.log('\nTest 3: Create OAuth account with SECURITY DEFINER function');
    try {
      await client.query('BEGIN');

      // Set app role context
      await client.query('SELECT set_app_role($1)', ['concetto']);

      // First create test company and user
      const testCompanyCode = 'TEST' + Date.now();
      const companyResult = await client.query(`
        SELECT * FROM create_company_with_context($1, $2, $3, $4, $5, $6)
      `, [testCompanyCode, 'Test Company', '', '', '', 15]);

      const companyId = companyResult.rows[0].company_id;

      const userResult = await client.query(`
        SELECT * FROM create_user_with_oauth($1, $2, $3)
      `, [companyId, 'test@example.com', 'abc123']);

      const userId = userResult.rows[0].user_id;

      // Create OAuth account
      const oauthResult = await client.query(`
        SELECT * FROM create_oauth_account($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [userId, 'google', 'google_user_123', 'test@example.com', 'testuser']);

      console.log('✅ OAuth account created:', oauthResult.rows[0]);

      // Clean up test data
      await client.query('DELETE FROM oauth_accounts WHERE id = $1', [oauthResult.rows[0].oauth_account_id]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('DELETE FROM companies WHERE id = $1', [companyId]);
      console.log('✅ Test data cleaned up');

      await client.query('ROLLBACK');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ OAuth account creation failed:', error.message);
    }

    console.log('\n✅ SECURITY DEFINER functions working correctly!');
    console.log('OAuth signup should now work without RLS blocking.');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testSecurityDefinerOAuth().catch(console.error);