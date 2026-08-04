const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } 
});

async function test() {
  const client = await pool.connect();
  try {
    // Check if concetto has BYPASSRLS
    const role = await client.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'concetto'");
    console.log('concetto role:', role.rows[0]);
    
    // Check table owner and RLS
    const table = await client.query("SELECT tableowner, rowsecurity FROM pg_tables WHERE tablename = 'company_product_definitions'");
    console.log('Table:', table.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}
test();