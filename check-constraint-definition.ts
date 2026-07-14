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

async function checkConstraintDefinition() {
  console.log('🔍 CHECKING CONSTRAINT DEFINITION FROM pg_get_constraintdef');
  console.log('='.repeat(80) + '\n');

  for (const db of databases) {
    console.log(`📌 ${db.name}`);
    console.log('-'.repeat(80));

    const sql = neon(db.url);

    try {
      const constraint = await sql`
        SELECT
          pgc.conname AS constraint_name,
          pg_get_constraintdef(pgc.oid) AS constraint_definition
        FROM pg_catalog.pg_constraint pgc
        JOIN pg_catalog.pg_class pgc1 ON pgc.conrelid = pgc1.oid
        JOIN pg_catalog.pg_namespace pgn ON pgc1.relnamespace = pgn.oid
        WHERE pgc1.relname = 'pending_products'
        AND pgn.nspname = 'public'
        AND pgc.conname = 'pending_products_status_check'
      `;

      if (constraint.length > 0) {
        console.log(`\n${db.name} constraint definition:`);
        console.log(constraint[0].constraint_definition);
      } else {
        console.log('No constraint found');
      }

    } catch (error: any) {
      console.error(`❌ Error checking ${db.name}:`, error.message);
    }

    console.log('\n');
  }

  console.log('='.repeat(80));
  process.exit(0);
}

checkConstraintDefinition();