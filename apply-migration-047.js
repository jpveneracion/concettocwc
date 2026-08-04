const { sql } = require('./src/lib/db');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    console.log('🚀 Applying migration 047: Create comprehensive SECURITY DEFINER functions...');

    const migrationPath = path.join(__dirname, 'migrations', '047_create_comprehensive_security_definer_functions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded, executing...');

    await sql.query(migrationSQL);

    console.log('✅ Migration 047 applied successfully!');
    console.log('🎉 All SECURITY DEFINER functions have been created/updated.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration().then(() => process.exit(0));