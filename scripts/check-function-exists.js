const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Checking if check_company_exists function exists ===');
    
    // Check if function exists
    const funcCheck = await sql`
      SELECT routine_name, routine_definition, security_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'check_company_exists'
    `;
    
    if (funcCheck.length === 0) {
      console.log('❌ Function check_company_exists does NOT exist');
    } else {
      console.log('✅ Function exists:');
      console.log('Security type:', funcCheck[0].security_type);
      console.log('Definition:', funcCheck[0].routine_definition?.substring(0, 200) + '...');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
