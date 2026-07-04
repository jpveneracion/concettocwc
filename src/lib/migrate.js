// Run with: node src/lib/migrate.js
// Make sure DATABASE_URL is set in your .env.local

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running migrations...');

  // Enable UUID extension
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  // Settings table (single row, keyed by a constant UUID)
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company TEXT NOT NULL DEFAULT 'CONCETTO',
      address TEXT NOT NULL DEFAULT '107 Cruz na Daan, San Rafael, Bulacan 3008',
      mobile TEXT NOT NULL DEFAULT '0935-880 1914 / 0928-638 5433',
      email TEXT NOT NULL DEFAULT 'concettowindowcoverings@gmail.com',
      prepared_by TEXT NOT NULL DEFAULT 'John Paul Veneracion',
      terms TEXT NOT NULL DEFAULT '50% deposit required to start production/service. Balance 50% on delivery or pick-up/installation. VAT not included',
      del_note TEXT NOT NULL DEFAULT '5-10 Working Days (includes Saturdays) upon order.',
      closing_note TEXT NOT NULL DEFAULT 'We hope that this quotation would merit your kind approval and if so, please affix your signature to the conformed portion below.',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Seed default settings row if empty
  await sql`
    INSERT INTO settings (company)
    SELECT 'CONCETTO'
    WHERE NOT EXISTS (SELECT 1 FROM settings)
  `;

  // Products table
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      collection TEXT,
      description TEXT NOT NULL,
      supplier_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'sqft' CHECK (unit IN ('sqft', 'sqm')),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS products_code_idx ON products (UPPER(code))`;

  // Quotes table
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_address TEXT,
      quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
      our_ref TEXT,
      installation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_area NUMERIC(10,4) NOT NULL DEFAULT 0,
      panel_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Quote items table — each window in a quote
  await sql`
    CREATE TABLE IF NOT EXISTS quote_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      product_id UUID REFERENCES products(id) ON DELETE SET NULL,
      product_code TEXT,
      product_collection TEXT,
      product_description TEXT,
      unit TEXT NOT NULL DEFAULT 'in' CHECK (unit IN ('in', 'cm')),
      is_fixed BOOLEAN NOT NULL DEFAULT true,
      measured_width NUMERIC(10,2) NOT NULL DEFAULT 0,
      measured_drop NUMERIC(10,2) NOT NULL DEFAULT 0,
      final_width NUMERIC(10,2) NOT NULL DEFAULT 0,
      final_drop NUMERIC(10,2) NOT NULL DEFAULT 0,
      area_sqft NUMERIC(10,4) NOT NULL DEFAULT 0,
      retail_price_sqft NUMERIC(10,2) NOT NULL DEFAULT 0,
      supplier_cost_sqft NUMERIC(10,2) NOT NULL DEFAULT 0,
      retail_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      supplier_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON quote_items (quote_id)`;

  // Drop NOT NULL constraint from customer_name (for encryption workflow)
  await sql`ALTER TABLE quotes ALTER COLUMN customer_name DROP NOT NULL`;

  console.log('✅ Migrations complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
