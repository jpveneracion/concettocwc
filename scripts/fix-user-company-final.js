const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    const userEmail = 'jpveneracion@gmail.com';
    console.log('=== Fixing User Company Association ===\n');
    
    // Check if the company already exists
    console.log('1. Checking if company exists:');
    const existingCompany = await sql`
      SELECT id, code, name FROM companies WHERE code = 'JPVENCOMP'
    `;
    
    let companyId;
    if (existingCompany.length > 0) {
      companyId = existingCompany[0].id;
      console.log('✅ Company already exists:', companyId);
    } else {
      // Create a new company with a different code
      console.log('2. Creating new company:');
      const companyCode = 'JPVEN' + Math.floor(Math.random() * 1000);
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
      
      if (companyResult.length > 0) {
        let companyData = companyResult[0].create_company;
        if (typeof companyData === 'string') {
          companyId = JSON.parse(companyData).id;
        } else {
          companyId = companyData.id;
        }
        console.log('✅ New company created. Company ID:', companyId);
      }
    }
    
    if (companyId) {
      // Update user's company_id
      console.log('\n3. Updating user company_id:');
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
        console.log('\n4. Verifying fix with SECURITY DEFINER function:');
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
          console.log('Please try OAuth login again.');
        }
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    console.error('Error details:', err);
    process.exit(1);
  }
})();
