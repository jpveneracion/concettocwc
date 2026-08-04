const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    const userEmail = 'jpveneracion@gmail.com';
    console.log('=== Fixing User Company Association ===\n');
    
    // Create a company for the user using SECURITY DEFINER function
    const companyCode = 'JPVENCOMP';
    const companyName = "John Paul Veneracion's Company";
    
    console.log('1. Creating company using SECURITY DEFINER function:');
    const companyResult = await sql`
      SELECT create_company_with_context(
        ${companyCode}::text,
        ${companyName}::text,
        NULL::text,
        NULL::text,
        ${userEmail}::text,
        NULL::text,
        15::numeric
      )
    `;
    
    if (companyResult.length > 0) {
      const companyId = companyResult[0].create_company_with_context;
      console.log('✅ Company created:', companyId);
      
      // Update user's company_id
      console.log('\n2. Updating user company_id:');
      const updateResult = await sql`
        UPDATE users 
        SET company_id = ${companyId}::uuid 
        WHERE id = ${userId}::uuid
        RETURNING id, email, company_id
      `;
      
      if (updateResult.length > 0) {
        console.log('✅ User updated:', {
          id: updateResult[0].id,
          email: updateResult[0].email,
          company_id: updateResult[0].company_id
        });
      } else {
        console.log('❌ Failed to update user');
      }
      
      // Verify the fix
      console.log('\n3. Verifying fix with SECURITY DEFINER function:');
      const verifyResult = await sql`
        SELECT * FROM find_user_by_id(${userId}::uuid)
      `;
      
      if (verifyResult.length > 0) {
        console.log('✅ User verification:', {
          user_email: verifyResult[0].user_email,
          user_company_id: verifyResult[0].user_company_id,
          user_role: verifyResult[0].user_role
        });
        
        // Verify company exists
        console.log('\n4. Verifying company exists:');
        const companyVerify = await sql`
          SELECT id, code, name FROM companies WHERE id = ${verifyResult[0].user_company_id}::uuid
        `;
        
        if (companyVerify.length > 0) {
          console.log('✅ Company verified:', companyVerify[0]);
          console.log('\n✅✅✅ FIX COMPLETE! User now has valid company association.');
          console.log('OAuth login should work correctly now.');
        } else {
          console.log('❌ Company still not found');
        }
      }
    } else {
      console.log('❌ Failed to create company');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  }
})();
