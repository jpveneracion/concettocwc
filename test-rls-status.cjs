const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function test() {
  try {
    // Check if RLS is enabled on company_product_definitions
    const rlsResult = await pool.query(`
      SELECT rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'company_product_definitions'
    `);
    console.log('RLS enabled:', rlsResult.rows[0]);

    // Check policies
    const policies = await pool.query(`
      SELECT policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'company_product_definitions'
      ORDER BY policyname
    `);
    console.log('\nPolicies:');
    policies.rows.forEach(p => console.log(`  ${p.policyname}: ${p.cmd} - USING: ${p.qual ? 'YES' : 'NO'} - WITH CHECK: ${p.with_check ? 'YES' : 'NO'}`));

    // Check functions
    const functions = await pool.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('get_current_company_id', 'get_current_user_role', 'is_current_user_admin', 'is_current_user_superadmin', 'set_tenant_context', 'reset_tenant_context')
    `);
    console.log('\nRLS Functions:');
    functions.rows.forEach(f => console.log(`  ${f.proname}`));

    // Test if we can set context and query
    console.log('\n--- Testing RLS Context ---');
    const client = await pool.connect();
    try {
      await client.query("SELECT set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user')");
      
      const cid = await client.query("SELECT get_current_company_id()");
      console.log('Current company_id:', cid.rows[0]);
      
      const role = await client.query("SELECT get_current_user_role()");
      console.log('Current user_role:', role.rows[0]);
      
      const prods = await client.query("SELECT id, code, company_id FROM company_product_definitions");
      console.log('\nProducts visible to Company A user:', prods.rows.length);
      prods.rows.forEach(p => console.log(`  ${p.code} - company_id: ${p.company_id}`));
      
      await client.query("SELECT reset_tenant_context()");
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  await pool.end();
  process.exit(0);
}

test();