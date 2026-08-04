const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  const client = await pool.connect();
  try {
    // Check what privileges neon_superuser actually has
    const privs = await client.query(`
      SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication
      FROM pg_roles
      WHERE rolname IN ('neon_superuser', 'neondb_owner', 'concetto')
    `);
    console.log('Role attributes:', privs.rows);
    
    // Check if concetto has any special grants
    const grants = await client.query(`
      SELECT * FROM information_schema.role_table_grants 
      WHERE grantee = 'concetto'
    `);
    console.log('\nTable grants:', grants.rows.length);
    
    // Can we create a new role?
    try {
      await client.query("CREATE ROLE test_app_role LOGIN PASSWORD 'test123' NOBYPASSRLS");
      console.log('\nCreated test role successfully');
      await client.query("DROP ROLE test_app_role");
    } catch (e) {
      console.log('\nCannot create role:', e.message);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
test();