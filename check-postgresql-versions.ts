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

async function checkPostgreSQLVersions() {
  console.log('🔍 CHECKING POSTGRESQL VERSIONS');
  console.log('='.repeat(80) + '\n');

  for (const db of databases) {
    console.log(`📌 ${db.name}`);
    console.log('-'.repeat(80));

    const sql = neon(db.url);

    try {
      const version = await sql`SELECT version()`;
      console.log(`PostgreSQL Version: ${version[0].version}`);

    } catch (error: any) {
      console.error(`❌ Error checking ${db.name}:`, error.message);
    }

    console.log('');
  }

  console.log('='.repeat(80));
  process.exit(0);
}

checkPostgreSQLVersions();