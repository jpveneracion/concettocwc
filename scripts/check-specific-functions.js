const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Checking specific functions used in signup ===');
    
    const functionsToCheck = [
      'check_company_exists',
      'check_user_exists_by_email_hash', 
      'create_company',
      'create_user'
    ];
    
    for (const funcName of functionsToCheck) {
      const result = await sql`
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = ${funcName}
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `;
      
      if (result.length > 0) {
        const hasAppRole = result[0].definition.includes('app.role');
        console.log(`${funcName}: ${hasAppRole ? '❌ HAS app.role check' : '✅ Clean'}`);
      } else {
        console.log(`${funcName}: ⚠️  NOT FOUND`);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
