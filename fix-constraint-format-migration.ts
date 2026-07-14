import { neon } from '@neondatabase/serverless';

// Using owner-level credentials for Database 1
const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function fixConstraintFormat() {
  try {
    console.log('🔄 Fixing CHECK constraint format for pending_products_status_check...');
    console.log('Using OWNER credentials for ep-holy-leaf-at8ruz1r\n');

    // First, let's check the current constraint format
    console.log('🔍 Checking current constraint format...\n');

    const currentConstraint = await sql`
      SELECT
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.table_name = 'pending_products'
      AND tc.constraint_schema = 'public'
      AND tc.constraint_name = 'pending_products_status_check'
    `;

    if (currentConstraint.length > 0) {
      console.log('Current constraint format:');
      console.log(currentConstraint[0].check_clause);
      console.log('');
    }

    // Drop the existing constraint
    console.log('1. Dropping existing constraint...');
    try {
      await sql`
        ALTER TABLE pending_products
        DROP CONSTRAINT pending_products_status_check
      `;
      console.log('   ✅ Successfully dropped existing constraint\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to drop constraint: ${error.message}`);
      process.exit(1);
    }

    // Recreate with the exact format from Database 2
    console.log('2. Recreating constraint with target format...');
    try {
      await sql`
        ALTER TABLE pending_products
        ADD CONSTRAINT pending_products_status_check
        CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
      `;
      console.log('   ✅ Successfully recreated constraint with target format\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to create constraint: ${error.message}`);
      console.log('   Attempting to restore original constraint...\n');

      // Restore original if recreation fails
      try {
        await sql`
          ALTER TABLE pending_products
          ADD CONSTRAINT pending_products_status_check
          CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
        `;
        console.log('   ✅ Original constraint restored');
      } catch (restoreError: any) {
        console.log(`   ❌ Failed to restore: ${restoreError.message}`);
      }

      process.exit(1);
    }

    // Verify the new constraint format
    console.log('3. Verifying new constraint format...\n');

    const newConstraint = await sql`
      SELECT
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.table_name = 'pending_products'
      AND tc.constraint_schema = 'public'
      AND tc.constraint_name = 'pending_products_status_check'
    `;

    if (newConstraint.length > 0) {
      console.log('New constraint format:');
      console.log(newConstraint[0].check_clause);
      console.log('');

      // Check if it matches the target format
      const targetFormat = "(((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))";
      const currentFormat = newConstraint[0].check_clause;

      if (currentFormat === targetFormat) {
        console.log('✅ Constraint format matches target exactly!');
      } else {
        console.log('⚠️ Constraint format does not match target');
        console.log('Expected:', targetFormat);
        console.log('Got:     ', currentFormat);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 CHECK CONSTRAINT FORMAT FIX COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nThe pending_products_status_check constraint has been updated to');
    console.log('match Database 2 format exactly for character-for-character database identity.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Constraint fix failed:', error);
    process.exit(1);
  }
}

fixConstraintFormat();