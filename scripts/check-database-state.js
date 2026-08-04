const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Database State Assessment ===\n');
    
    // Count total users
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log('Total users:', userCount[0].count);
    
    // Count total companies
    const companyCount = await sql`SELECT COUNT(*) as count FROM companies`;
    console.log('Total companies:', companyCount[0].count);
    
    // Count users with vs without companies
    const userCompanyStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE company_id IS NOT NULL) as with_company,
        COUNT(*) FILTER (WHERE company_id IS NULL) as without_company
      FROM users
    `;
    console.log('\nUser company associations:');
    console.log('  With company:', userCompanyStats[0].with_company);
    console.log('  Without company:', userCompanyStats[0].without_company);
    
    // Get user details
    console.log('\nUser details:');
    const user = await sql`
      SELECT id, email, company_id, role, created_at 
      FROM users 
      WHERE email = 'jpveneracion@gmail.com'
    `;
    
    if (user.length > 0) {
      console.log('✅ User found:');
      console.log('  Email:', user[0].email);
      console.log('  ID:', user[0].id);
      console.log('  Company ID:', user[0].company_id || 'NULL');
      console.log('  Role:', user[0].role);
      console.log('  Created:', user[0].created_at);
    } else {
      console.log('❌ User not found');
    }
    
    // Check OAuth accounts
    console.log('\nOAuth accounts:');
    const oauthAccounts = await sql`
      SELECT id, user_id, provider, provider_user_id 
      FROM oauth_accounts 
      WHERE user_id = (SELECT id FROM users WHERE email = 'jpveneracion@gmail.com')
    `;
    
    if (oauthAccounts.length > 0) {
      console.log('✅ OAuth account found:', oauthAccounts[0]);
    } else {
      console.log('❌ No OAuth account found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Assessment failed:', err.message);
    process.exit(1);
  }
})();
