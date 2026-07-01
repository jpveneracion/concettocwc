-- Multi-Tenant Migration for Concetto Window Blinds
-- Run this in Neon's SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create companies table
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
);

CREATE INDEX IF NOT EXISTS companies_code_idx ON companies (UPPER(code));

-- 2. Create users table (one per company)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_company_idx ON users (company_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (UPPER(email));

-- 3. Create company_products table (company-specific pricing)
CREATE TABLE IF NOT EXISTS company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(company_id, product_id)
);

CREATE INDEX IF NOT EXISTS company_products_company_idx ON company_products (company_id);
CREATE INDEX IF NOT EXISTS company_products_product_idx ON company_products (product_id);

-- 4. Migrate existing settings to first company (Concetto Window Coverings)
-- This creates CWC company from your existing settings row
INSERT INTO companies (code, name, address, mobile, email, prepared_by, terms, del_note, closing_note)
SELECT
  'CWC',
  'CONCETTO WINDOW COVERINGS',
  address,
  mobile,
  email,
  prepared_by,
  terms,
  del_note,
  closing_note
FROM settings
LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- 5. Create default user for CWC
-- Password: admin123 (you should change this after first login)
-- This uses pgcrypto to generate bcrypt hash
INSERT INTO users (company_id, email, password_hash)
SELECT
  id,
  'admin@concettowc.com',
  crypt('admin123', gen_salt('bf', 10))
FROM companies
WHERE code = 'CWC'
ON CONFLICT (email) DO NOTHING;

-- 6. Migrate existing products pricing to company_products
INSERT INTO company_products (company_id, product_id, supplier_cost, retail_price)
SELECT
  (SELECT id FROM companies WHERE code = 'CWC'),
  id,
  supplier_cost,
  retail_price
FROM products
ON CONFLICT (company_id, product_id) DO NOTHING;

-- 7. Add company_id column to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 8. Backfill company_id for existing quotes
UPDATE quotes
SET company_id = (SELECT id FROM companies WHERE code = 'CWC')
WHERE company_id IS NULL;

-- 9. Remove pricing from products table (now in company_products)
ALTER TABLE products DROP COLUMN IF EXISTS supplier_cost;
ALTER TABLE products DROP COLUMN IF EXISTS retail_price;

-- 10. Drop old settings table (data migrated to companies)
DROP TABLE IF EXISTS settings CASCADE;

-- Migration complete!
--
-- IMPORTANT: Your default login credentials are:
--   Email: admin@concettowc.com
--   Password: admin123
--
-- Please change this password after first login!
