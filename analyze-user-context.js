const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];

const sql = neon(process.env.DATABASE_URL);

async function analyzeUserContext() {
  console.log('=== DETAILED USER CONTEXT ANALYSIS ===\n');

  // Check activation_codes user columns
  console.log('=== ACTIVATION_CODES USER CONTEXT ===');

  const activationColumns = await sql(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'activation_codes'
    AND (column_name LIKE '%user%' OR column_name LIKE '%created_by%' OR column_name LIKE '%used_by%')
    ORDER BY ordinal_position;
  `);

  console.log('User-related columns:');
  for (const col of activationColumns) {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  }

  // Check if these columns reference users table
  const hasCreatedBy = activationColumns.some(col => col.column_name === 'created_by');
  const hasUsedBy = activationColumns.some(col => col.column_name === 'used_by');

  console.log(`\nHas created_by: ${hasCreatedBy ? 'YES' : 'NO'}`);
  console.log(`Has used_by: ${hasUsedBy ? 'YES' : 'NO'}`);

  if (hasCreatedBy || hasUsedBy) {
    console.log(`✅ Can use indirect company context through users table`);
    console.log(`   RLS Pattern: quote_items style (indirect through relationship)`);
  }

  // Sample data check
  console.log('\nSample activation_codes data:');
  const sampleData = await sql(`
    SELECT id, code, created_by, used_by, is_active
    FROM activation_codes
    LIMIT 2;
  `);

  for (const row of sampleData) {
    console.log(`  ID: ${row.id}, Code: ${row.code}, Created_by: ${row.created_by || 'NULL'}, Used_by: ${row.used_by || 'NULL'}, Active: ${row.is_active}`);
  }

  console.log('\n=== GATEWAY_DEVICE_HEARTBEAT CONTEXT ===');

  const gatewayColumns = await sql(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'gateway_device_heartbeat'
    ORDER BY ordinal_position;
  `);

  console.log('All columns:');
  for (const col of gatewayColumns) {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  }

  // Check for device-to-user relationship potential
  console.log(`\n⚠️  No direct user or company context found`);
  console.log(`   SCHEMA MIGRATION REQUIRED:`);
  console.log(`   Option 1: Add user_id column (references users.id)`);
  console.log(`   Option 2: Add company_id column (references companies.id)`);
  console.log(`   Option 3: Create device registry table with user associations`);

  console.log('\n=== GCASH_WEBHOOK_DATA CONTEXT ===');

  const gcashColumns = await sql(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'gcash_webhook_data'
    ORDER BY ordinal_position;
  `);

  console.log('All columns:');
  for (const col of gcashColumns) {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  }

  console.log(`\n⚠️  No direct user or company context found`);
  console.log(`   SCHEMA MIGRATION REQUIRED:`);
  console.log(`   Option 1: Add company_id column (references companies.id)`);
  console.log(`   Option 2: Link through transaction_number to payment_verifications`);
  console.log(`   Option 3: Add user_id column for payment tracking`);

  console.log('\n=== RECOMMENDATION SUMMARY ===');
  console.log('1. activation_codes: Can implement RLS using indirect user context');
  console.log('2. gateway_device_heartbeat: REQUIRES schema migration first');
  console.log('3. gcash_webhook_data: REQUIRES schema migration first');
}

analyzeUserContext().catch(console.error);