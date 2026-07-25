const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkPaymentVerificationsSchema() {
  try {
    console.log('🔍 Checking payment_verifications table structure...\n');

    // Check if table exists
    const tableCheck = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'payment_verifications'
      );
    `);

    if (!tableCheck[0].exists) {
      console.log('❌ payment_verifications table does NOT exist');
      return;
    }

    console.log('✅ payment_verifications table exists\n');

    // Get all columns
    const columns = await sql(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_verifications'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check for promo_code field
    const promoCodeColumn = columns.find(col => col.column_name === 'promo_code');

    console.log('\n🔍 promo_code field analysis:');
    if (promoCodeColumn) {
      console.log(`✅ promo_code field EXISTS!`);
      console.log(`  Type: ${promoCodeColumn.data_type}`);
      console.log(`  Nullable: ${promoCodeColumn.is_nullable === 'YES' ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ promo_code field NOT FOUND in payment_verifications table');
      console.log('💡 Need to add promo_code field to store promo codes with payment verifications');
    }

    // Check for recent data to see if any records have promo_code
    console.log('\n📊 Sample records (if any):');
    const recentRecords = await sql(`
      SELECT id, user_id, plan_id, status, submitted_at
      FROM payment_verifications
      ORDER BY submitted_at DESC
      LIMIT 3
    `);

    if (recentRecords.length > 0) {
      recentRecords.forEach(record => {
        console.log(`  - ID: ${record.id}, User: ${record.user_id}, Plan: ${record.plan_id}, Status: ${record.status}`);
      });
    } else {
      console.log('  No records found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPaymentVerificationsSchema();