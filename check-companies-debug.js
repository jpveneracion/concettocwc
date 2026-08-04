const { Client } = require('pg');

async function checkCompanies() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check for company with code JPVENERACI
    const result = await client.query("SELECT * FROM companies WHERE code = 'JPVENERACI'");
    console.log('Companies with code JPVENERACI:', result.rows);

    // Check recent companies
    const recent = await client.query('SELECT code, name, email, created_at FROM companies ORDER BY created_at DESC LIMIT 10');
    console.log('Recent companies:', recent.rows);

    // Check if user jpveneracion@gmail.com exists
    const userCheck = await client.query("SELECT * FROM users WHERE email = 'jpveneracion@gmail.com'");
    console.log('Users with jpveneracion@gmail.com:', userCheck.rows);

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkCompanies();