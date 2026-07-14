-- Migration: Company Product Management System
-- Description: Multi-tenant product catalog with admin promotion workflow

-- Create company_product_definitions table
CREATE TABLE IF NOT EXISTS company_product_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  collection VARCHAR(100),
  description TEXT NOT NULL,
  unit VARCHAR(20) DEFAULT 'sqft',
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_approved_for_global BOOLEAN DEFAULT FALSE,
  global_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for company_id + code (case-insensitive)
CREATE UNIQUE INDEX idx_company_products_company_code_unique ON company_product_definitions(company_id, UPPER(code));

-- Performance indexes
CREATE INDEX idx_company_products_company_id ON company_product_definitions(company_id);
CREATE INDEX idx_company_products_code ON company_product_definitions(code);
CREATE INDEX idx_company_products_approval_status ON company_product_definitions(is_approved_for_global);
CREATE INDEX idx_company_products_submitted_by ON company_product_definitions(submitted_by);

-- Add comments for documentation
COMMENT ON TABLE company_product_definitions IS 'Company-specific product definitions awaiting admin promotion';
COMMENT ON COLUMN company_product_definitions.is_approved_for_global IS 'Whether this product has been promoted to global catalog';
COMMENT ON COLUMN company_product_definitions.global_product_id IS 'Reference to global product if promoted';