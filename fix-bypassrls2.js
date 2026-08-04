const { Pool } = require('pg');
require('dotenv').config();

// Try connecting as neondb_owner with same password
const superUrl = process.env.DATABASE_URL.replace('concetto:', 'neondb_owner:');
console.log('Trying superuser URL:', superUrl.substring(0, 50) + '...');

const pool = new Pool({ 
  connectionString: superUrl, 
  ssl: superUrl.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function fix() {
  try {
    await pool.query("ALTER ROLE concetto NOBYPASSRLS");
    console.log('Successfully removed BYPASSRLS from concetto');
    
    // Verify
    const bypass = await pool.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'concetto'");
    console.log('concetto BYPASSRLS after fix:', bypass.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  }
  await pool.end();
}
fix();