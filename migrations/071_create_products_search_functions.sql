-- Migration: Create SECURITY DEFINER functions for products search operations
-- Purpose: Provide controlled RLS bypass for products autocomplete and lookup operations
-- Pattern: Following SECURITY DEFINER approach with proper security

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- ============================================================================

DROP FUNCTION IF EXISTS search_products_autocomplete CASCADE;
DROP FUNCTION IF EXISTS lookup_product_by_code CASCADE;
DROP FUNCTION IF EXISTS get_product_by_id CASCADE;

-- ============================================================================
-- PRODUCTS SEARCH FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION search_products_autocomplete(p_query text)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      code, collection, description, unit
    FROM products
    WHERE
      UPPER(code) LIKE UPPER(p_query || '%')
      AND active = true
    ORDER BY code
    LIMIT 10
  ) t
$$;

COMMENT ON FUNCTION search_products_autocomplete IS 'SECURITY DEFINER function for product autocomplete search. Bypasses RLS for product lookup.';

GRANT EXECUTE ON FUNCTION search_products_autocomplete(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION lookup_product_by_code(p_code text, p_company_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      p.id, p.code, p.collection, p.description, p.unit,
      COALESCE(cc.supplier_cost::float, 0) as supplier_cost,
      COALESCE(cc.retail_price::float, 0) as retail_price
    FROM products p
    LEFT JOIN company_collections cc ON cc.collection = p.collection AND cc.company_id = p_company_id
    WHERE UPPER(p.code) = UPPER(p_code) AND p.active = true
    LIMIT 1
  ) t
$$;

COMMENT ON FUNCTION lookup_product_by_code IS 'SECURITY DEFINER function for product lookup by code with company pricing. Bypasses RLS for product lookup.';

GRANT EXECUTE ON FUNCTION lookup_product_by_code(text, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_product_by_id(p_product_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, code, collection, description, unit, active,
      created_at, updated_at
    FROM products
    WHERE id = p_product_id
  ) t
$$;

COMMENT ON FUNCTION get_product_by_id IS 'SECURITY DEFINER function to get product by ID. Bypasses RLS for product lookup.';

GRANT EXECUTE ON FUNCTION get_product_by_id(uuid) TO PUBLIC;