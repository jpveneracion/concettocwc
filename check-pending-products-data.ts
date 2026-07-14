import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_9MPgHINXv3jh@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function checkPendingProductsData() {
  try {
    console.log('🔍 Checking pending_products table data...\n');

    const count = await sql`SELECT COUNT(*) as count FROM pending_products`;
    console.log(`Total records: ${count[0].count}`);

    if (parseInt(count[0].count) > 0) {
      console.log('\n⚠️ WARNING: Table contains data!');
      console.log('Table recreation will backup and restore this data.');
    } else {
      console.log('\n✅ Table is empty - safe to recreate');
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkPendingProductsData();