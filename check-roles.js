const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  const client = await pool.connect();
  try {
    // Check current user and roles
    const current = await client.query("SELECT current_user, session_user");
    console.log('Current user:', current.rows[0]);
    
    // Check if we're in a role with admin option
    const roles = await client.query(`
      SELECT r.rolname, r.rolsuper, r.rolcreaterole, r.rolbypassrls
      FROM pg_roles r
      WHERE r.rolname IN ('concetto', 'neondb_owner', current_user)
    `);
    console.log('\nRoles:');
    roles.rows.forEach(r => console.log(r));
    
    // Check if concetto is a member of neondb_owner
    const members = await client.query(`
      SELECT m.rolname as member, r.rolname as role
      FROM pg_auth_members am
      JOIN pg_roles r ON r.oid = am.roleid
      JOIN pg_roles m ON m.oid = am.member
      WHERE m.rolname = 'concetto' OR r.rolname = 'neondb_owner'
    `);
    console.log('\nRole memberships:');
    members.rows.forEach(m => console.log(m));
    
  } finally {
    client.release();
    await pool.end();
  }
}
test();