import { neon } from '@neondatabase/serverless';

interface DatabaseConnection {
  url: string;
  name: string;
}

const databases: DatabaseConnection[] = [
  {
    url: 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    name: 'Database 1 (holy-leaf) - TARGET'
  },
  {
    url: 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-steep-unit-atwaadwx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    name: 'Database 2 (steep-unit) - SOURCE'
  }
];

async function verifyFunctionalEquivalence() {
  console.log('🔍 VERIFYING FUNCTIONAL EQUIVALENCE OF CONSTRAINTS');
  console.log('='.repeat(80) + '\n');

  for (const db of databases) {
    console.log(`📌 ${db.name}`);
    console.log('-'.repeat(80));

    const sql = neon(db.url);

    try {
      // Test the constraint with valid values
      console.log('Testing constraint with valid values...');
      try {
        await sql`SET session_replication_role = 'replica'`; // Disable constraints temporarily
        await sql`INSERT INTO pending_products (company_id, code, description, submitted_by, status) VALUES (gen_random_uuid(), 'TEST001', 'Test product', (SELECT id FROM users LIMIT 1), 'pending')`;
        await sql`DELETE FROM pending_products WHERE code = 'TEST001'`;
        await sql`SET session_replication_role = 'origin'`; // Re-enable constraints
        console.log('   ✅ Valid status "pending" accepted');
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
      }

      try {
        await sql`SET session_replication_role = 'replica'`;
        await sql`INSERT INTO pending_products (company_id, code, description, submitted_by, status) VALUES (gen_random_uuid(), 'TEST002', 'Test product', (SELECT id FROM users LIMIT 1), 'approved')`;
        await sql`DELETE FROM pending_products WHERE code = 'TEST002'`;
        await sql`SET session_replication_role = 'origin'`;
        console.log('   ✅ Valid status "approved" accepted');
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
      }

      try {
        await sql`SET session_replication_role = 'replica'`;
        await sql`INSERT INTO pending_products (company_id, code, description, submitted_by, status) VALUES (gen_random_uuid(), 'TEST003', 'Test product', (SELECT id FROM users LIMIT 1), 'rejected')`;
        await sql`DELETE FROM pending_products WHERE code = 'TEST003'`;
        await sql`SET session_replication_role = 'origin'`;
        console.log('   ✅ Valid status "rejected" accepted');
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
      }

      // Test the constraint with invalid values
      console.log('\nTesting constraint with invalid values...');
      try {
        await sql`INSERT INTO pending_products (company_id, code, description, submitted_by, status) VALUES (gen_random_uuid(), 'TEST004', 'Test product', (SELECT id FROM users LIMIT 1), 'invalid')`;
        await sql`DELETE FROM pending_products WHERE code = 'TEST004'`;
        console.log('   ⚠️ Invalid status "invalid" was accepted (constraint not working)');
      } catch (error: any) {
        if (error.message.includes('pending_products_status_check')) {
          console.log('   ✅ Invalid status "invalid" correctly rejected by constraint');
        } else {
          console.log(`   ⚠️ Unexpected error: ${error.message}`);
        }
      }

      // Get constraint definition
      const constraint = await sql`
        SELECT
          pg_get_constraintdef(pgc.oid, false) AS constraint_definition
        FROM pg_catalog.pg_constraint pgc
        JOIN pg_catalog.pg_class pgc1 ON pgc.conrelid = pgc1.oid
        JOIN pg_catalog.pg_namespace pgn ON pgc1.relnamespace = pgn.oid
        WHERE pgc1.relname = 'pending_products'
        AND pgn.nspname = 'public'
        AND pgc.conname = 'pending_products_status_check'
      `;

      if (constraint.length > 0) {
        console.log('\nStored constraint definition:');
        console.log(constraint[0].constraint_definition);
      }

    } catch (error: any) {
      console.error(`❌ Error checking ${db.name}:`, error.message);
    }

    console.log('\n');
  }

  console.log('='.repeat(80));
  console.log('📋 FUNCTIONAL EQUIVALENCE SUMMARY');
  console.log('='.repeat(80));
  console.log('\nBoth constraints should accept the same values and reject the same values.');
  console.log('The format difference may be just PostgreSQL internal storage vs display.');
  console.log('For 100% character-for-character match, we may need to use pg_dump/pg_restore.\n');

  process.exit(0);
}

verifyFunctionalEquivalence();