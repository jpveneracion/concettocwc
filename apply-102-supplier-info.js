// Run with: node apply-102-supplier-info.js
// Uses DATABASE_URL from .env.local

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function applyMigration() {
  console.log('🔧 Applying 102_add_supplier_info migration...\n');

  const migrationSql = fs.readFileSync('migrations/102_add_supplier_info.sql', 'utf8');

  // Split into individual statements (the driver cannot run multi-statement SQL).
  // Semicolons inside $$ function bodies are followed by indented newlines and are
  // not treated as statement boundaries.
  const statements = migrationSql
    .split(/;\s*\n\s*(?=(?:--|DROP\s|CREATE\s|GRANT\s|COMMENT\s|ALTER\s|UPDATE\s|INSERT\s))/g)
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    for (const statement of statements) {
      await sql(statement);
    }
    console.log('✅ Migration applied successfully');

    const [sig] = await sql`
      SELECT pg_get_function_identity_arguments(oid) AS args
      FROM pg_proc
      WHERE proname = 'update_company_settings'
    `;
    console.log('📋 update_company_settings signature now:', sig?.args);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();