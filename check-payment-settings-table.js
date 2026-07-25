const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

async function checkPaymentSettingsTable() {
  try {
    console.log('🔍 Checking payment_settings table structure...\n');

    // Check if table exists
    const tableCheck = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'payment_settings'
      );
    `);

    if (!tableCheck[0].exists) {
      console.log('❌ payment_settings table does NOT exist');
      console.log('💡 You need to run migrations 003, 005, and 006 first');
      return;
    }

    console.log('✅ payment_settings table exists\n');

    // Get all columns
    const columns = await sql(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_settings'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check for old vs new column names
    const oldColumns = columns.filter(col =>
      col.column_name.includes('basic') ||
      col.column_name.includes('pro') ||
      col.column_name.includes('premium')
    );

    const newColumns = columns.filter(col =>
      col.column_name.includes('monthly') ||
      col.column_name.includes('quarterly') ||
      col.column_name.includes('annual')
    );

    console.log('\n🔍 Analysis:');
    if (oldColumns.length > 0) {
      console.log(`❌ Found ${oldColumns.length} OLD columns (basic/pro/premium):`);
      oldColumns.forEach(col => console.log(`  - ${col.column_name}`));
    } else {
      console.log('✅ No old column names found');
    }

    if (newColumns.length > 0) {
      console.log(`✅ Found ${newColumns.length} NEW columns (monthly/quarterly/annual):`);
      newColumns.forEach(col => console.log(`  - ${col.column_name}`));
    } else {
      console.log('❌ No new column names found');
    }

    // Check data
    console.log('\n📊 Current data:');
    const data = await sql('SELECT * FROM payment_settings LIMIT 5');
    data.forEach(row => {
      console.log(`Payment Method: ${row.payment_method}`);
      console.log(`  Account: ${row.account_number} (${row.account_name})`);
      console.log(`  Active: ${row.active}`);
      console.log(`  QR Code: ${row.qr_code_url ? '✅' : '❌'}`);

      // Show old columns
      if (oldColumns.length > 0) {
        console.log('  Old QR columns:');
        oldColumns.forEach(col => {
          const value = row[col.column_name];
          console.log(`    ${col.column_name}: ${value || '(empty)'}`);
        });
      }

      // Show new columns
      if (newColumns.length > 0) {
        console.log('  New QR columns:');
        newColumns.forEach(col => {
          const value = row[col.column_name];
          console.log(`    ${col.column_name}: ${value || '(empty)'}`);
        });
      }
      console.log('');
    });

    console.log('💡 Migration needed:');
    if (oldColumns.length > 0 && newColumns.length === 0) {
      console.log('✅ Run migration 007 to rename columns from basic/pro/premium to monthly/quarterly/annual');
    } else if (oldColumns.length === 0 && newColumns.length > 0) {
      console.log('✅ Migration complete! Column names are already updated.');
    } else if (oldColumns.length === 0 && newColumns.length === 0) {
      console.log('❌ No QR code columns found. Run migration 005 first.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPaymentSettingsTable();