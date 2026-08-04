const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Checking existing users ===');
    
    // Check if we have any users at all
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log('Total users:', userCount[0].count);
    
    if (userCount[0].count > 0) {
      // Get first few users (without passwords)
      const users = await sql`
        SELECT 
          id,
          email,
          company_id,
          role,
          created_at
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      console.log('\nRecent users:');
      users.forEach(user => {
        console.log(`- ${user.email} (ID: ${user.id}, Role: ${user.role})`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
