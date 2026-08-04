const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Finding Available Companies ===\n');
    
    // Get all companies
    const companies = await sql`
      SELECT id, code, name FROM companies ORDER BY created_at DESC LIMIT 10
    `;
    
    console.log('Available companies:');
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.code} - ${company.name} (${company.id})`);
    });
    
    if (companies.length === 0) {
      console.log('❌ No companies found!');
      console.log('Need to create a company for the user.');
    } else {
      console.log(`\n✅ Found ${companies.length} companies`);
      console.log('Can assign user to one of these companies.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Check failed:', err.message);
    process.exit(1);
  }
})();
