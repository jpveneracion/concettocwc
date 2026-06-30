const fs = require('fs');
const { neon } = require('@neondatabase/serverless');
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1];
const sql = neon(process.env.DATABASE_URL);
(async () => {
  try {
    const result = await sql('SELECT 1 AS ok');
    console.log('OK', result);
  } catch (err) {
    console.error('ERROR TYPE', err && err.constructor ? err.constructor.name : typeof err);
    console.error(err);
    process.exit(1);
  }
})();
