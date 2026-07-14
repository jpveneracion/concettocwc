const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const DATABASE_URL = 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-steep-unit-atwaadwx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function runMigration() {
  try {
    console.log('🔄 Running company product system migration...');

    // Read the company product migration file
    const companyProductMigration = fs.readFileSync('migrations/company-product-system.sql', 'utf8');

    // Create company_product_definitions table
    console.log('Creating company_product_definitions table...');
    await sql(companyProductMigration);
    console.log('✅ company_product_definitions table created');

    console.log('\n✅ Migration completed successfully!');

    // Verify table creation
    const companyProductTables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'company_product_definitions'
    `;
    console.log('✅ company_product_definitions table verified:', companyProductTables.length > 0);

    // Check table structure
    const tableStructure = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'company_product_definitions'
      ORDER BY ordinal_position
    `;
    console.log('\n📋 company_product_definitions table structure:');
    console.log(tableStructure);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();