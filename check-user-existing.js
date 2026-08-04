// Debug script to check if user exists and what their company association should be
const { Client } = require('pg');

async function debugUserLookup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const email = 'jpveneracion@gmail.com';
    const expectedCompanyId = '1ebf8553-0391-45db-8ca0-3ec7b6de8e1d';

    // Check if user exists
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('👤 User exists:', userResult.rows.length > 0);
    if (userResult.rows.length > 0) {
      console.log('User data:', userResult.rows[0]);
    }

    // Check by email hash (using the same logic as findUserByEmail)
    function hashEmail(email) {
      const normalized = email.toLowerCase().trim();
      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16) + normalized.length.toString(16);
    }

    const emailHash = hashEmail(email);
    console.log('🔍 Email hash:', emailHash);

    const hashResult = await client.query('SELECT * FROM users WHERE email_hash = $1', [emailHash]);
    console.log('👤 User found by hash:', hashResult.rows.length > 0);
    if (hashResult.rows.length > 0) {
      console.log('User data:', hashResult.rows[0]);
    }

    // Check if the expected company exists
    const companyResult = await client.query('SELECT * FROM companies WHERE id = $1', [expectedCompanyId]);
    console.log('🏢 Expected company exists:', companyResult.rows.length > 0);
    if (companyResult.rows.length > 0) {
      console.log('Company data:', companyResult.rows[0]);
    }

    // Check if there are any OAuth accounts for this email
    const oauthResult = await client.query('SELECT * FROM oauth_accounts WHERE email = $1', [email]);
    console.log('🔐 OAuth accounts found:', oauthResult.rows.length);
    if (oauthResult.rows.length > 0) {
      console.log('OAuth data:', oauthResult.rows[0]);
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

debugUserLookup();