-- Migration: Achieve Complete Database Parity
-- Description: Update Database 1 (holy-leaf) comments to match Database 2 (steep-unit)
-- Requirements: This migration must be run by a database admin or owner with COMMENT privileges
-- Target: Database 1 (ep-holy-leaf-at8ruz1r)

-- ===================================
-- quote_items Table Comments
-- ===================================

-- Update quote_items.product_source comment
COMMENT ON COLUMN quote_items.product_source
IS 'Source of product: approved (from products table) or pending (from pending_products)';

-- Update quote_items.pending_product_id comment
COMMENT ON COLUMN quote_items.pending_product_id
IS 'Reference to pending product if product_source=pending';

-- ===================================
-- pending_products Table Comments
-- ===================================

-- Update pending_products table comment
COMMENT ON TABLE pending_products
IS 'Merchant-submitted products awaiting admin approval';

-- Update pending_products column comments to match Database 2
COMMENT ON COLUMN pending_products.code IS 'Product code (globally unique)';
COMMENT ON COLUMN pending_products.status IS 'pending, approved, or rejected';
COMMENT ON COLUMN pending_products.submitted_by IS 'User who submitted the product';
COMMENT ON COLUMN pending_products.reviewed_by IS 'Admin who reviewed the product';

-- Remove the extra column comments that exist in Database 1 but not in Database 2
COMMENT ON COLUMN pending_products.id IS NULL;
COMMENT ON COLUMN pending_products.company_id IS NULL;
COMMENT ON COLUMN pending_products.collection IS NULL;
COMMENT ON COLUMN pending_products.description IS NULL;
COMMENT ON COLUMN pending_products.unit IS NULL;
COMMENT ON COLUMN pending_products.review_notes IS NULL;
COMMENT ON COLUMN pending_products.created_at IS NULL;
COMMENT ON COLUMN pending_products.updated_at IS NULL;
COMMENT ON COLUMN pending_products.reviewed_at IS NULL;

-- ===================================
-- Verification Queries
-- ===================================

-- Run these queries after migration to verify success:

-- Check quote_items comments
-- SELECT column_name, pgd.description
-- FROM pg_catalog.pg_statio_all_tables AS st
-- INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
-- INNER JOIN information_schema.columns col ON (
--   pgd.objsubid = col.ordinal_position AND
--   col.table_schema = st.schemaname AND
--   col.table_name = st.relname AND
--   col.table_schema = 'public'
-- )
-- WHERE st.relname = 'quote_items'
-- ORDER BY col.ordinal_position;

-- Check pending_products table comment
-- SELECT pg_catalog.obj_description(pgc.oid, 'pg_class') as description
-- FROM pg_catalog.pg_class pgc
-- JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
-- WHERE pgc.relname = 'pending_products'
-- AND pgn.nspname = 'public';

-- Check pending_products column comments
-- SELECT column_name, pgd.description
-- FROM pg_catalog.pg_statio_all_tables AS st
-- INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
-- INNER JOIN information_schema.columns col ON (
--   pgd.objsubid = col.ordinal_position AND
--   col.table_schema = st.schemaname AND
--   col.table_name = st.relname AND
--   col.table_schema = 'public'
-- )
-- WHERE st.relname = 'pending_products'
-- ORDER BY col.ordinal_position;