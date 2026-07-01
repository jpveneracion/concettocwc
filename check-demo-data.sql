-- Diagnostic SQL: Check existing data for demo account setup
-- Run this first to see what data exists, then use the results to generate proper demo data

-- 1. Check if DEMO company exists
SELECT
  id,
  code,
  name,
  email
FROM companies
WHERE code = 'DEMO';

-- 2. Check all products and their collections
SELECT
  id,
  code,
  collection
FROM products
WHERE collection IS NOT NULL
ORDER BY collection, code
LIMIT 20;

-- 3. Count products by collection
SELECT
  collection,
  COUNT(*) as product_count
FROM products
WHERE collection IS NOT NULL
GROUP BY collection
ORDER BY product_count DESC;

-- 4. Check if demo company has collection pricing
SELECT
  cc.collection,
  cp.supplier_cost,
  cp.retail_price
FROM company_collections cc
LEFT JOIN company_products cp ON cp.company_id = cc.company_id AND cp.product_id IN (
  SELECT id FROM products WHERE collection = cc.collection LIMIT 1
)
WHERE cc.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
ORDER BY cc.collection;

-- 5. Get sample product IDs for Picasso collection (or whatever exists)
SELECT
  id,
  code,
  collection
FROM products
WHERE collection IS NOT NULL
ORDER BY collection, code
LIMIT 10;

-- 6. Check existing quotes for DEMO company (if any)
SELECT
  id,
  customer_name,
  status,
  quote_date,
  total
FROM quotes
WHERE company_id = (SELECT id FROM companies WHERE code = 'DEMO')
ORDER BY quote_date DESC;

-- After running this, use the results to:
-- 1. Verify DEMO company exists (run create-demo-account.sql if not)
-- 2. Get actual product IDs from query #5
-- 3. Use those product IDs when inserting quote_items
-- 4. Make sure collection names match exactly (case-sensitive)
