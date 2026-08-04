const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const companyId = '2da896c0-3e08-4e18-a32c-6b56e70117f5';
    console.log('=== Deleting Company I Created Without Permission ===\n');
    
    // First, check if any users are assigned to this company
    const userCheck = await sql`
      SELECT id, email FROM users WHERE company_id = ${companyId}::uuid
    `;
    
    if (userCheck.length > 0) {
      console.log('Found users assigned to this company:');
      userCheck.forEach(user => {
        console.log(`- ${user.email} (${user.id})`);
      });
      
      // Remove company_id from these users
      const updateResult = await sql`
        UPDATE users 
        SET company_id = NULL 
        WHERE company_id = ${companyId}::uuid
      `;
      console.log('✅ Removed company association from users');
    }
    
    // Now delete the company
    const deleteResult = await sql`
      DELETE FROM companies WHERE id = ${companyId}::uuid
      RETURNING code, name
    `;
    
    if (deleteResult.length > 0) {
      console.log('✅ Company deleted:', deleteResult[0]);
      console.log('\n✅✅✅ Cleanup complete. The company I created without permission has been removed.');
    } else {
      console.log('❌ Company not found (may have already been deleted)');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Delete failed:', err.message);
    process.exit(1);
  }
})();
