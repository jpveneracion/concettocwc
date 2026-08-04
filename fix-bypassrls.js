const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  const client = await pool.connect();
  try {
    await client.query("ALTER ROLE concetto NOBYPASSRLS");
    console.log('ALTER ROLE executed');
    
    const role = await client.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'concetto'");
    console.log('concetto role:', role.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
test();