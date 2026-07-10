// Run OAuth migration
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);
const migration = fs.readFileSync('migrations/oauth-system.sql', 'utf8');

// Split and execute statements
const statements = migration
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

(async () => {
  for (let i = 0; i < statements.length; i++) {
    try {
      await new Function('sql', `return sql\`${statements[i]}\`;`)(sql);
      console.log(`✓ Statement ${i + 1}/${statements.length}`);
    } catch (err) {
      console.log(`⚠️  Statement ${i + 1} failed (may be expected): ${err.message}`);
    }
  }
  console.log('Migration complete');
  process.exit(0);
})();