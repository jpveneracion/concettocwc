-- Migration: Change pricing from per-product to per-collection
-- Run this in Neon's SQL Editor AFTER the initial migration

-- 1. Create new company_collections table (pricing by collection)
CREATE TABLE IF NOT EXISTS company_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  supplier_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(company_id, collection)
);

CREATE INDEX IF NOT EXISTS company_collections_company_idx ON company_collections (company_id);
CREATE INDEX IF NOT EXISTS company_collections_collection_idx ON company_collections(collection);

-- 2. Migrate existing pricing to collection-based
-- Group by collection and use the first pricing found for each collection
INSERT INTO company_collections (company_id, collection, supplier_cost, retail_price)
SELECT DISTINCT
  cp.company_id,
  p.collection,
  FIRST_VALUE(cp.supplier_cost) OVER (PARTITION BY cp.company_id, p.collection ORDER BY p.id),
  FIRST_VALUE(cp.retail_price) OVER (PARTITION BY cp.company_id, p.collection ORDER BY p.id)
FROM company_products cp
JOIN products p ON p.id = cp.product_id
WHERE p.collection IS NOT NULL AND p.collection != ''
ON CONFLICT (company_id, collection) DO NOTHING;

-- 3. Update product lookup to use collection pricing
-- The API will be updated separately to use this new table

-- 4. Drop old company_products table (after confirming migration worked)
-- Uncomment this line AFTER you verify pricing is working correctly:
-- DROP TABLE IF EXISTS company_products CASCADE;

-- Migration complete!
--
-- Note: Products without a collection will need pricing set individually
-- You can either:
-- 1. Set a collection for all products, OR
-- 2. Keep company_products for products without collections
