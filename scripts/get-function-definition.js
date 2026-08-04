const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Getting check_company_exists function definition ===');
    
    // Get function definition using pg_get_functiondef
    const result = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'check_company_exists'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;
    
    if (result.length === 0) {
      console.log('❌ Function not found');
    } else {
      console.log('Function definition:');
      console.log(result[0].definition);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
