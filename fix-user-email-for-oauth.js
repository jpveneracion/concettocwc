// Fix user email field to enable OAuth login
const { Client } = require('pg');
const crypto = require('crypto');

async function fixUserEmail() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    const email = 'jpveneracion@gmail.com';
    const companyId = '1ebf8553-0391-45db-8ca0-3ec7b6de8e1d';

    // Calculate email_hash using the same logic as the application
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
    console.log('🔍 Calculated email_hash:', emailHash);

    // Update the user record with the correct email and email_hash
    const updateResult = await client.query(
      'UPDATE users SET email = $1, email_hash = $2 WHERE id = $3 RETURNING id, email, email_hash, company_id',
      [email, emailHash, userId]
    );

    console.log('✅ Updated user record:', updateResult.rows[0]);
    console.log('🏢 User company ID:', updateResult.rows[0].company_id);

    // Verify the update worked
    const verifyResult = await client.query('SELECT * FROM users WHERE email_hash = $1', [emailHash]);
    console.log('🔍 OAuth lookup test - user found by email_hash:', verifyResult.rows.length > 0);

    if (verifyResult.rows.length > 0) {
      console.log('✅ OAuth should now be able to find this user and log them into their existing CWC company!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixUserEmail();