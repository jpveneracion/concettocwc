const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN');
  await c.query(`SELECT set_tenant_context('1ebf8553-0391-45db-8ca0-3ec7b6de8e1d', 'superadmin')`);
  const before = await c.query(`SELECT code, current_usage, usage_limit FROM activation_codes WHERE code IN ('ADMIN99','ADMINDC')`);
  console.log('before:', before.rows);
  const upd = await c.query(`
    UPDATE activation_codes ac
    SET current_usage = (SELECT COUNT(*)::int FROM payments p WHERE p.promo_code = ac.code)
    WHERE EXISTS (SELECT 1 FROM payments p WHERE p.promo_code = ac.code)
  `);
  console.log('rows updated:', upd.rowCount);
  const after = await c.query(`SELECT code, current_usage, usage_limit FROM activation_codes WHERE code IN ('ADMIN99','ADMINDC')`);
  console.log('after:', after.rows);
  const all = await c.query(`SELECT code, current_usage, usage_limit FROM activation_codes ORDER BY id`);
  console.log('all codes now:', JSON.stringify(all.rows));
  await c.query('COMMIT');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
