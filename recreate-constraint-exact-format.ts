import { neon } from '@neondatabase/serverless';

// Using owner-level credentials for Database 1
const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function recreateConstraintExactFormat() {
  try {
    console.log('🔄 Recreating CHECK constraint with exact Database 2 format...');
    console.log('Using OWNER credentials for ep-holy-leaf-at8ruz1r\n');

    // Drop the existing constraint
    console.log('1. Dropping existing constraint...');
    try {
      await sql`
        ALTER TABLE pending_products
        DROP CONSTRAINT IF EXISTS pending_products_status_check
      `;
      console.log('   ✅ Successfully dropped existing constraint\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to drop constraint: ${error.message}`);
      process.exit(1);
    }

    // Recreate using the exact format from Database 2 (with quotes version)
    console.log('2. Recreating constraint with exact Database 2 format...');
    try {
      // Using the exact format from Database 2
      await sql`
        ALTER TABLE pending_products
        ADD CONSTRAINT pending_products_status_check
        CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[]))
      `;
      console.log('   ✅ Successfully recreated constraint\n');
    } catch (error: any) {
      console.log(`   ❌ Failed to create constraint: ${error.message}`);
      process.exit(1);
    }

    // Verify the new constraint format
    console.log('3. Verifying new constraint format...\n');

    const newConstraint = await sql`
      SELECT
        pg_get_constraintdef(pgc.oid, false) AS constraint_definition
      FROM pg_catalog.pg_constraint pgc
      JOIN pg_catalog.pg_class pgc1 ON pgc.conrelid = pgc1.oid
      JOIN pg_catalog.pg_namespace pgn ON pgc1.relnamespace = pgn.oid
      WHERE pgc1.relname = 'pending_products'
      AND pgn.nspname = 'public'
      AND pgc.conname = 'pending_products_status_check'
    `;

    if (newConstraint.length > 0) {
      const newFormat = newConstraint[0].constraint_definition;
      const targetFormat = "CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))";

      console.log('New format (Database 1):');
      console.log(newFormat);
      console.log('');

      console.log('Target format (Database 2):');
      console.log(targetFormat);
      console.log('');

      // Check if it matches the target format
      if (newFormat === targetFormat) {
        console.log('✅ SUCCESS: Constraint format matches target EXACTLY!');
      } else {
        console.log('⚠️ Constraint format comparison:');
        console.log('Match result:', newFormat === targetFormat ? 'YES' : 'NO');

        // Show character-by-character comparison
        const maxLen = Math.max(newFormat.length, targetFormat.length);
        console.log('\nCharacter comparison:');
        for (let i = 0; i < maxLen; i++) {
          const char1 = newFormat[i] || 'EOF';
          const char2 = targetFormat[i] || 'EOF';
          const match = char1 === char2 ? '✓' : '✗';

          if (char1 !== char2) {
            console.log(`Position ${i}: DB1='${char1}' DB2='${char2}' ${match}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 CHECK CONSTRAINT FORMAT FIX COMPLETED');
    console.log('='.repeat(80));
    console.log('\nThe pending_products_status_check constraint has been recreated.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Constraint fix failed:', error);
    process.exit(1);
  }
}

recreateConstraintExactFormat();