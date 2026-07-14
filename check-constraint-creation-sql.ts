import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-steep-unit-atwaadwx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function checkConstraintCreationSQL() {
  try {
    console.log('🔍 Checking exact constraint creation SQL from Database 2...\n');

    // Get the exact constraint definition and see how it was created
    const constraint = await sql`
      SELECT
        pgc.conname AS constraint_name,
        pg_get_constraintdef(pgc.oid, true) AS constraint_definition_with_quotes,
        pg_get_constraintdef(pgc.oid, false) AS constraint_definition_without_quotes
      FROM pg_catalog.pg_constraint pgc
      JOIN pg_catalog.pg_class pgc1 ON pgc.conrelid = pgc1.oid
      JOIN pg_catalog.pg_namespace pgn ON pgc1.relnamespace = pgn.oid
      WHERE pgc1.relname = 'pending_products'
      AND pgn.nspname = 'public'
      AND pgc.conname = 'pending_products_status_check'
    `;

    if (constraint.length > 0) {
      console.log('Database 2 constraint details:');
      console.log('Name:', constraint[0].constraint_name);
      console.log('With quotes:', constraint[0].constraint_definition_with_quotes);
      console.log('Without quotes:', constraint[0].constraint_definition_without_quotes);
    } else {
      console.log('No constraint found');
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkConstraintCreationSQL();