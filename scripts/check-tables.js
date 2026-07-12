// Check existing tables
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
  console.log('🔍 Checking existing database tables...');

  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('Existing tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    // Check for users table specifically
    const usersTable = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;

    if (usersTable.length > 0) {
      console.log('\n✅ Users table exists with columns:');
      usersTable.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('\n❌ Users table does not exist');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  }
}

checkTables();