const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
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

const DATABASE_URL = process.env.DATABASE_URL;
const sql = neon(DATABASE_URL);

async function comprehensiveTest() {
  console.log('🔍 COMPREHENSIVE DATABASE MIGRATION VERIFICATION\n');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // 1. Table Existence
    console.log('\n1. TABLE EXISTENCE');
    const tableExists = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'payment_verifications'
      );
    `);

    if (tableExists[0].exists) {
      console.log('   ✅ payment_verifications table exists');
    } else {
      console.log('   ❌ payment_verifications table does NOT exist');
      return 'NEEDS_MIGRATION';
    }

    // 2. Column Structure
    console.log('\n2. COLUMN STRUCTURE');
    const columns = await sql(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'payment_verifications'
      ORDER BY ordinal_position;
    `);

    const expectedColumns = {
      'id': 'uuid',
      'user_id': 'uuid',
      'plan_id': 'character varying',
      'screenshot_url': 'text',
      'reference_number': 'character varying',
      'notes': 'text',
      'status': 'character varying',
      'admin_notes': 'text',
      'admin_id': 'uuid',
      'submitted_at': 'timestamp with time zone',
      'reviewed_at': 'timestamp with time zone',
      'created_at': 'timestamp with time zone',
      'updated_at': 'timestamp with time zone'
    };

    let columnIssues = [];
    columns.forEach(col => {
      const expected = expectedColumns[col.column_name];
      if (expected) {
        const match = col.data_type === expected ||
                    (expected === 'character varying' && col.data_type === 'character varying');
        if (match) {
          console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
        } else {
          console.log(`   ⚠️  ${col.column_name}: expected ${expected}, got ${col.data_type}`);
          columnIssues.push(col.column_name);
        }
      } else {
        console.log(`   ℹ️  ${col.column_name}: ${col.data_type} (additional column)`);
      }
    });

    // Check for missing columns
    const existingColumnNames = columns.map(c => c.column_name);
    const missingColumns = Object.keys(expectedColumns).filter(col => !existingColumnNames.includes(col));

    if (missingColumns.length > 0) {
      console.log(`   ❌ Missing columns: ${missingColumns.join(', ')}`);
      columnIssues.push(...missingColumns);
    }

    // 3. Constraints
    console.log('\n3. CONSTRAINTS');
    const constraints = await sql(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'payment_verifications'
      AND constraint_schema = 'public';
    `);

    const expectedConstraints = {
      'payment_verifications_pkey': 'PRIMARY KEY',
      'fk_user': 'FOREIGN KEY',
      'fk_admin': 'FOREIGN KEY',
      'valid_status': 'CHECK'
    };

    constraints.forEach(constraint => {
      const expected = expectedConstraints[constraint.constraint_name];
      if (expected) {
        console.log(`   ✅ ${constraint.constraint_name}: ${constraint.constraint_type}`);
      } else {
        console.log(`   ℹ️  ${constraint.constraint_name}: ${constraint.constraint_type}`);
      }
    });

    // 4. Foreign Key Details
    console.log('\n4. FOREIGN KEY DETAILS');
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

    const expectedFKs = {
      'fk_user': { column: 'user_id', ref_table: 'users', ref_col: 'id' },
      'fk_admin': { column: 'admin_id', ref_table: 'users', ref_col: 'id' }
    };

    foreignKeys.forEach(fk => {
      const expected = expectedFKs[fk.constraint_name];
      if (expected) {
        const matches = fk.column_name === expected.column &&
                       fk.foreign_table_name === expected.ref_table &&
                       fk.foreign_column_name === expected.ref_col;
        console.log(`   ${matches ? '✅' : '⚠️'} ${fk.constraint_name}:`);
        console.log(`      ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      } else {
        console.log(`   ℹ️  ${fk.constraint_name}: ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      }
    });

    // 5. Indexes
    console.log('\n5. INDEXES');
    const indexes = await sql(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      AND schemaname = 'public'
      ORDER BY indexname;
    `);

    const expectedIndexes = [
      'idx_payment_verifications_user_id',
      'idx_payment_verifications_plan_id',
      'idx_payment_verifications_status',
      'idx_payment_verifications_submitted_at',
      'idx_payment_verifications_reference_number',
      'idx_payment_verifications_admin_dashboard'
    ];

    indexes.forEach(idx => {
      if (expectedIndexes.includes(idx.indexname)) {
        console.log(`   ✅ ${idx.indexname}`);
      } else {
        console.log(`   ℹ️  ${idx.indexname}`);
      }
    });

    // Check for missing expected indexes
    const existingIndexes = indexes.map(i => i.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !existingIndexes.includes(idx));
    if (missingIndexes.length > 0) {
      console.log(`   ⚠️  Missing expected indexes: ${missingIndexes.join(', ')}`);
    }

    // 6. Database Functions Test
    console.log('\n6. DATABASE FUNCTIONS TEST');

    // Test basic query
    try {
      const count = await sql('SELECT COUNT(*) as count FROM payment_verifications');
      console.log(`   ✅ Basic COUNT query: ${count[0].count} records`);
    } catch (error) {
      console.log(`   ❌ COUNT query failed: ${error.message}`);
    }

    // Test filtered query
    try {
      const pendingCount = await sql("SELECT COUNT(*) as count FROM payment_verifications WHERE status = 'pending'");
      console.log(`   ✅ Status filter query: ${pendingCount[0].count} pending`);
    } catch (error) {
      console.log(`   ❌ Status filter failed: ${error.message}`);
    }

    // Test JOIN query (for plan details)
    try {
      const joinTest = await sql(`
        SELECT COUNT(*) as count
        FROM payment_verifications pv
        LEFT JOIN users u ON pv.user_id = u.id
      `);
      console.log(`   ✅ JOIN with users: ${joinTest[0].count} records`);
    } catch (error) {
      console.log(`   ❌ JOIN query failed: ${error.message}`);
    }

    // Test aggregation
    try {
      const stats = await sql(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected
        FROM payment_verifications
      `);
      console.log(`   ✅ Status aggregation:`, stats[0]);
    } catch (error) {
      console.log(`   ❌ Aggregation failed: ${error.message}`);
    }

    // 7. Final Assessment
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎯 MIGRATION VERIFICATION RESULT\n');

    if (columnIssues.length > 0) {
      console.log('❌ MIGRATION_HAS_ISSUES');
      console.log(`Column structure problems: ${columnIssues.join(', ')}`);
      return 'MIGRATION_HAS_ISSUES';
    } else if (missingIndexes.length > 0) {
      console.log('⚠️  DONE_WITH_CONCERNS');
      console.log(`Missing recommended indexes: ${missingIndexes.join(', ')}`);
      return 'DONE_WITH_CONCERNS';
    } else {
      console.log('✅ DONE');
      console.log('Migration verified and working correctly!');
      return 'DONE';
    }

  } catch (error) {
    console.log('\n❌ DATABASE_ERROR');
    console.log(`Error: ${error.message}`);
    return 'BLOCKED';
  }
}

// Run comprehensive test
comprehensiveTest().then(result => {
  console.log(`\n${result}`);
  process.exit(result === 'DONE' ? 0 : 1);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});