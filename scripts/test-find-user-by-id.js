const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    console.log('=== Testing find_user_by_id Function ===\n');
    
    console.log('Calling find_user_by_id for user:', userId);
    const result = await sql`
      SELECT * FROM find_user_by_id(${userId}::uuid)
    `;
    
    console.log('Raw result:', result);
    
    if (result.length > 0) {
      const userData = result[0];
      console.log('\n✅ User data found:');
      console.log('user_id:', userData.user_id);
      console.log('user_email:', userData.user_email);
      console.log('user_company_id:', userData.user_company_id);
      console.log('user_role:', userData.user_role);
      
      if (!userData.user_company_id) {
        console.log('\n❌ PROBLEM: user_company_id is NULL!');
      } else {
        console.log('\n✅ Company ID is present:', userData.user_company_id);
      }
    } else {
      console.log('❌ No user data returned');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
})();
