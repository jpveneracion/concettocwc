const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Testing SECURITY DEFINER function JSON return ===');
    
    // Test the function directly
    const result = await sql`SELECT find_user_by_email('lbveneracion@gmail.com') as user_json`;
    console.log('Raw result:', JSON.stringify(result, null, 2));
    
    if (result.length > 0 && result[0].user_json) {
      console.log('user_json type:', typeof result[0].user_json);
      console.log('user_json value:', result[0].user_json);
      
      // Check if it's already an object or needs parsing
      let userData;
      if (typeof result[0].user_json === 'string') {
        userData = JSON.parse(result[0].user_json);
        console.log('Parsed user data:', JSON.stringify(userData, null, 2));
      } else {
        userData = result[0].user_json;
        console.log('User data (already object):', JSON.stringify(userData, null, 2));
      }
      
      console.log('User ID:', userData.user_id);
      console.log('Email:', userData.email);
      console.log('Company ID:', userData.company_id);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
