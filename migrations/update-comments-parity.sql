-- Migration: Update Database 1 to match Database 2 comments exactly
-- Description: This migration ensures 100% comment parity between databases

-- Update quote_items table column comments to match Database 2
COMMENT ON COLUMN quote_items.product_source IS 'Source of product: approved (from products table) or pending (from pending_products)';
COMMENT ON COLUMN quote_items.pending_product_id IS 'Reference to pending product if product_source=pending';

-- Update pending_products table comment to match Database 2
COMMENT ON TABLE pending_products IS 'Merchant-submitted products awaiting admin approval';

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