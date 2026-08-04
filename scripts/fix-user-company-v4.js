const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    const userEmail = 'jpveneracion@gmail.com';
    console.log('=== Fixing User Company Association ===\n');
    
    // Create company using correct function signature
    console.log('1. Creating company using create_company function:');
    const companyCode = 'JPVENCOMP';
    const companyName = "John Paul Veneracion's Company";
    
    const companyResult = await sql`
      SELECT create_company(
        ${companyCode}::text,
        ${companyName}::text,
        NULL::text,
        NULL::text,
        ${userEmail}::text,
        NULL::text,
        15::numeric
      )
    `;
    
    console.log('Raw company result:', companyResult);
    
    if (companyResult.length > 0) {
      let companyData = companyResult[0].create_company;
      console.log('Company data type:', typeof companyData);
      console.log('Company data value:', companyData);
      
      let companyId;
      if (typeof companyData === 'string') {
        companyId = JSON.parse(companyData).id;
      } else if (typeof companyData === 'object') {
        companyId = companyData.id;
      } else {
        throw new Error('Unexpected company data format');
      }
      
      console.log('✅ Company created successfully. Company ID:', companyId);
      
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
          
          console.log('\n✅✅✅ FIX COMPLETE! User now has valid company association.');
          console.log('OAuth login should work correctly now.');
        }
      }
    } else {
      console.log('❌ Failed to create company');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    console.error('Error details:', err);
    process.exit(1);
  }
})();
