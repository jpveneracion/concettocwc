const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  const client = await pool.connect();
  try {
    // Set context as regular user
    await client.query("SELECT set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user')");
    
    // Test the RLS functions
    const cid = await client.query("SELECT get_current_company_id()");
    console.log('get_current_company_id:', cid.rows[0]);
    
    const role = await client.query("SELECT get_current_user_role()");
    console.log('get_current_user_role:', role.rows[0]);
    
    const isAdmin = await client.query("SELECT is_current_user_admin()");
    console.log('is_current_user_admin:', isAdmin.rows[0]);
    
    const isSuper = await client.query("SELECT is_current_user_superadmin()");
    console.log('is_current_user_superadmin:', isSuper.rows[0]);
    
    // Test the tenant isolation function
    const tenant = await client.query("SELECT is_current_tenant_company('60b8ae66-ffe5-4bab-bc9c-7d669f4ff6fc'::uuid)");
    console.log('is_current_tenant_company(other_company):', tenant.rows[0]);
    
    const tenant2 = await client.query("SELECT is_current_tenant_company('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)");
    console.log('is_current_tenant_company(our_company):', tenant2.rows[0]);
    
    // Check what the policy USING clause evaluates to for a specific row
    const policyTest = await client.query(`
      SELECT 
        company_id,
        code,
        ((get_current_company_id() IS NOT NULL) AND (company_id = get_current_company_id())) OR is_current_user_superadmin() as tenant_isolation_result
      FROM company_product_definitions
      LIMIT 10
    `);
    console.log('\nPolicy evaluation for each row:');
    policyTest.rows.forEach(r => console.log(`  ${r.code}: company_id=${r.company_id}, match=${r.tenant_isolation_result}`));
    
  } finally {
    await client.query("SELECT reset_tenant_context()");
    client.release();
  }
  await pool.end();
}
test();