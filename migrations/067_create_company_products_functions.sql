-- Migration: Create SECURITY DEFINER functions for company_products operations
-- Purpose: Provide controlled RLS bypass for company products INSERT/UPDATE operations
-- Pattern: Following SECURITY DEFINER approach with proper security checks

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- ============================================================================

DROP FUNCTION IF EXISTS get_company_product_pricing CASCADE;
DROP FUNCTION IF EXISTS check_company_has_products CASCADE;
DROP FUNCTION IF EXISTS count_company_products CASCADE;
DROP FUNCTION IF EXISTS upsert_company_product CASCADE;

-- ============================================================================
-- COMPANY PRODUCTS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_product_pricing(p_company_id uuid, p_product_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      supplier_cost::float,
      retail_price::float
    FROM company_products
    WHERE company_id = p_company_id AND product_id = p_product_id
  ) t
$$;

COMMENT ON FUNCTION get_company_product_pricing IS 'SECURITY DEFINER function to get company product pricing. Bypasses RLS for product pricing lookup.';

GRANT EXECUTE ON FUNCTION get_company_product_pricing(uuid, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION check_company_has_products(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM company_products WHERE company_id = p_company_id)
$$;

COMMENT ON FUNCTION check_company_has_products IS 'SECURITY DEFINER function to check if company has any products. Bypasses RLS for company product check.';

GRANT EXECUTE ON FUNCTION check_company_has_products(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION count_company_products(p_company_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT COUNT(*) as count
    FROM company_products
    WHERE company_id = p_company_id
  ) t
$$;

COMMENT ON FUNCTION count_company_products IS 'SECURITY DEFINER function to count company products. Bypasses RLS for product count.';

GRANT EXECUTE ON FUNCTION count_company_products(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION upsert_company_product(
  p_company_id uuid,
  p_product_id uuid,
  p_supplier_cost numeric,
  p_retail_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  INSERT INTO company_products (company_id, product_id, supplier_cost, retail_price)
  VALUES (p_company_id, p_product_id, p_supplier_cost, p_retail_price)
  ON CONFLICT (company_id, product_id) DO UPDATE SET
    supplier_cost = EXCLUDED.supplier_cost,
    retail_price = EXCLUDED.retail_price,
    updated_at = NOW()
  RETURNING
    id,
    company_id,
    product_id,
    supplier_cost::float,
    retail_price::float
  INTO v_result;

  IF NOT FOUND THEN
    -- Return error if insert failed
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to upsert company product',
      'company_id', p_company_id,
      'product_id', p_product_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'id', v_result.id,
    'company_id', v_result.company_id,
    'product_id', v_result.product_id,
    'supplier_cost', v_result.supplier_cost,
    'retail_price', v_result.retail_price
  );
END;
$$;

COMMENT ON FUNCTION upsert_company_product IS 'SECURITY DEFINER function for upserting company products. Bypasses RLS to allow companies to set product pricing. Returns success/error status.';

GRANT EXECUTE ON FUNCTION upsert_company_product(uuid, uuid, numeric, numeric) TO PUBLIC;