require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const def = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'get_company_settings' AND n.nspname = 'public'`
  );
  console.log('DEF:', def.rows[0] && def.rows[0].def);
  await client.query(`BEGIN`);
  await client.query(`SELECT set_tenant_context($1, 'superadmin')`, ['1ebf8553-0391-45db-8ca0-3ec7b6de8e1d']);
  const c = await client.query(`SELECT id, code, name, address, mobile, email, minimum_area_sqft FROM companies`);
  for (const row of c.rows) console.log('COMPANY:', JSON.stringify(row));
  await client.query(`COMMIT`);
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
