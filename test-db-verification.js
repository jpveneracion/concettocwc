/**
 * Test script to verify payment_verifications table structure and migration status
 * Run with: node test-db-verification.js
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
}

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Make sure .env.local file exists and contains DATABASE_URL');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function verifyMigration() {
  console.log('🔍 Verifying payment_verifications table structure...\n');

  try {
    // Check if table exists
    const tableCheck = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'payment_verifications'
      );
    `);

    const tableExists = tableCheck[0].exists;

    if (!tableExists) {
      console.error('❌ payment_verifications table does not exist in database');
      console.log('📋 Migration needs to be executed');
      return false;
    }

    console.log('✅ payment_verifications table exists\n');

    // Get table structure
    const columns = await sql(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'payment_verifications'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Table Structure:');
    console.log('─────────────────────────────────────────────────────────────');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable.padEnd(8)} ${defaultVal}`);
    });
    console.log('─────────────────────────────────────────────────────────────\n');

    // Check for required columns
    const requiredColumns = [
      'id', 'user_id', 'plan_id', 'screenshot_url', 'reference_number',
      'notes', 'status', 'admin_notes', 'admin_id', 'submitted_at',
      'reviewed_at', 'created_at', 'updated_at'
    ];

    const existingColumns = columns.map(c => c.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.error('❌ Missing required columns:', missingColumns.join(', '));
      return false;
    }

    console.log('✅ All required columns present\n');

    // Check for constraints
    const constraints = await sql(`
      SELECT
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'payment_verifications'
      AND constraint_schema = 'public';
    `);

    console.log('📋 Table Constraints:');
    console.log('─────────────────────────────────────────────────────────────');
    constraints.forEach(constraint => {
      console.log(`  ${constraint.constraint_name.padEnd(40)} ${constraint.constraint_type}`);
    });
    console.log('─────────────────────────────────────────────────────────────\n');

    // Check for foreign key constraints
    const foreignKeys = await sql(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'payment_verifications';
    `);

    console.log('📋 Foreign Key Constraints:');
    console.log('─────────────────────────────────────────────────────────────');
    foreignKeys.forEach(fk => {
      console.log(`  ${fk.constraint_name.padEnd(30)} ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    console.log('─────────────────────────────────────────────────────────────\n');

    // Check for indexes
    const indexes = await sql(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      AND schemaname = 'public'
      ORDER BY indexname;
    `);

    console.log('📋 Table Indexes:');
    console.log('─────────────────────────────────────────────────────────────');
    indexes.forEach(idx => {
      console.log(`  ${idx.indexname}`);
    });
    console.log('─────────────────────────────────────────────────────────────\n');

    // Check for required indexes
    const requiredIndexes = [
      'idx_payment_verifications_user_id',
      'idx_payment_verifications_plan_id',
      'idx_payment_verifications_status',
      'idx_payment_verifications_submitted_at',
      'idx_payment_verifications_reference_number',
      'idx_payment_verifications_admin_dashboard'
    ];

    const existingIndexes = indexes.map(i => i.indexname);
    const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));

    if (missingIndexes.length > 0) {
      console.warn('⚠️  Missing recommended indexes:', missingIndexes.join(', '));
    } else {
      console.log('✅ All recommended indexes present\n');
    }

    // Test basic database functions
    console.log('🧪 Testing database functions...\n');

    // Test count function
    try {
      const countResult = await sql('SELECT COUNT(*) as count FROM payment_verifications');
      console.log(`✅ Total verifications in database: ${countResult[0].count}`);
    } catch (error) {
      console.error('❌ Error counting verifications:', error.message);
    }

    // Test pending count
    try {
      const pendingResult = await sql("SELECT COUNT(*) as count FROM payment_verifications WHERE status = 'pending'");
      console.log(`✅ Pending verifications: ${pendingResult[0].count}`);
    } catch (error) {
      console.error('❌ Error counting pending verifications:', error.message);
    }

    // Test stats query
    try {
      const stats = await sql(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
          COUNT(*) FILTER (WHERE status = 'approved') as total_approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected
        FROM payment_verifications
      `);
      console.log(`✅ Status breakdown:`, stats[0]);
    } catch (error) {
      console.error('❌ Error getting status breakdown:', error.message);
    }

    console.log('\n🎉 Migration verification completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Run verification
verifyMigration().then(success => {
  process.exit(success ? 0 : 1);
});