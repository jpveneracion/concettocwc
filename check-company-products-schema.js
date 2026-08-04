const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkCompanyProductsSchema() {
  try {
    console.log('🔍 Checking company_products table schema...\n');

    const result = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_products'
      ORDER BY ordinal_position
    `;

    console.log('=== ACTUAL NEON company_products TABLE SCHEMA ===');
    result.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' (nullable)' : ''}${col.column_default ? ` (default: ${col.column_default})` : ''}`);
    });

  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    process.exit(1);
  }
}

checkCompanyProductsSchema();