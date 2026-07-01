-- Create Demo Account
-- Run this in Neon's SQL Editor
-- This creates a new company and user for demo/testing purposes

-- Demo Company Details
-- Name: Demo Blinds Inc.
-- Code: DEMO
-- Email: demo@example.com
-- Password: demo123

-- Step 1: Create the demo company
INSERT INTO companies (code, name, address, mobile, email, prepared_by, terms, del_note, closing_note)
VALUES (
  'DEMO',
  'Demo Blinds Inc.',
  '123 Demo Street, Test City, TC 12345',
  '+1-555-0123',
  'demo@example.com',
  'Demo User',
  'Net 30 days. 50% deposit required for new customers.',
  'Please inspect all items upon delivery. Report damages within 48 hours.',
  'Thank you for your business!'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  mobile = EXCLUDED.mobile,
  email = EXCLUDED.email,
  updated_at = now();

-- Step 2: Create the demo user
-- Password: demo123 (bcrypt hashed with 10 rounds)
INSERT INTO users (company_id, email, password_hash)
SELECT
  id,
  'demo@example.com',
  crypt('demo123', gen_salt('bf', 10))
FROM companies
WHERE code = 'DEMO'
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash;

-- Step 3: Create some sample collections pricing for the demo
INSERT INTO company_collections (company_id, collection, supplier_cost, retail_price)
SELECT
  id,
  collection,
  5.00,  -- supplier_cost
  15.00  -- retail_price
FROM companies, (SELECT DISTINCT collection FROM products WHERE collection IS NOT NULL LIMIT 5) AS collections
WHERE code = 'DEMO'
ON CONFLICT (company_id, collection) DO NOTHING;

-- Done! You can now login with:
-- Email: demo@example.com
-- Password: demo123
