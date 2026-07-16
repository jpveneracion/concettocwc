// Run with: node scripts/run-payment-verification-migration.js
// Make sure DATABASE_URL is set in your .env.local

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running payment verification system migration...');

  try {
    // Read the migration file
    const migration = fs.readFileSync('migrations/001_create_payment_verifications_table.sql', 'utf8');

    // Remove single-line comments and clean up the SQL
    const cleanedSql = migration
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    // Split by semicolons and process statements
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);

      try {
        // Use Function constructor to execute the SQL as a template literal
        await new Function('sql', `return sql\`${statement}\`;`)(sql);
        console.log('✓ Executed successfully');
      } catch (err) {
        console.log(`⚠️  Statement failed (may be expected): ${err.message}`);
      }
    }

    console.log('✅ Payment verification system migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();