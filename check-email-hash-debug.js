// Debug script to check the email_hash issue
const { Client } = require('pg');

async function debugEmailHash() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    const email = 'jpveneracion@gmail.com';

    // Check the user's email_hash
    const userResult = await client.query('SELECT id, email, email_hash, company_id FROM users WHERE id = $1', [userId]);
    console.log('👤 User record:', userResult.rows[0]);

    // Calculate what the email_hash should be
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

    const expectedHash = hashEmail(email);
    console.log('🔍 Expected email_hash for jpveneracion@gmail.com:', expectedHash);

    const actualHash = userResult.rows[0].email_hash;
    console.log('🔍 Actual email_hash in database:', actualHash);

    console.log('📧 Email field is NULL:', userResult.rows[0].email === null);
    console.log('🔐 Email exists but encrypted:', true);

    // Try to find by email_hash like OAuth does
    const lookupResult = await client.query('SELECT * FROM users WHERE email_hash = $1', [expectedHash]);
    console.log('🔍 User found by email_hash lookup:', lookupResult.rows.length > 0);

    if (lookupResult.rows.length > 0) {
      console.log('✅ Email hash lookup works - OAuth should find this user');
    } else {
      console.log('❌ Email hash lookup fails - OAuth cannot find this user');
      console.log('💡 Root cause: email_hash mismatch or NULL email field breaks OAuth user lookup');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

debugEmailHash();