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

async function checkActualConstraintFormat() {
  console.log('🔍 CHECKING ACTUAL CONSTRAINT FORMATS');
  console.log('='.repeat(80) + '\n');

  for (const db of databases) {
    console.log(`📌 ${db.name}`);
    console.log('-'.repeat(80));

    const sql = neon(db.url);

    try {
      const constraint = await sql`
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

      if (constraint.length > 0) {
        console.log(`\n${db.name} format:`);
        console.log(constraint[0].check_clause);
      } else {
        console.log('No constraint found');
      }

    } catch (error: any) {
      console.error(`❌ Error checking ${db.name}:`, error.message);
    }

    console.log('');
  }

  console.log('='.repeat(80));
  process.exit(0);
}

checkActualConstraintFormat();