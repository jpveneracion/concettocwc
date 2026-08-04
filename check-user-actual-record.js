// Check the actual user record with all fields
const { Client } = require('pg');

async function checkActualUserRecord() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';

    // Get column names first
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('📋 User table columns:', columns.rows.map(c => c.column_name).join(', '));

    // Get the actual user record
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    console.log('👤 Actual user record:', userResult.rows[0]);

    // Specifically check email_hash
    if (userResult.rows[0]) {
      console.log('🔍 Email hash value:', userResult.rows[0].email_hash);
      console.log('🔍 Email value:', userResult.rows[0].email);
      console.log('🔍 Company ID:', userResult.rows[0].company_id);

      // Test what OAuth would find
      if (userResult.rows[0].email_hash) {
        const oauthLookup = await client.query(
          'SELECT * FROM users WHERE email_hash = $1',
          [userResult.rows[0].email_hash]
        );
        console.log('🔍 OAuth lookup by email_hash would find user:', oauthLookup.rows.length > 0);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkActualUserRecord();