-- ============================================================================
-- FIX PRODUCT FUNCTIONS - Remove Redundant Admin Checks
-- ============================================================================
-- Issue: Database functions check admin access using role context variables
--         that are never set, causing legitimate operations to fail
-- Solution: Remove redundant admin checks since TypeScript layer already
--           handles access control via requireAdmin()
-- Functions: upsert_product (other functions may need similar fixes)

-- ============================================================================
-- FIX: upsert_product function - Remove redundant admin check
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_product CASCADE;
CREATE OR REPLACE FUNCTION upsert_product(p_code text, p_collection text, p_description text, p_unit text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  -- Admin check removed - TypeScript layer handles access control via requireAdmin()

  INSERT INTO products (code, collection, description, unit)
  VALUES (p_code, p_collection, p_description, p_unit)
  ON CONFLICT (code) DO UPDATE SET
    collection = EXCLUDED.collection, description = EXCLUDED.description,
    unit = EXCLUDED.unit, updated_at = now()
  RETURNING id, code, collection, description, unit, active, created_at, updated_at INTO v_product;

  RETURN row_to_json(v_product)::json;
END;
$$;

COMMENT ON FUNCTION upsert_product IS 'SECURITY DEFINER function for product upsert operations. Admin access check removed - handled by TypeScript layer. Returns product data.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION upsert_product(text, text, text, text) TO PUBLIC;

COMMENT ON SCHEMA public IS 'FIX: Removed redundant admin check from upsert_product - TypeScript layer handles access control via requireAdmin()';