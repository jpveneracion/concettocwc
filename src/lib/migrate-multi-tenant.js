// Run with: node src/lib/migrate-multi-tenant.js
// Make sure DATABASE_URL is set in your .env.local

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running multi-tenant migration...');

  // Enable UUID extension
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  // 1. Create companies table
  console.log('Creating companies table...');
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      mobile TEXT,
      email TEXT,
      prepared_by TEXT,
      terms TEXT,
      del_note TEXT,
      closing_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS companies_code_idx ON companies (UPPER(code))`;

  // 2. Create users table (one per company)
  console.log('Creating users table...');
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS users_company_idx ON users (company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (UPPER(email))`;

  // 3. Create company_products table (company-specific pricing)
  console.log('Creating company_products table...');
  await sql`
    CREATE TABLE IF NOT EXISTS company_products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      UNIQUE(company_id, product_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS company_products_company_idx ON company_products (company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS company_products_product_idx ON company_products (product_id)`;

  // 4. Migrate existing settings to first company (Concetto Window Coverings)
  console.log('Migrating settings to companies table...');
  const [existingSettings] = await sql`SELECT * FROM settings LIMIT 1`;

  if (existingSettings) {
    const [cwcCompany] = await sql`
      INSERT INTO companies (code, name, address, mobile, email, prepared_by, terms, del_note, closing_note)
      VALUES (
        'CWC',
        'CONCETTO WINDOW COVERINGS',
        ${existingSettings.address},
        ${existingSettings.mobile},
        ${existingSettings.email},
        ${existingSettings.prepared_by},
        ${existingSettings.terms},
        ${existingSettings.del_note},
        ${existingSettings.closing_note}
      )
      RETURNING id, code
    `;
    console.log(`Created CWC company: ${cwcCompany.code}`);

    // 5. Create default user for CWC
    console.log('Creating default user for CWC...');
    const defaultEmail = 'admin@concettowc.com';
    const defaultPassword = 'admin123'; // User should change this after login
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await sql`
      INSERT INTO users (company_id, email, password_hash)
      VALUES (${cwcCompany.id}, ${defaultEmail}, ${passwordHash})
    `;
    console.log(`Created default user: ${defaultEmail} / ${defaultPassword}`);

    // 6. Migrate existing products pricing to company_products
    console.log('Migrating product pricing to company_products...');
    const products = await sql`SELECT id, supplier_cost, retail_price FROM products`;

    for (const product of products) {
      await sql`
        INSERT INTO company_products (company_id, product_id, supplier_cost, retail_price)
        VALUES (${cwcCompany.id}, ${product.id}, ${product.supplier_cost}, ${product.retail_price})
      `;
    }
    console.log(`Migrated ${products.length} products to company_products`);

    // 7. Add company_id column to quotes
    console.log('Adding company_id to quotes...');
    await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id)`;

    // 8. Backfill company_id for existing quotes
    console.log('Backfilling company_id for existing quotes...');
    await sql`UPDATE quotes SET company_id = ${cwcCompany.id} WHERE company_id IS NULL`;
    console.log('Updated existing quotes to CWC company');

    // 9. Remove pricing from products table (now in company_products)
    console.log('Removing pricing columns from products...');
    await sql`ALTER TABLE products DROP COLUMN IF EXISTS supplier_cost`;
    await sql`ALTER TABLE products DROP COLUMN IF EXISTS retail_price`;

    // 10. Drop old settings table
    console.log('Dropping old settings table...');
    await sql`DROP TABLE IF EXISTS settings CASCADE`;

    console.log('\n✅ Multi-tenant migration complete!');
    console.log('\n📝 IMPORTANT:');
    console.log(`   Default login: ${defaultEmail}`);
    console.log(`   Default password: ${defaultPassword}`);
    console.log('   Please change this password after first login!\n');
  } else {
    console.log('⚠️  No existing settings found. Creating fresh schema...');

    // Create a default company if no settings exist
    const [defaultCompany] = await sql`
      INSERT INTO companies (code, name, address, mobile, email)
      VALUES (
        'DEMO',
        'Demo Company',
        '123 Main St',
        '555-1234',
        'demo@example.com'
      )
      RETURNING id, code
    `;

    const defaultEmail = 'admin@example.com';
    const defaultPassword = 'admin123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await sql`
      INSERT INTO users (company_id, email, password_hash)
      VALUES (${defaultCompany.id}, ${defaultEmail}, ${passwordHash})
    `;

    console.log('\n✅ Fresh schema created!');
    console.log('\n📝 Default login:');
    console.log(`   Email: ${defaultEmail}`);
    console.log(`   Password: ${defaultPassword}\n`);
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
