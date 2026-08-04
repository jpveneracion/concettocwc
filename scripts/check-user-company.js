const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    console.log('=== Checking User Company Data ===\n');
    
    // Check using SECURITY DEFINER function
    console.log('1. Testing find_user_by_id SECURITY DEFINER function:');
    const userResult = await sql`
      SELECT * FROM find_user_by_id(${userId}::uuid)
    `;
    
    if (userResult.length > 0) {
      const userData = userResult[0];
      console.log('User found:', userData.user_email);
      console.log('Company ID:', userData.user_company_id);
      console.log('Role:', userData.user_role);
      
      if (!userData.user_company_id) {
        console.log('❌ PROBLEM: user_company_id is NULL');
        console.log('This is why companyId is undefined in session!');
      } else {
        console.log('✅ User has company_id:', userData.user_company_id);
        
        // Check if company exists
        console.log('\n2. Checking if company exists:');
        const companyResult = await sql`
          SELECT id, code, name FROM companies WHERE id = ${userData.user_company_id}::uuid
        `;
        
        if (companyResult.length > 0) {
          console.log('✅ Company found:', companyResult[0]);
        } else {
          console.log('❌ Company not found for ID:', userData.user_company_id);
        }
      }
    } else {
      console.log('❌ User not found!');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Check failed:', err.message);
    process.exit(1);
  }
})();
