const { Client } = require('pg');
const crypto = require('crypto');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT email, email_hash FROM users WHERE email_hash IS NOT NULL LIMIT 5`);
  console.log('users with email_hash:', r.rowCount);
  let ok = 0;
  for (const u of r.rows) {
    const computed = crypto.createHash('sha256').update(u.email.toLowerCase().trim()).digest('hex');
    const match = computed === u.email_hash;
    if (match) ok++;
    console.log(`${u.email}: stored=${u.email_hash.slice(0, 16)}... sha256=${computed.slice(0, 16)}... match=${match}`);
  }
  console.log(`sha256 matches: ${ok}/${r.rowCount}`);
  const all = await c.query(`SELECT COUNT(*) as n FROM users`);
  const hashes = await c.query(`SELECT COUNT(*) as n FROM users WHERE email_hash IS NOT NULL`);
  const old = await c.query(`SELECT COUNT(*) as n FROM users WHERE email_hash IS NOT NULL AND length(email_hash) < 40`);
  console.log(`total users=${all.rows[0].n} with_hash=${hashes.rows[0].n} short/custom-format hashes=${old.rows[0].n}`);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
