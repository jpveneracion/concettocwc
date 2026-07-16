// Run with: node scripts/verify-payment-verification-migration.js
// Make sure DATABASE_URL is set in your .env.local

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function verify() {
  console.log('Verifying payment verification system migration...');

  try {
    // Check if table exists
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'payment_verifications'
    `;

    if (tableCheck.length === 0) {
      console.log('❌ payment_verifications table does not exist');
      console.log('\n📋 To run the migration manually:');
      console.log('1. Go to https://console.neon.tech/');
      console.log('2. Open SQL Editor for your project');
      console.log('3. Copy and run the contents of: migrations/001_create_payment_verifications_table.sql');
      console.log('4. Run this verification script again');
      process.exit(1);
    }

    console.log('✅ payment_verifications table exists');

    // Check table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'payment_verifications'
      ORDER BY ordinal_position
    `;

    console.log('\n📊 Table Structure:');
    console.table(columns);

    // Check indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      ORDER BY indexname
    `;

    console.log('\n📈 Indexes:');
    if (indexes.length > 0) {
      indexes.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
    } else {
      console.log('  No indexes found');
    }

    // Check constraints
    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'payment_verifications'
      ORDER BY constraint_type, constraint_name
    `;

    console.log('\n🔒 Constraints:');
    if (constraints.length > 0) {
      constraints.forEach(constraint => {
        console.log(`  - ${constraint.constraint_name} (${constraint.constraint_type})`);
      });
    } else {
      console.log('  No constraints found');
    }

    // Sample query to check if we can query the table
    const sampleQuery = await sql`
      SELECT COUNT(*) as count
      FROM payment_verifications
    `;

    console.log('\n📝 Current Records:', sampleQuery[0].count);
    console.log('\n✅ Payment verification system migration verified successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

verify();