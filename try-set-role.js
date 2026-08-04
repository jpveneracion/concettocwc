const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  const client = await pool.connect();
  try {
    // Check if we can SET ROLE to neon_superuser
    await client.query("SET ROLE neon_superuser");
    const current = await client.query("SELECT current_user, session_user");
    console.log('After SET ROLE:', current.rows[0]);
    
    // Now try ALTER ROLE
    await client.query("ALTER ROLE concetto NOBYPASSRLS");
    console.log('ALTER ROLE succeeded!');
    
    const role = await client.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'concetto'");
    console.log('concetto role:', role.rows[0]);
    
    await client.query("RESET ROLE");
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
test();