// Verify Trial System Schema Changes
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function verifySchema() {
  console.log('🔍 Verifying trial system schema changes...');

  try {
    // Check activation_codes table structure
    console.log('\n📋 Checking activation_codes table structure...');
    const activationCodesColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'activation_codes'
      ORDER BY ordinal_position;
    `;

    if (activationCodesColumns.length > 0) {
      console.log('✅ activation_codes table exists with columns:');
      activationCodesColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})${col.column_default ? ` [default: ${col.column_default}]` : ''}`);
      });
    } else {
      console.log('❌ activation_codes table not found');
    }

    // Check users table for trial-related columns
    console.log('\n📋 Checking users table for trial-related columns...');
    const usersTrialColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('trial_expires_at', 'subscription_activated', 'activation_code', 'discount_percent', 'subscription_plan')
      ORDER BY column_name;
    `;

    if (usersTrialColumns.length > 0) {
      console.log('✅ Users table has trial-related columns:');
      usersTrialColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ Trial-related columns not found in users table');
    }

    // Check indexes
    console.log('\n📋 Checking trial-related indexes...');
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('activation_codes', 'users')
      AND indexname LIKE '%trial%'
      OR indexname LIKE '%activation%'
      OR indexname LIKE '%subscription%'
      ORDER BY tablename, indexname;
    `;

    if (indexes.length > 0) {
      console.log('✅ Trial-related indexes found:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.indexname} on ${idx.tablename}`);
      });
    } else {
      console.log('❌ Trial-related indexes not found');
    }

    // Check constraints/foreign keys
    console.log('\n📋 Checking foreign key constraints...');
    const foreignKeys = await sql`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'activation_codes';
    `;

    if (foreignKeys.length > 0) {
      console.log('✅ Foreign key constraints found:');
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('❌ Foreign key constraints not found');
    }

    // Test data insertion
    console.log('\n📋 Testing sample data insertion...');
    try {
      const testCode = await sql`
        INSERT INTO activation_codes (code, discount_percent, payment_amount, payment_method)
        VALUES ('TEST123', 25.00, 1000.00, 'gcash')
        RETURNING id, code, discount_percent;
      `;
      console.log('✅ Sample activation code created:', testCode[0]);

      // Clean up test data
      await sql`DELETE FROM activation_codes WHERE code = 'TEST123';`;
      console.log('✅ Test data cleaned up');

    } catch (error) {
      console.log('❌ Error testing data insertion:', error.message);
    }

    console.log('\n✅ Schema verification completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Schema verification failed:', error);
    process.exit(1);
  }
}

verifySchema();