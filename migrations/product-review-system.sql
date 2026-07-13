-- Migration: Product Review System
-- Description: Multi-tenant product submission and admin review workflow

-- 1. Create pending_products table for merchant-submitted products awaiting admin approval
CREATE TABLE IF NOT EXISTS pending_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  collection VARCHAR(100),
  description TEXT NOT NULL,
  unit VARCHAR(20) DEFAULT 'sqft',
  status VARCHAR(20) DEFAULT 'pending',
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- 2. Global unique constraint: product codes must be unique sitewide
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_products_code
  ON pending_products(UPPER(code));

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_products_company ON pending_products(company_id);
CREATE INDEX IF NOT EXISTS idx_pending_products_status ON pending_products(status);
CREATE INDEX IF NOT EXISTS idx_pending_products_submitted_by ON pending_products(submitted_by);

-- 4. Add product source tracking to quote_items
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_source VARCHAR(20) DEFAULT 'approved';
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS pending_product_id UUID REFERENCES pending_products(id);

-- 5. Update existing items to default to approved products
UPDATE quote_items SET product_source = 'approved' WHERE product_source IS NULL;

-- 6. Add constraints for valid product sources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_product_source'
  ) THEN
    ALTER TABLE quote_items ADD CONSTRAINT check_product_source
      CHECK (product_source IN ('approved', 'pending'));
  END IF;
END $$;

-- 7. Create indexes for quote item product lookups
CREATE INDEX IF NOT EXISTS idx_quote_items_product_source ON quote_items(product_source);
CREATE INDEX IF NOT EXISTS idx_quote_items_pending_product ON quote_items(pending_product_id);

-- 8. Add comments for documentation
COMMENT ON TABLE pending_products IS 'Merchant-submitted products awaiting admin approval';
COMMENT ON COLUMN pending_products.status IS 'pending, approved, or rejected';
COMMENT ON COLUMN pending_products.submitted_by IS 'User who submitted the product';
COMMENT ON COLUMN pending_products.reviewed_by IS 'Admin who reviewed the product';
COMMENT ON COLUMN pending_products.code IS 'Product code (globally unique)';
COMMENT ON COLUMN quote_items.product_source IS 'Source of product: approved (from products table) or pending (from pending_products)';
COMMENT ON COLUMN quote_items.pending_product_id IS 'Reference to pending product if product_source=pending';

-- Migration complete