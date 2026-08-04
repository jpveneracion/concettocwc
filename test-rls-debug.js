const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  // First, set context to test company A
  await pool.query("SELECT set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user')");
  
  // Verify context
  const ctx = await pool.query('SELECT get_current_company_id(), get_current_user_role()');
  console.log('Context:', ctx.rows[0]);
  
  // Check if RLS is enabled on table
  const rls = await pool.query("SELECT rowsecurity FROM pg_tables WHERE tablename = 'company_product_definitions'");
  console.log('RLS enabled:', rls.rows[0].rowsecurity);
  
  // Check policies
  const policies = await pool.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'company_product_definitions'");
  console.log('\nPolicies:');
  policies.rows.forEach(p => console.log(' ', p.policyname, p.cmd, '|', p.qual?.substring(0, 100)));
  
  // Now query
  const products = await pool.query('SELECT id, code, company_id FROM company_product_definitions');
  console.log('\nProducts visible:', products.rows.length);
  products.rows.forEach(p => console.log(' ', p.code, p.company_id));
  
  await pool.end();
}
test();