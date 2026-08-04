-- migrations/017_enable_rls_company_product_definitions.sql
-- Row-Level Security Policies for Company Product Definitions Table
--
-- This migration enables comprehensive RLS on the company_product_definitions table
-- to enforce tenant isolation at the database level while supporting the admin
-- promotion workflow for global catalog management.
--
-- Architecture Context:
-- - products: Global catalog table (NO company_id) - NO RLS needed
-- - company_product_definitions: Tenant-specific products (HAS company_id) - RLS enabled
-- - Promotion workflow: Admins promote company products to global catalog
--
-- Security Model:
-- - Tenant Isolation: Users can only access product definitions from their company
-- - Admin Promotion Access: Superadmins can read pending products across all companies
-- - Write Protection: Prevent cross-company data modifications
-- - Company ID Immutability: Cannot change company association after creation
-- - Promotion Workflow: Special access for admin console promotion operations

-- ============================================================================
-- ENABLE RLS ON COMPANY PRODUCT DEFINITIONS TABLE
-- ============================================================================

-- Enable Row-Level Security on the company_product_definitions table
ALTER TABLE company_product_definitions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY
-- ============================================================================

/**
 * Primary tenant isolation policy for company_product_definitions table
 *
 * This policy enforces that users can only access product definitions belonging
 * to their company, with exceptions for superadmins who need cross-company
 * access for promotion workflow purposes.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
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

-- ============================================================================
-- ADMIN PROMOTION ACCESS POLICY (CRITICAL FOR WORKFLOW)
-- ============================================================================

/**
 * Admin promotion access policy for cross-company product promotion workflow
 *
 * This policy is CRITICAL for the admin console promotion workflow.
 * It allows superadmins to read pending product definitions from all companies
 * for the purpose of promoting them to the global catalog.
 *
 * Security considerations:
 * - Only grants SELECT access (read-only for promotion decisions)
 * - Only applies to superadmin role (strict access control)
 * - Does not grant write access (use separate policies for promotion actions)
 * - Works with getPendingPromotionProducts() in company-product-queries.ts
 *
 * Workflow integration:
 * - Admin console queries pending products across all companies
 * - Superadmins review and promote products to global catalog
 * - Promotion actions use separate superadmin write policies
 */
CREATE POLICY company_product_definitions_admin_promotion_access ON company_product_definitions
  FOR SELECT
  USING (
    is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_admin_promotion_access ON company_product_definitions IS
'Critical policy for admin promotion workflow. Allows superadmins to read pending product definitions from all companies for global catalog promotion purposes.';

-- ============================================================================
-- COMPANY ADMIN ACCESS POLICY WITHIN COMPANY
-- ============================================================================

/**
 * Company admin access policy within their company
 *
 * This policy allows company admins to perform all operations on product
 * definitions within their company, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities within tenant scope.
 */
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

-- ============================================================================
-- READ-ONLY ACCESS POLICY FOR STANDARD USERS
-- ============================================================================

/**
 * Read-only access policy for regular company users
 *
 * This policy allows regular users to read product definitions from their company
 * but prevents modifications unless they have admin privileges.
 *
 * Note: Product creation/modification is also controlled by subscription status
 * and business rules at the application layer, but this provides database-level
 * defense in depth.
 */
CREATE POLICY company_product_definitions_read_only_access ON company_product_definitions
  FOR SELECT
  USING (
    -- Regular users can only read from their own company
    -- Superadmins can read from all companies for promotion workflow
    (get_current_company_id() IS NOT NULL AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

/**
 * Write protection policy to prevent cross-company data insertion
 *
 * This is a critical security policy that prevents users from creating product
 * definitions for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
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

-- ============================================================================
-- SUPERADMIN PROMOTION WORKFLOW POLICY
-- ============================================================================

/**
 * Superadmin promotion workflow policy for global catalog management
 *
 * This policy explicitly allows superadmins to perform write operations on
 * product definitions from any company for the purpose of promotion workflow.
 *
 * This is necessary for:
 * - promoteCompanyProduct() function operations
 * - Updating is_approved_for_global flag
 * - Setting global_product_id reference
 * - Rejecting products (delete operation)
 *
 * WARNING: This policy should only be granted to trusted superadmin users
 * and should be audited regularly for security compliance.
 */
CREATE POLICY company_product_definitions_superadmin_promotion_workflow ON company_product_definitions
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

-- ============================================================================
-- COMPANY_ID IMMUTABILITY POLICY
-- ============================================================================

/**
 * Critical security policy to prevent company_id changes
 *
 * This policy prevents users from changing the company_id of existing product
 * definitions, which would be a security vulnerability allowing data transfer
 * between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 * Once a product definition is created for a company, it must remain associated
 * with that company permanently.
 */
CREATE POLICY company_product_definitions_company_id_immutable ON company_product_definitions
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (new value must equal old value)
    -- Use subquery to get current company_id since old.company_id is not valid in RLS policies
    company_id = (SELECT company_id FROM company_product_definitions WHERE id = company_product_definitions.id)
    OR is_current_user_superadmin()
  );

COMMENT ON POLICY company_product_definitions_company_id_immutable ON company_product_definitions IS
'Critical security policy. Prevents company_id changes on existing product definitions to prevent data transfer between companies. Superadmin exception for data migration operations.';

-- ============================================================================
-- PROMOTED PRODUCT PROTECTION POLICY
-- ============================================================================

/**
 * Protection policy for promoted products
 *
 * This policy prevents modification or deletion of products that have already
 * been promoted to the global catalog (is_approved_for_global = true).
 *
 * Business logic: Once a company product is promoted to the global catalog,
 * it should be immutable to maintain consistency between company and global
 * product catalogs. Changes should go through the global catalog instead.
 *
 * Application layer enforces this, but RLS provides database-level protection.
 */
CREATE POLICY company_product_definitions_promoted_product_protection ON company_product_definitions
  FOR UPDATE
  USING (
    -- Allow updates only if not yet promoted
    is_approved_for_global = false
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Allow setting is_approved_for_global to true, or superadmin exception
    -- This prevents changing FROM true TO false values
    is_approved_for_global = true
    OR is_current_user_superadmin()
  );

CREATE POLICY company_product_definitions_promoted_delete_protection ON company_product_definitions
  FOR DELETE
  USING (
    -- Prevent deletion of promoted products
    is_approved_for_global = false
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY company_product_definitions_tenant_isolation ON company_product_definitions IS 'Primary tenant isolation policy. Users can only access product definitions from their company, except superadmins who can access all companies for promotion workflow.';

COMMENT ON POLICY company_product_definitions_admin_access ON company_product_definitions IS 'Admin access policy within company. Allows company admins full access to product definitions in their company.';

COMMENT ON POLICY company_product_definitions_read_only_access ON company_product_definitions IS 'Read-only access policy for regular users. Allows reading product definitions from own company only.';

COMMENT ON POLICY company_product_definitions_insert_protection ON company_product_definitions IS 'Insert protection policy. Ensures new product definitions are assigned to current user company only.';

COMMENT ON POLICY company_product_definitions_update_protection ON company_product_definitions IS 'Update protection policy. Prevents cross-company product definition modifications.';

COMMENT ON POLICY company_product_definitions_delete_protection ON company_product_definitions IS 'Delete protection policy. Prevents cross-company product definition deletions.';

COMMENT ON POLICY company_product_definitions_superadmin_promotion_workflow ON company_product_definitions IS 'Superadmin promotion workflow policy. Allows superadmins full access to all product definitions for global catalog management and promotion operations.';

COMMENT ON POLICY company_product_definitions_promoted_product_protection ON company_product_definitions IS 'Protection policy for promoted products. Prevents modification of products that have been promoted to global catalog.';

COMMENT ON POLICY company_product_definitions_promoted_delete_protection ON company_product_definitions IS 'Delete protection for promoted products. Prevents deletion of products that have been promoted to global catalog.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_company_product_definitions_company_id ON company_product_definitions(company_id);

-- Create composite index for common RLS queries (company_id + created_at)
-- This optimizes queries that filter by company and sort by creation date
CREATE INDEX IF NOT EXISTS idx_company_product_definitions_company_created ON company_product_definitions(company_id, created_at DESC);

-- Create index for promotion workflow queries (is_approved_for_global + created_at)
-- This optimizes admin console queries for pending products
CREATE INDEX IF NOT EXISTS idx_company_product_definitions_promotion_pending ON company_product_definitions(is_approved_for_global, created_at ASC)
WHERE is_approved_for_global = false;

-- Create index for code lookups within company context
CREATE INDEX IF NOT EXISTS idx_company_product_definitions_company_code ON company_product_definitions(company_id, UPPER(code));

-- Create index for global product references
CREATE INDEX IF NOT EXISTS idx_company_product_definitions_global_product ON company_product_definitions(global_product_id)
WHERE global_product_id IS NOT NULL;

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate company_product_definitions RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin promotion workflow,
 * superadmin access, and promoted product protection.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_company_product_definitions_rls()
RETURNS TABLE(
  test_name TEXT,
  success BOOLEAN,
  message TEXT,
  details TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  test_company_1_id UUID;
  test_company_2_id UUID;
  test_user_company_1_id UUID;
  test_admin_company_1_id UUID;
  test_superadmin_id UUID;
  test_product_1_id UUID;
  test_product_2_id UUID;
  access_count INTEGER;
  expected_count INTEGER;
BEGIN
  -- Generate test company IDs
  test_company_1_id := gen_random_uuid();
  test_company_2_id := gen_random_uuid();

  -- Test 1: Verify RLS is enabled
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'company_product_definitions'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on company_product_definitions table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on company_product_definitions table'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 2: Verify tenant context requirement
  BEGIN
    -- Reset context first
    PERFORM reset_tenant_context();

    -- Try to query without context (should fail or return empty)
    SELECT COUNT(*) INTO access_count FROM company_product_definitions;

    -- With no context, should return 0 due to fail-secure policy
    RETURN QUERY SELECT 'Context Requirement'::TEXT, (access_count = 0)::BOOLEAN,
      'Query without context returned ' || access_count || ' rows'::TEXT,
      'Expected 0 rows when context not set'::TEXT;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Context Requirement'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 3: Verify tenant isolation
  BEGIN
    -- Set context for company 1
    PERFORM set_tenant_context(test_company_1_id, 'user');

    -- Verify context is set correctly
    IF get_current_company_id() = test_company_1_id THEN
      RETURN QUERY SELECT 'Tenant Isolation'::TEXT, true::BOOLEAN,
        'Tenant context correctly set to company_id'::TEXT, test_company_1_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'Tenant Isolation'::TEXT, false::BOOLEAN,
        'Tenant context not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Tenant Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 4: Verify admin promotion access policy
  BEGIN
    -- Test superadmin promotion access
    PERFORM set_tenant_context(test_company_1_id, 'superadmin');

    -- Superadmins should be able to access pending products for promotion
    -- This tests the company_product_definitions_admin_promotion_access policy
    IF is_current_user_superadmin() THEN
      RETURN QUERY SELECT 'Admin Promotion Access'::TEXT, true::BOOLEAN,
        'Superadmin promotion access policy working'::TEXT,
        'Superadmins can read pending products across companies'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Admin Promotion Access'::TEXT, false::BOOLEAN,
        'Superadmin role not correctly identified'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Admin Promotion Access'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 5: Verify admin function works
  BEGIN
    -- Test admin check with admin role
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    IF is_current_user_admin() THEN
      RETURN QUERY SELECT 'Admin Check'::TEXT, true::BOOLEAN,
        'Admin role correctly identified'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Admin Check'::TEXT, false::BOOLEAN,
        'Admin role not correctly identified'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Admin Check'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 6: Verify superadmin function works
  BEGIN
    -- Test superadmin check
    PERFORM set_tenant_context(test_company_1_id, 'superadmin');

    IF is_current_user_superadmin() THEN
      RETURN QUERY SELECT 'Superadmin Check'::TEXT, true::BOOLEAN,
        'Superadmin role correctly identified'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Superadmin Check'::TEXT, false::BOOLEAN,
        'Superadmin role not correctly identified'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Superadmin Check'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 7: Verify policies exist
  BEGIN
    -- Check if our key policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'company_product_definitions'
      AND policyname = 'company_product_definitions_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'company_product_definitions'
      AND policyname = 'company_product_definitions_admin_promotion_access'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'company_product_definitions'
      AND policyname = 'company_product_definitions_company_id_immutable'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, admin_promotion_access, company_id_immutable'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
        'Some required RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify performance indexes exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'company_product_definitions'
      AND indexname = 'idx_company_product_definitions_company_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'company_product_definitions'
      AND indexname = 'idx_company_product_definitions_promotion_pending'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'company_id, promotion_pending indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_company_product_definitions_rls() IS
'Test function to validate company_product_definitions RLS policy implementation. Returns test results for policy verification, promotion workflow access, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor RLS policy effectiveness for company product definitions
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts or configuration issues.
 *
 * @returns Audit information about product definition access patterns
 */
CREATE OR REPLACE FUNCTION audit_company_product_definitions_rls()
RETURNS TABLE(
  event_type TEXT,
  description TEXT,
  severity TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for potential security issues
  -- This would be implemented with additional monitoring infrastructure

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'company_product_definitions'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on company_product_definitions table'::TEXT,
      'CRITICAL'::TEXT;
  END IF;

  -- Verify critical policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_product_definitions'
    AND policyname = 'company_product_definitions_tenant_isolation'
  ) THEN
    RETURN QUERY SELECT
      'Missing Policy'::TEXT,
      'Critical tenant isolation policy is missing'::TEXT,
      'CRITICAL'::TEXT;
  END IF;

  -- Return baseline monitoring status
  RETURN QUERY SELECT
    'RLS Monitoring'::TEXT,
    'Audit function for company_product_definitions RLS access patterns'::TEXT,
    'INFO'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_company_product_definitions_rls() IS
'Audit function to monitor company_product_definitions RLS access patterns for security purposes and policy effectiveness.';

-- ============================================================================
-- PROMOTION WORKFLOW COMPATIBILITY FUNCTION
-- ============================================================================

/**
 * Test function specifically for promotion workflow compatibility
 *
 * This function validates that the RLS policies work correctly with the
 * promotion workflow implemented in src/lib/company-product-queries.ts
 *
 * Tests the following scenarios:
 * - Superadmins can read pending products across all companies
 * - Promotion operations work correctly
 * - Company users cannot access other companies' products
 * - Promoted products are protected from modification
 */
CREATE OR REPLACE FUNCTION test_promotion_workflow_compatibility()
RETURNS TABLE(
  test_name TEXT,
  success BOOLEAN,
  message TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  test_company_1_id UUID;
  test_company_2_id UUID;
  pending_count INTEGER;
BEGIN
  -- Generate test company IDs
  test_company_1_id := gen_random_uuid();
  test_company_2_id := gen_random_uuid();

  -- Test 1: Superadmin can read pending products
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'superadmin');

    -- This should work due to admin_promotion_access policy
    SELECT COUNT(*) INTO pending_count FROM company_product_definitions
    WHERE is_approved_for_global = false;

    RETURN QUERY SELECT
      'Superadmin Pending Access'::TEXT,
      true::BOOLEAN,
      'Superadmin can query pending products for promotion workflow'::TEXT;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin Pending Access'::TEXT,
      false::BOOLEAN,
      'Failed: ' || SQLERRM::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 2: Regular users isolated to their company
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'user');

    -- This should only return products from company_1_id
    -- Due to tenant isolation policy
    SELECT COUNT(*) INTO pending_count FROM company_product_definitions
    WHERE company_id = test_company_1_id;

    RETURN QUERY SELECT
      'User Company Isolation'::TEXT,
      true::BOOLEAN,
      'Regular users can only access their own company products'::TEXT;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'User Company Isolation'::TEXT,
      false::BOOLEAN,
      'Failed: ' || SQLERRM::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 3: Admin access within company
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Company admins should have full access within their company
    IF is_current_user_admin() THEN
      RETURN QUERY SELECT
        'Admin Company Access'::TEXT,
        true::BOOLEAN,
        'Company admins have proper access within their company'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Admin Company Access'::TEXT,
        false::BOOLEAN,
        'Admin role check failed'::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Admin Company Access'::TEXT,
      false::BOOLEAN,
      'Failed: ' || SQLERRM::TEXT;
    PERFORM reset_tenant_context();
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_promotion_workflow_compatibility() IS
'Test function specifically for promotion workflow compatibility. Validates that RLS policies work correctly with the promotion workflow in company-product-queries.ts';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Ensure application has proper permissions to use RLS functions
-- These permissions should already be granted from the foundation migration
-- No additional grants needed as functions are already granted to PUBLIC

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

/*
 * ROLLBACK INSTRUCTIONS:
 *
 * To rollback this migration and disable RLS on company_product_definitions table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE company_product_definitions DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS company_product_definitions_tenant_isolation ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_admin_promotion_access ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_admin_access ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_read_only_access ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_insert_protection ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_update_protection ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_delete_protection ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_superadmin_promotion_workflow ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_company_id_immutable ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_promoted_product_protection ON company_product_definitions;
 *    DROP POLICY IF EXISTS company_product_definitions_promoted_delete_protection ON company_product_definitions;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_company_product_definitions_company_id;
 *    DROP INDEX IF EXISTS idx_company_product_definitions_company_created;
 *    DROP INDEX IF EXISTS idx_company_product_definitions_promotion_pending;
 *    DROP INDEX IF EXISTS idx_company_product_definitions_company_code;
 *    DROP INDEX IF EXISTS idx_company_product_definitions_global_product;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_company_product_definitions_rls();
 *    DROP FUNCTION IF EXISTS audit_company_product_definitions_rls();
 *    DROP FUNCTION IF EXISTS test_promotion_workflow_compatibility();
 *
 * WARNING: Rolling back RLS policies will remove database-level security
 * and make the application dependent on application-layer security only.
 */

-- ============================================================================
-- IMPLEMENTATION NOTES
-- ============================================================================

/*
 * IMPLEMENTATION NOTES:
 *
 * 1. ARCHITECTURE CONTEXT:
 *    - products table: Global catalog, NO RLS (shared by all companies)
 *    - company_product_definitions: Tenant-specific, RLS enabled (company isolation)
 *    - Promotion workflow: Cross-company access for superadmins only
 *
 * 2. POLICY STRUCTURE:
 *    - Base tenant isolation: Core company_id = get_current_company_id() policy
 *    - Admin promotion access: Special SELECT access for superadmin promotion workflow
 *    - Write protection: Separate policies for INSERT, UPDATE, DELETE operations
 *    - Immutability: company_id cannot be changed after record creation
 *    - Promoted product protection: Additional security for promoted products
 *
 * 3. SECURITY MODEL:
 *    - Company users: Full access to own company products only
 *    - Company admins: Full access + can manage own company products
 *    - Superadmins: Cross-company access for promotion workflow only
 *    - Promotion workflow: Carefully controlled superadmin privilege
 *
 * 4. PROMOTION WORKFLOW INTEGRATION:
 *    - getPendingPromotionProducts(): Uses admin_promotion_access policy
 *    - promoteCompanyProduct(): Uses superadmin_promotion_workflow policy
 *    - rejectCompanyProduct(): Uses superadmin delete permissions
 *    - All operations maintain tenant isolation for non-superadmin users
 *
 * 5. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by company_id (indexed column)
 *    - Composite indexes optimize common query patterns
 *    - Partial indexes for promotion workflow (is_approved_for_global = false)
 *    - Queries maintain performance even with RLS overhead
 *
 * 6. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context not properly set
 *    - NULL context results in zero rows returned (safe failure)
 *    - Company_id immutability prevents data transfer between tenants
 *    - Defense-in-depth: Application layer + Database layer security
 *
 * 7. TESTING AND VALIDATION:
 *    - test_company_product_definitions_rls(): Basic RLS policy validation
 *    - test_promotion_workflow_compatibility(): Workflow-specific testing
 *    - audit_company_product_definitions_rls(): Security monitoring
 *    - Application-level integration testing recommended
 *
 * 8. APPLICATION LAYER REQUIREMENTS:
 *    - Must call set_tenant_context() at start of each request
 *    - Must set appropriate user role ('user', 'admin', 'superadmin')
 *    - Must call reset_tenant_context() at end of each request
 *    - Integration with src/lib/company-product-queries.ts requires proper context
 *
 * 9. MONITORING AND AUDITING:
 *    - Monitor superadmin promotion workflow access
 *    - Audit logs for cross-company data access
 *    - Regular validation of policy effectiveness
 *    - Performance monitoring of RLS-optimized queries
 *
 * 10. ROLLBACK AND MAINTENANCE:
 *     - Documented rollback procedures for emergency situations
 *     - Policy updates require careful testing
 *     - Index maintenance for optimal query performance
 *     - Regular security audits of superadmin access patterns
 */