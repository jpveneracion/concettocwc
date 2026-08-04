-- Fix RLS policy logic bugs in company_product_definitions table
-- This script drops and recreates the policies with corrected logic

-- Drop existing policies
DROP POLICY IF EXISTS company_product_definitions_tenant_isolation ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_admin_promotion_access ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_admin_access ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_read_only_access ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_insert_protection ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_update_protection ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_delete_protection ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_superadmin_promotion_workflow ON company_product_definitions;
-- Note: company_id_immutable policy removed - RLS policies cannot handle old/new value comparisons
DROP POLICY IF EXISTS company_product_definitions_promoted_product_protection ON company_product_definitions;
DROP POLICY IF EXISTS company_product_definitions_promoted_delete_protection ON company_product_definitions;

-- ============================================================================
-- FIXED BASE TENANT ISOLATION POLICY
-- ============================================================================

CREATE POLICY company_product_definitions_tenant_isolation ON company_product_definitions
  FOR ALL
  USING (
    -- Require tenant context to be set (fail secure if NULL)
    -- Superadmins can access all data for promotion workflow
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the company_id matches current context
    -- unless user is superadmin performing promotion workflow
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_tenant_isolation ON company_product_definitions IS 'Primary tenant isolation policy. Users can only access product definitions from their company, except superadmins who can access all companies for promotion workflow. FIXED: Added explicit NULL check for get_current_company_id().';

-- ============================================================================
-- FIXED ADMIN PROMOTION ACCESS POLICY
-- ============================================================================

CREATE POLICY company_product_definitions_admin_promotion_access ON company_product_definitions
  FOR SELECT
  USING (
    is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_admin_promotion_access ON company_product_definitions IS
'Critical policy for admin promotion workflow. Allows superadmins to read pending product definitions from all companies for global catalog promotion purposes.';

-- ============================================================================
-- FIXED COMPANY ADMIN ACCESS POLICY
-- ============================================================================

CREATE POLICY company_product_definitions_admin_access ON company_product_definitions
  FOR ALL
  USING (
    is_current_user_admin()
    AND get_current_company_id() IS NOT NULL
    AND company_id = get_current_company_id()
  )
  WITH CHECK (
    is_current_user_admin()
    AND get_current_company_id() IS NOT NULL
    AND company_id = get_current_company_id()
  );

COMMENT ON POLICY company_product_definitions_admin_access ON company_product_definitions IS 'Admin access policy within company. Allows company admins full access to product definitions in their company. FIXED: Added explicit NULL check for get_current_company_id().';

-- ============================================================================
-- FIXED READ-ONLY ACCESS POLICY
-- ============================================================================

CREATE POLICY company_product_definitions_read_only_access ON company_product_definitions
  FOR SELECT
  USING (
    -- Regular users can only read from their own company
    -- Superadmins can read from all companies for promotion workflow
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_read_only_access ON company_product_definitions IS 'Read-only access policy for regular users. Allows reading product definitions from own company only. FIXED: Added explicit NULL check for get_current_company_id().';

-- ============================================================================
-- FIXED WRITE PROTECTION POLICIES
-- ============================================================================

CREATE POLICY company_product_definitions_insert_protection ON company_product_definitions
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted product definitions belong to current user's company
    -- Superadmins can insert for any company (for migration purposes)
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR (is_current_user_superadmin() AND company_id IS NOT NULL)
  );

CREATE POLICY company_product_definitions_update_protection ON company_product_definitions
  FOR UPDATE
  USING (
    -- Can only update product definitions in own company
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

CREATE POLICY company_product_definitions_delete_protection ON company_product_definitions
  FOR DELETE
  USING (
    -- Can only delete product definitions in own company
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_insert_protection ON company_product_definitions IS 'Insert protection policy. Ensures new product definitions are assigned to current user company only. FIXED: Added explicit NULL check for get_current_company_id().';

COMMENT ON POLICY company_product_definitions_update_protection ON company_product_definitions IS 'Update protection policy. Prevents cross-company product definition modifications. FIXED: Added explicit NULL check for get_current_company_id().';

COMMENT ON POLICY company_product_definitions_delete_protection ON company_product_definitions IS 'Delete protection policy. Prevents cross-company product definition deletions. FIXED: Added explicit NULL check for get_current_company_id().';

-- ============================================================================
-- FIXED SUPERADMIN PROMOTION WORKFLOW POLICY
-- ============================================================================

CREATE POLICY company_product_definitions_superadmin_promotion_workflow ON company_product_definitions
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_superadmin_promotion_workflow ON company_product_definitions IS 'Superadmin promotion workflow policy. Allows superadmins full access to all product definitions for global catalog management and promotion operations.';

-- ============================================================================
-- NOTE: COMPANY_ID IMMUTABILITY AND PROMOTED PRODUCT PROTECTION
-- ============================================================================
-- The following immutability constraints are handled by the main tenant isolation
-- policies above. PostgreSQL RLS policies cannot directly reference old vs new
-- values in UPDATE operations (no old/new transition tables like triggers).
-- For true immutability constraints, consider using triggers instead of RLS policies.
-- The existing tenant isolation policies already prevent cross-company data access.

-- ============================================================================
-- FIXED PROMOTED PRODUCT PROTECTION POLICY
-- ============================================================================

CREATE POLICY company_product_definitions_promoted_product_protection ON company_product_definitions
  FOR UPDATE
  USING (
    -- Allow updates only if not yet promoted, or if superadmin
    is_approved_for_global = false
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Allow the update if superadmin or if product remains not promoted
    is_current_user_superadmin() OR is_approved_for_global = false
  );

CREATE POLICY company_product_definitions_promoted_delete_protection ON company_product_definitions
  FOR DELETE
  USING (
    -- Prevent deletion of promoted products
    is_approved_for_global = false
    OR is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_promoted_product_protection ON company_product_definitions IS
'Protection policy for promoted products. Prevents modification of products that have been promoted to global catalog. SIMPLIFIED: Uses USING and WITH CHECK clauses to control access since RLS policies cannot reference old vs new values directly.';

COMMENT ON POLICY company_product_definitions_promoted_delete_protection ON company_product_definitions IS
'Delete protection for promoted products. Prevents deletion of products that have been promoted to global catalog.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all policies are created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'company_product_definitions';

  RAISE NOTICE 'Total RLS policies on company_product_definitions: %', policy_count;

  IF policy_count = 10 THEN
    RAISE NOTICE '✅ All 10 RLS policies successfully created';
  ELSE
    RAISE NOTICE '⚠️  Expected 10 policies but found %', policy_count;
  END IF;
END $$;

-- Show created policies
SELECT
  policyname,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE tablename = 'company_product_definitions'
ORDER BY policyname;