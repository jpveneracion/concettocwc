const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  // Check current user
  const user = await pool.query('SELECT current_user, session_user, current_setting(\'is_superuser\') as is_superuser');
  console.log('Current user:', user.rows[0]);
  
  // Check table owner
  const owner = await pool.query("SELECT tableowner FROM pg_tables WHERE tablename = 'company_product_definitions'");
  console.log('Table owner:', owner.rows[0]);
  
  // Check if RLS is forced for table owner
  const rls = await pool.query("SELECT rowsecurity, forcerowsecurity FROM pg_tables WHERE tablename = 'company_product_definitions'");
  console.log('RLS settings:', rls.rows[0]);
  
  // Check if current user is table owner or superuser
  const roles = await pool.query('SELECT rolname, rolsuper FROM pg_roles WHERE rolname = current_user');
  console.log('Current user role:', roles.rows[0]);
  
  await pool.end();
}
test();