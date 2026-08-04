require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
      rejectUnauthorized: false,
    },
  });

  try {
    const migration = fs.readFileSync('migrations/045_create_security_definer_functions.sql', 'utf8');

    // Split by semicolon but ignore comments
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await pool.query(stmt);
          console.log('✅ Success:', stmt.substring(0, 60) + '...');
        } catch (error) {
          console.error('❌ Failed:', error.message);
          console.error('Statement was:', stmt.substring(0, 200));
        }
      }
    }

    console.log('✅ Migration applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();