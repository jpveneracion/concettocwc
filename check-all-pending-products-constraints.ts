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

async function checkAllPendingProductsConstraints() {
  console.log('🔍 CHECKING ALL pending_products CONSTRAINTS');
  console.log('='.repeat(80) + '\n');

  for (const db of databases) {
    console.log(`📌 ${db.name}`);
    console.log('-'.repeat(80));

    const sql = neon(db.url);

    try {
      // Get all constraints
      const allConstraints = await sql`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          cc.check_clause
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.check_constraints cc
          ON tc.constraint_name = cc.constraint_name
          AND tc.constraint_schema = cc.constraint_schema
        WHERE tc.table_name = 'pending_products'
        AND tc.table_schema = 'public'
        ORDER BY tc.constraint_type, tc.constraint_name
      `;

      console.log(`\nTotal constraints: ${allConstraints.length}\n`);

      // Group by constraint type
      const checkConstraints = allConstraints.filter(c => c.constraint_type === 'CHECK');
      const fkConstraints = allConstraints.filter(c => c.constraint_type === 'FOREIGN KEY');
      const pkConstraints = allConstraints.filter(c => c.constraint_type === 'PRIMARY KEY');

      if (checkConstraints.length > 0) {
        console.log('CHECK Constraints:');
        checkConstraints.forEach((c: any) => {
          console.log(`  - ${c.constraint_name}`);
          if (c.check_clause) {
            console.log(`    ${c.check_clause}`);
          }
        });
      }

      if (fkConstraints.length > 0) {
        console.log('\nFOREIGN KEY Constraints:');
        fkConstraints.forEach((c: any) => {
          console.log(`  - ${c.constraint_name} on ${c.column_name}`);
        });
      }

      if (pkConstraints.length > 0) {
        console.log('\nPRIMARY KEY Constraints:');
        pkConstraints.forEach((c: any) => {
          console.log(`  - ${c.constraint_name} on ${c.column_name}`);
        });
      }

    } catch (error: any) {
      console.error(`❌ Error checking ${db.name}:`, error.message);
    }

    console.log('\n');
  }

  console.log('='.repeat(80));
  process.exit(0);
}

checkAllPendingProductsConstraints();