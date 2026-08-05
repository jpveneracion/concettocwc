const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '091_find_company_by_code.sql'), 'utf8');
  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('COMMIT');
    console.log('migration 091 applied OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('migration 091 FAILED:', e.message);
    process.exit(1);
  }
  const r = await c.query(`SELECT * FROM find_company_by_code('BERMUDEZEL')`);
  console.log('find_company_by_code BERMUDEZEL rows:', r.rowCount);
  for (const row of r.rows) console.log(row);
  const all = await c.query(`SELECT company_code, company_user_count FROM find_company_by_code('CONCETTO')`);
  console.log('find_company_by_code CONCETTO:', all.rows);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
