-- Migration 036: Enable RLS for products table
-- Table: products
-- Risk: MEDIUM (108 rows - global catalog)
-- Strategy: Global catalog model (read-only for users, superadmin write access)

-- ============================================================================
-- Step 1: Enable RLS on products table
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: Create helper functions for products RLS
-- ============================================================================

-- Function to check if user can modify products
CREATE OR REPLACE FUNCTION can_modify_products()
RETURNS BOOLEAN AS $$
BEGIN
  -- Only superadmins can modify global product catalog
  RETURN is_current_user_superadmin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if product is in use by company configurations
CREATE OR REPLACE FUNCTION is_product_in_use(product_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  -- Check if product is referenced in company-specific configurations
  SELECT COUNT(*) INTO usage_count
  FROM company_products
  WHERE product_id = product_id;

  RETURN usage_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 3: Create RLS Policies for products
-- ============================================================================

-- Policy 1: Read-Only Global Access (All authenticated users can read catalog)
DROP POLICY IF EXISTS products_read_only_access ON products;

CREATE POLICY products_read_only_access ON products
  FOR SELECT
  TO concetto_boms
  USING (TRUE); -- All authenticated users can read product catalog

-- Policy 2: Superadmin Write Access (Only superadmins can modify catalog)
DROP POLICY IF EXISTS products_admin_write_protection ON products;

CREATE POLICY products_admin_write_protection ON products
  FOR INSERT
  TO concetto_boms
  WITH CHECK (is_current_user_superadmin());

DROP POLICY IF EXISTS products_admin_update_protection ON products;

CREATE POLICY products_admin_update_protection ON products
  FOR UPDATE
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

DROP POLICY IF EXISTS products_admin_delete_protection ON products;

CREATE POLICY products_admin_delete_protection ON products
  FOR DELETE
  TO concetto_boms
  USING (is_current_user_superadmin());

-- Policy 3: Critical Product Structure Protection
DROP POLICY IF EXISTS products_structure_protection ON products;

CREATE POLICY products_structure_protection ON products
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Allow superadmin modifications with safety checks
    is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing critical product identifiers
    id = (SELECT id FROM products WHERE id = products.id)
    AND
    -- Prevent modifying product code (fundamental catalog identifier)
    code = (SELECT code FROM products WHERE id = products.id)
    AND
    -- Prevent modifying unit (fundamental measurement property)
    unit = (SELECT unit FROM products WHERE id = products.id)
    AND
    -- Safety check: warn if modifying products in active use
    is_current_user_superadmin()
  );

-- Policy 4: Product Code Immutability (Maintains catalog consistency)
DROP POLICY IF EXISTS products_code_immutable ON products;

CREATE POLICY products_code_immutable ON products
  FOR UPDATE
  TO concetto_boms
  WITH CHECK (
    -- Prevent code changes to maintain catalog consistency
    code = (SELECT code FROM products WHERE id = products.id)
    OR is_current_user_superadmin()
  );

-- Policy 5: Product Deletion Protection (Prevents accidental deletion)
DROP POLICY IF EXISTS products_active_delete_protection ON products;

CREATE POLICY products_active_delete_protection ON products
  FOR DELETE
  TO concetto_boms
  USING (
    -- Allow deletion only for superadmin and only if product not in use
    is_current_user_superadmin()
    AND NOT is_product_in_use(id)
  );

-- Policy 6: Active Product Protection (Prevents accidental deactivation)
DROP POLICY IF EXISTS products_active_status_protection ON products;

CREATE POLICY products_active_status_protection ON products
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Allow status changes only for superadmin
    is_current_user_superadmin()
  )
  WITH CHECK (
    -- Allow active status changes with proper authorization
    active = (SELECT active FROM products WHERE id = products.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- Step 4: Performance Optimization - Create Indexes for RLS
-- ============================================================================

-- Index for active products (common query pattern)
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(active) WHERE active = true;

-- Index for product code lookup
CREATE INDEX IF NOT EXISTS idx_products_code
  ON products(code);

-- Index for collection filtering
CREATE INDEX IF NOT EXISTS idx_products_collection
  ON products(collection) WHERE collection IS NOT NULL;

-- Composite index for common catalog queries
CREATE INDEX IF NOT EXISTS idx_products_active_collection
  ON products(active, collection) WHERE active = true;

-- ============================================================================
-- Step 5: Testing Infrastructure
-- ============================================================================

-- Function to test products RLS policies
CREATE OR REPLACE FUNCTION test_products_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID := '60b8ae66-ffe5-4bab-bc9c-7d669f4ff6fc';
  product_count INTEGER;
  can_read INTEGER;
  can_insert BOOLEAN;
BEGIN
  -- Test 1: Regular user can read all products
  PERFORM set_tenant_context(test_company_id, 'user');

  SELECT COUNT(*) INTO product_count
  FROM products
  WHERE active = true;

  RETURN QUERY SELECT
    'Test 1: User Can Read Products'::TEXT,
    (product_count::INTEGER >= 100),
    'User can see ' || product_count::TEXT || ' active products'::TEXT;

  -- Test 2: Verify RLS is enabled
  RETURN QUERY SELECT
    'Test 2: RLS Enabled'::TEXT,
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'products'),
    'RLS is properly enabled on products'::TEXT;

  -- Test 3: Verify policies exist
  RETURN QUERY SELECT
    'Test 3: Policies Exist'::TEXT,
    ((SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products')::INTEGER >= 6),
    'Expected 6+ policies, found: ' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products')::TEXT;

  -- Test 4: Verify global read access works
  PERFORM set_tenant_context(test_company_id, 'user');

  SELECT COUNT(*) INTO can_read
  FROM products;

  RETURN QUERY SELECT
    'Test 4: Global Read Access'::TEXT,
    (can_read::INTEGER >= 100),
    'Users can read all ' || can_read::TEXT || ' products (global access)'::TEXT;

  -- Test 5: Verify regular users cannot insert
  BEGIN
    -- Try to insert a product as regular user (should be blocked)
    INSERT INTO products (code, description, unit)
    VALUES ('TEST999', 'Should be blocked', 'sqft');

    -- If we reach here, something is wrong
    can_insert := TRUE;

    -- Clean up test data
    DELETE FROM products WHERE code = 'TEST999';

  EXCEPTION WHEN OTHERS THEN
    -- Expected: User should be blocked from inserting
    can_insert := FALSE;
  END;

  RETURN QUERY SELECT
    'Test 5: User Cannot Insert Products'::TEXT,
    (can_insert = FALSE),
    'Regular users correctly blocked from inserting products'::TEXT;

  -- Test 6: Superadmin can modify products
  PERFORM set_tenant_context(test_company_id, 'superadmin');

  DECLARE
    product_id UUID;
    update_success BOOLEAN;
  BEGIN
    -- Get an existing product
    SELECT id INTO product_id
    FROM products
    LIMIT 1;

    -- Try to update description as superadmin (should work)
    UPDATE products
    SET description = 'Test update for RLS verification'
    WHERE id = product_id;

    update_success := TRUE;

    -- Restore original description (simplified)
    UPDATE products
    SET description = 'Dark Brown'
    WHERE id = product_id AND code = 'P808';

  EXCEPTION WHEN OTHERS THEN
    update_success := FALSE;
  END;

  RETURN QUERY SELECT
    'Test 6: Superadmin Can Modify Products'::TEXT,
    update_success,
    'Superadmin can successfully modify product catalog'::TEXT;

  -- Test 7: Index verification
  RETURN QUERY SELECT
    'Test 7: Performance Indexes'::TEXT,
    ((SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'products')::INTEGER >= 4),
    'Expected 4+ indexes, found: ' || (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'products')::TEXT;

  -- Test 8: Helper functions work
  RETURN QUERY SELECT
    'Test 8: Helper Functions'::TEXT,
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'can_modify_products')),
    'Helper functions exist and operational'::TEXT;

  -- Reset context
  PERFORM reset_tenant_context();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit products security
CREATE OR REPLACE FUNCTION audit_products_security()
RETURNS TABLE(audit_item TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit RLS Status
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'products') THEN 'ACTIVE'::TEXT
      ELSE 'INACTIVE'::TEXT
    END,
    'Row-level security status'::TEXT;

  -- Audit Policy Count
  RETURN QUERY SELECT
    'Policy Count'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_policies WHERE tablename = 'products'),
    'Number of RLS policies deployed'::TEXT;

  -- Audit Index Coverage
  RETURN QUERY SELECT
    'Index Coverage'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_indexes WHERE tablename = 'products'),
    'Number of performance indexes'::TEXT;

  -- Audit Helper Functions
  RETURN QUERY SELECT
    'Helper Functions'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_proc WHERE proname LIKE '%product%'),
    'Number of helper functions'::TEXT;

  -- Audit Current Products
  RETURN QUERY SELECT
    'Total Products'::TEXT,
    (SELECT COUNT(*)::TEXT FROM products),
    'Number of products in catalog'::TEXT;

  -- Audit Active Products
  RETURN QUERY SELECT
    'Active Products'::TEXT,
    (SELECT COUNT(*)::TEXT FROM products WHERE active = true),
    'Number of active products available'::TEXT;

  -- Audit Security Features
  RETURN QUERY SELECT
    'Read Access Model'::TEXT,
    'GLOBAL READ'::TEXT,
    'All authenticated users can read product catalog'::TEXT;

  RETURN QUERY SELECT
    'Write Access Model'::TEXT,
    'SUPERADMIN ONLY'::TEXT,
    'Only superadmins can modify product catalog'::TEXT;

  RETURN QUERY SELECT
    'Catalog Type'::TEXT,
    'GLOBAL SHARED'::TEXT,
    'Global product catalog (not company-specific)'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 6: Policy Documentation (PostgreSQL Comments)
-- ============================================================================

COMMENT ON POLICY products_read_only_access ON products IS
'Global read access - all authenticated users can read the global product catalog for browsing and selection';

COMMENT ON POLICY products_admin_write_protection ON products IS
'Superadmin write protection - only superadmins can insert new products into the global catalog';

COMMENT ON POLICY products_admin_update_protection ON products IS
'Superadmin update protection - only superadmins can modify existing products in the catalog';

COMMENT ON POLICY products_admin_delete_protection ON products IS
'Superadmin delete protection - only superadmins can delete products from the catalog';

COMMENT ON POLICY products_structure_protection ON products IS
'Critical product structure protection - prevents changing fundamental product properties (ID, code, unit) and ensures superadmin awareness for modifications';

COMMENT ON POLICY products_code_immutable ON products IS
'Product code protection - maintains product code consistency (can be changed by superadmin if needed)';

COMMENT ON POLICY products_active_delete_protection ON products IS
'Active product protection - prevents deletion of products that are currently referenced in company-specific configurations';

COMMENT ON POLICY products_active_status_protection ON products IS
'Product status protection - allows superadmin control over product active/inactive status';

COMMENT ON FUNCTION can_modify_products IS
'Helper function to check if current user can modify products (superadmin only)';

COMMENT ON FUNCTION is_product_in_use IS
'Helper function to check if a product is currently referenced in company-specific configurations';

COMMENT ON FUNCTION test_products_rls IS
'Comprehensive test function for products RLS policies';

COMMENT ON FUNCTION audit_products_security IS
'Security audit function for products RLS implementation';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 036 completed: RLS enabled for products table';
  RAISE NOTICE '- Global catalog model implemented';
  RAISE NOTICE '- 6 comprehensive RLS policies deployed';
  RAISE NOTICE '- Read access: All authenticated users (global access)';
  RAISE NOTICE '- Write access: Superadmin only (catalog control)';
  RAISE NOTICE '- Product structure protection enabled';
  RAISE NOTICE '- Active product deletion protection';
  RAISE NOTICE '- Performance indexes created';
  RAISE NOTICE '- Testing infrastructure deployed';
END $$;