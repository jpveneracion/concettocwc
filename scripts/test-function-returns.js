const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Testing function return types ===\n');
    
    // Test create_company return structure
    console.log('Testing create_company:');
    const companyTest = await sql`SELECT create_company('TEST123', 'Test Company', NULL, NULL, NULL, NULL, 15) as company`;
    console.log('Raw company result:', JSON.stringify(companyTest, null, 2));
    
    // Test create_user return structure  
    console.log('\nTesting create_user:');
    const userTest = await sql`SELECT create_user('test@test.com', 'hash123', 'hash456', '00000000-0000-0000-0000-000000000001'::uuid, 'user') as user`;
    console.log('Raw user result:', JSON.stringify(userTest, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
