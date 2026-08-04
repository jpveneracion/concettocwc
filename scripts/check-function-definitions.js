const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Checking current function definitions ===\n');
    
    // Check create_company
    const companyFunc = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'create_company'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;
    
    console.log('create_company definition:');
    console.log(companyFunc[0]?.definition || 'NOT FOUND');
    
    // Check create_user
    const userFunc = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'create_user'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;
    
    console.log('\ncreate_user definition:');
    console.log(userFunc[0]?.definition || 'NOT FOUND');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
