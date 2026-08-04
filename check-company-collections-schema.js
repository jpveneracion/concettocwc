const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

// Read from .env.local
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  console.log('=== ACTUAL NEON company_collections TABLE SCHEMA ===');

  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'company_collections'
    ORDER BY ordinal_position
  `;

  if (columns.length === 0) {
    console.log('No columns found or table does not exist');
  } else {
    columns.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}`);
    });
  }

  console.log('\n=== TOTAL COLUMNS: ' + columns.length + ' ===');
}

checkSchema().catch(console.error);