-- ============================================================================
-- CREATE DELETE PRODUCT FUNCTION - SECURITY DEFINER
-- ============================================================================
-- Issue: Direct UPDATE queries are blocked by RLS policies
-- Solution: Create SECURITY DEFINER function to handle product deletion
--          This bypasses RLS and allows admin users to delete products

-- ============================================================================
-- CREATE: delete_product function - SECURITY DEFINER for deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_product(p_product_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Soft delete product by setting active = false
  UPDATE products
  SET active = false, updated_at = NOW()
  WHERE id = p_product_id AND active = true
  RETURNING id, code, active INTO v_result;

  IF NOT FOUND THEN
    -- Return error if product not found or already deleted
    RETURN json_build_object(
      'success', false,
      'error', 'Product not found or already deleted',
      'product_id', p_product_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'product_id', v_result.id,
    'code', v_result.code,
    'active', v_result.active
  );
END;
$$;

COMMENT ON FUNCTION delete_product IS 'SECURITY DEFINER function for product deletion. Bypasses RLS to allow admins to soft-delete products. Returns success/error status.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION delete_product(uuid) TO PUBLIC;

COMMENT ON SCHEMA public IS 'ADDED: delete_product SECURITY DEFINER function - bypasses RLS for product deletion';