const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    console.log('=== Testing Query Structure ===\n');
    
    // Test exactly how the OAuth callback calls it
    console.log('1. Testing OAuth callback query method:');
    const [userJson] = await sql`SELECT find_user_by_id(${userId}::uuid) as user_data`;
    console.log('userJson type:', typeof userJson);
    console.log('userJson value:', userJson);
    console.log('userJson.user_data:', userJson?.user_data);
    
    if (userJson?.user_data) {
      console.log('\n2. user_data structure:', typeof userJson.user_data);
      
      // Check if it has the expected fields
      if (typeof userJson.user_data === 'object') {
        console.log('user_company_id from user_data:', userJson.user_data.user_company_id);
      }
    }
    
    // Test the correct way to call it
    console.log('\n3. Testing correct method (direct query):');
    const directResult = await sql`SELECT * FROM find_user_by_id(${userId}::uuid)`;
    console.log('Direct result:', directResult[0]);
    console.log('user_company_id from direct:', directResult[0]?.user_company_id);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Error details:', err);
    process.exit(1);
  }
})();
