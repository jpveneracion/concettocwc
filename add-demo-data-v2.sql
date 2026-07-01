-- Add Demo Data for Demo Account (Simplified Version)
-- Run this in Neon's SQL Editor after running check-demo-data.sql
-- This script uses actual product IDs from your database

-- Step 1: Get a product ID to use for all demo items
-- Run this query first and copy the UUID:
-- SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1;

-- Step 2: Replace 'YOUR_PRODUCT_ID_HERE' below with the actual UUID from Step 1
-- Then run the rest of this script

-- Insert sample quotes for DEMO company
-- All quotes will use the same product ID for simplicity

-- Quote 1: Approved - ABC Corporation
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'ABC Corporation',
  'approved',
  CURRENT_DATE - INTERVAL '15 days',
  4500.00,
  CURRENT_DATE - INTERVAL '15 days'
FROM demo_company c;

-- Quote 2: Approved - Smith Residence
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Smith Residence',
  'approved',
  CURRENT_DATE - INTERVAL '30 days',
  2800.00,
  CURRENT_DATE - INTERVAL '30 days'
FROM demo_company c;

-- Quote 3: Sent - Metro Hotel
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Metro Hotel',
  'sent',
  CURRENT_DATE - INTERVAL '5 days',
  6200.00,
  CURRENT_DATE - INTERVAL '5 days'
FROM demo_company c;

-- Quote 4: Approved - Dr. Johnson Clinic
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Dr. Johnson Clinic',
  'approved',
  CURRENT_DATE - INTERVAL '45 days',
  1850.00,
  CURRENT_DATE - INTERVAL '45 days'
FROM demo_company c;

-- Quote 5: Pending - Garcia Family
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Garcia Family',
  'pending',
  CURRENT_DATE - INTERVAL '2 days',
  3200.00,
  CURRENT_DATE - INTERVAL '2 days'
FROM demo_company c;

-- Quote 6: Approved - Luxury Apartments Inc (2 months ago)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Luxury Apartments Inc',
  'approved',
  CURRENT_DATE - INTERVAL '60 days',
  8900.00,
  CURRENT_DATE - INTERVAL '60 days'
FROM demo_company c;

-- Quote 7: Approved - City Center Mall (3 months ago)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'City Center Mall',
  'approved',
  CURRENT_DATE - INTERVAL '90 days',
  12500.00,
  CURRENT_DATE - INTERVAL '90 days'
FROM demo_company c;

-- Quote 8: Sent - Wilson Restaurant (4 months ago)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Wilson Restaurant',
  'sent',
  CURRENT_DATE - INTERVAL '120 days',
  2100.00,
  CURRENT_DATE - INTERVAL '120 days'
FROM demo_company c;

-- Quote 9: Approved - Brown & Associates (4 months ago)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Brown & Associates Law',
  'approved',
  CURRENT_DATE - INTERVAL '120 days',
  5400.00,
  CURRENT_DATE - INTERVAL '120 days'
FROM demo_company c;

-- Quote 10: Approved - Riverside Hotel (5 months ago)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Riverside Hotel',
  'approved',
  CURRENT_DATE - INTERVAL '150 days',
  7800.00,
  CURRENT_DATE - INTERVAL '150 days'
FROM demo_company c;

-- Quote 11: Cancelled - StartUp Tech Co
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'StartUp Tech Co',
  'cancelled',
  CURRENT_DATE - INTERVAL '20 days',
  1500.00,
  CURRENT_DATE - INTERVAL '20 days'
FROM demo_company c;

-- Quote 12: Approved - Patterson Residence (5 months ago)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Patterson Residence',
  'approved',
  CURRENT_DATE - INTERVAL '150 days',
  3400.00,
  CURRENT_DATE - INTERVAL '150 days'
FROM demo_company c;

-- Quote 13: Sent - Green Valley Resort
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Green Valley Resort',
  'sent',
  CURRENT_DATE - INTERVAL '10 days',
  15000.00,
  CURRENT_DATE - INTERVAL '10 days'
FROM demo_company c;

-- Quote 14: Pending - Oceanview Restaurant
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Oceanview Restaurant',
  'pending',
  CURRENT_DATE - INTERVAL '7 days',
  4200.00,
  CURRENT_DATE - INTERVAL '7 days'
FROM demo_company c;

-- Quote 15: Approved - Lee Dental Clinic (current month)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Lee Dental Clinic',
  'approved',
  CURRENT_DATE - INTERVAL '3 days',
  1650.00,
  CURRENT_DATE - INTERVAL '3 days'
FROM demo_company c;

-- Now add quote_items for each quote
-- These will use actual product IDs from the database

-- Add items for all approved/sent quotes (for profit calculations)
WITH demo_company AS (SELECT id FROM companies WHERE code = 'DEMO'),
     demo_product AS (SELECT id FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount, product_collection)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  150,  -- width
  150,  -- height
  5,    -- quantity
  q.total * 0.4,  -- supplier_amount (40% of total as cost)
  q.total * 0.9,  -- retail_amount (90% distributed across items)
  p.collection
FROM quotes q
CROSS JOIN demo_product p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.status IN ('approved', 'sent')
  AND q.id NOT IN (SELECT quote_id FROM quote_items)
LIMIT 20;

-- Demo data insertion complete!
-- You should now see dashboard metrics populated with sample data
