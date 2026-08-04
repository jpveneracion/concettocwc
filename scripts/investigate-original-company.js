const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userId = 'e9aa274c-ab10-40e0-8f99-318fa1d16041';
    const badCompanyId = '1ebf8553-0391-45db-8ca0-3ec7b6de8e1d';
    console.log('=== Investigating Original Company Issue ===\n');
    
    // Check if this bad company ID exists
    console.log('1. Checking if bad company ID exists:', badCompanyId);
    const companyCheck = await sql`
      SELECT id, code, name FROM companies WHERE id = ${badCompanyId}::uuid
    `;
    
    if (companyCheck.length > 0) {
      console.log('✅ Company actually exists!', companyCheck[0]);
    } else {
      console.log('❌ Company does not exist - this is the problem');
      
      // Check what companies do exist
      console.log('\n2. What companies exist in the database:');
      const allCompanies = await sql`
        SELECT id, code, name FROM companies ORDER BY created_at DESC LIMIT 5
      `;
      
      if (allCompanies.length > 0) {
        console.log('Found', allCompanies.length, 'companies:');
        allCompanies.forEach((company, index) => {
          console.log(`  ${index + 1}. ${company.code} - ${company.name} (${company.id})`);
        });
      } else {
        console.log('❌ No companies exist at all');
      }
      
      // Check if there are any other users with valid company associations
      console.log('\n3. Checking other users with valid companies:');
      const otherUsers = await sql`
        SELECT id, email, company_id FROM users 
        WHERE company_id IS NOT NULL 
        AND id != ${userId}::uuid
        LIMIT 5
      `;
      
      if (otherUsers.length > 0) {
        console.log('Found', otherUsers.length, 'other users with companies:');
        otherUsers.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.email} - company: ${user.company_id}`);
        });
      } else {
        console.log('❌ No other users have company associations');
      }
    }
    
    // Check user creation time vs company creation time
    console.log('\n4. Timeline analysis:');
    const userTimeline = await sql`
      SELECT 
        id, 
        email, 
        company_id,
        created_at
      FROM users 
      WHERE id = ${userId}::uuid
    `;
    
    if (userTimeline.length > 0) {
      console.log('User created:', userTimeline[0].created_at);
      console.log('User company_id:', userTimeline[0].company_id);
      
      // Check if any companies exist from around that time
      const timelineCompanies = await sql`
        SELECT id, code, name, created_at 
        FROM companies 
        WHERE created_at <= ${userTimeline[0].created_at}::timestamp
        ORDER BY created_at DESC
        LIMIT 3
      `;
      
      if (timelineCompanies.length > 0) {
        console.log('\nCompanies that existed when user was created:');
        timelineCompanies.forEach((company, index) => {
          console.log(`  ${index + 1}. ${company.code} (${company.id}) - ${company.created_at}`);
        });
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Investigation failed:', err.message);
    process.exit(1);
  }
})();
