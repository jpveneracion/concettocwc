const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  // Check if concetto has BYPASSRLS
  const bypass = await pool.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'concetto'");
  console.log('concetto BYPASSRLS:', bypass.rows[0]);
  
  // Check if concetto is member of neondb_owner
  const member = await pool.query(`
    SELECT r.rolname as role, m.rolname as member
    FROM pg_roles r
    JOIN pg_auth_members am ON am.roleid = r.oid
    JOIN pg_roles m ON m.oid = am.member
    WHERE r.rolname = 'neondb_owner' AND m.rolname = 'concetto'
  `);
  console.log('concetto member of neondb_owner:', member.rows[0] ? 'YES' : 'NO');
  
  // Check table privileges
  const privs = await pool.query(`
    SELECT grantee, privilege_type 
    FROM information_schema.table_privileges 
    WHERE table_name = 'company_product_definitions' AND grantee IN ('concetto', 'PUBLIC')
  `);
  console.log('Table privileges:', privs.rows);
  
  // Test: try querying as superuser equivalent - use set role
  const client = await pool.connect();
  try {
    // Reset and set as superadmin
    await client.query("SELECT reset_tenant_context()");
    await client.query("SELECT set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin')");
    
    const prods = await client.query("SELECT id, code, company_id FROM company_product_definitions");
    console.log('\nAs superadmin, products visible:', prods.rows.length);
    prods.rows.forEach(p => console.log(`  ${p.code} - company_id: ${p.company_id}`));
  } finally {
    await client.query("SELECT reset_tenant_context()");
    client.release();
  }
  
  await pool.end();
}
test();