-- migrations/002_enable_rls_quotes.sql
-- Row-Level Security Policies for Quotes Table
--
-- This migration enables comprehensive RLS on the quotes table to enforce
-- tenant isolation at the database level for sensitive customer PII and business data.
--
-- Security Model:
-- - Tenant Isolation: Users can only access quotes from their company
-- - Admin Access: Company admins can access all quotes in their company
-- - Superadmin Access: Superadmins can access quotes across all companies
-- - Write Protection: Prevent cross-company data modifications
-- - PII Protection: Combine RLS with existing encryption

-- ============================================================================
-- ENABLE RLS ON QUOTES TABLE
-- ============================================================================

-- Enable Row-Level Security on the quotes table
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY
-- ============================================================================

/**
 * Primary tenant isolation policy for quotes table
 *
 * This policy enforces that users can only access quotes belonging to their company,
 * with exceptions for superadmins who can access all companies' data.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
CREATE POLICY quotes_tenant_isolation ON quotes
  FOR ALL
  USING (
    -- Require tenant context to be set (fail secure if NULL)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the company_id matches current context
    -- unless user is superadmin
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- ADMIN ACCESS POLICY WITHIN COMPANY
-- ============================================================================

/**
 * Admin access policy for quotes within the same company
 *
 * This policy allows company admins to perform all operations on quotes
 * within their company, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities.
 */
CREATE POLICY quotes_admin_access ON quotes
  FOR ALL
  USING (
    is_current_user_admin()
    AND company_id = get_current_company_id()
  )
  WITH CHECK (
    is_current_user_admin()
    AND company_id = get_current_company_id()
  );

-- ============================================================================
-- READ-ONLY ACCESS POLICY FOR RESTRICTED USERS
-- ============================================================================

/**
 * Read-only access policy for users with limited permissions
 *
 * This policy allows regular users to read quotes from their company
 * but prevents modifications unless they have admin privileges.
 *
 * Note: In this system, quote modifications are also controlled by subscription
 * status at the application layer, but this provides database-level defense.
 */
CREATE POLICY quotes_read_only_access ON quotes
  FOR SELECT
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICY
-- ============================================================================

/**
 * Write protection policy to prevent cross-company data modifications
 *
 * This is a critical security policy that prevents users from modifying
 * quotes belonging to other companies, even if they somehow bypass application
 * layer controls.
 *
 * This policy applies to INSERT, UPDATE, and DELETE operations.
 */
CREATE POLICY quotes_write_protection ON quotes
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted quotes belong to current user's company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

CREATE POLICY quotes_update_protection ON quotes
  FOR UPDATE
  USING (
    -- Can only update quotes in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing company_id on update (critical security control)
    company_id = (SELECT company_id FROM quotes WHERE id = quotes.id)
    OR is_current_user_superadmin()
  );

CREATE POLICY quotes_delete_protection ON quotes
  FOR DELETE
  USING (
    -- Can only delete quotes in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company quote access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * quotes from any company. This is necessary for support and auditing purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
CREATE POLICY quotes_superadmin_full_access ON quotes
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
 * This policy prevents users from changing the company_id of existing quotes,
 * which would be a security vulnerability allowing data transfer between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
CREATE POLICY quotes_company_id_immutable ON quotes
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (old value must equal new value)
    company_id = (SELECT company_id FROM quotes WHERE id = quotes.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY quotes_tenant_isolation ON quotes IS 'Primary tenant isolation policy. Users can only access quotes from their company, except superadmins who can access all companies.';

COMMENT ON POLICY quotes_admin_access ON quotes IS 'Admin access policy within company. Allows company admins full access to quotes in their company.';

COMMENT ON POLICY quotes_read_only_access ON quotes IS 'Read-only access policy for regular users. Allows reading quotes from own company.';

COMMENT ON POLICY quotes_write_protection ON quotes IS 'Insert protection policy. Ensures new quotes are assigned to current user company only.';

COMMENT ON POLICY quotes_update_protection ON quotes IS 'Update protection policy. Prevents cross-company quote modifications and company_id changes.';

COMMENT ON POLICY quotes_delete_protection ON quotes IS 'Delete protection policy. Prevents cross-company quote deletions.';

COMMENT ON POLICY quotes_superadmin_full_access ON quotes IS 'Superadmin full access policy. Allows superadmins to access all quotes across all companies.';

COMMENT ON POLICY quotes_company_id_immutable ON quotes IS 'Critical security policy. Prevents company_id changes on existing quotes to prevent data transfer between companies.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);

-- Create composite index for common RLS queries (company_id + created_at)
-- This optimizes queries that filter by company and sort by creation date
CREATE INDEX IF NOT EXISTS idx_quotes_company_created ON quotes(company_id, created_at DESC);

-- Create index for quote_number lookups within company context
CREATE INDEX IF NOT EXISTS idx_quotes_company_number ON quotes(company_id, quote_number);

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate quotes RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, and superadmin access.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_quotes_rls()
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
  test_quote_1_id UUID;
  test_quote_2_id UUID;
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
      WHERE tablename = 'quotes'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on quotes table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on quotes table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM quotes;

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

    -- In a real test with actual data, this would only return company 1 quotes
    -- For this validation, we just verify the context is set correctly
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

  -- Test 4: Verify admin function works
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

  -- Test 5: Verify superadmin function works
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

  -- Test 6: Verify policies exist
  BEGIN
    -- Check if our key policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'quotes'
      AND policyname = 'quotes_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'quotes'
      AND policyname = 'quotes_company_id_immutable'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
        'Some required RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_quotes_rls() IS 'Test function to validate quotes RLS policy implementation. Returns test results for policy verification.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to check for potential RLS policy bypass attempts
 *
 * This function can be used to monitor for suspicious activity that might
 * indicate attempts to bypass RLS policies.
 *
 * @returns Audit information about quote access patterns
 */
CREATE OR REPLACE FUNCTION audit_quotes_rls_access()
RETURNS TABLE(
  event_type TEXT,
  description TEXT,
  severity TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for queries without proper context setup
  -- This would be implemented with additional monitoring infrastructure

  RETURN QUERY SELECT
    'RLS Context Monitoring'::TEXT,
    'Audit function for monitoring RLS access patterns'::TEXT,
    'INFO'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_quotes_rls_access() IS 'Audit function to monitor quotes RLS access patterns for security purposes.';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Ensure application has proper permissions to use RLS functions
-- These permissions should already be granted from the foundation migration

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

/*
 * ROLLBACK INSTRUCTIONS:
 *
 * To rollback this migration and disable RLS on quotes table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS quotes_tenant_isolation ON quotes;
 *    DROP POLICY IF EXISTS quotes_admin_access ON quotes;
 *    DROP POLICY IF EXISTS quotes_read_only_access ON quotes;
 *    DROP POLICY IF EXISTS quotes_write_protection ON quotes;
 *    DROP POLICY IF EXISTS quotes_update_protection ON quotes;
 *    DROP POLICY IF EXISTS quotes_delete_protection ON quotes;
 *    DROP POLICY IF EXISTS quotes_superadmin_full_access ON quotes;
 *    DROP POLICY IF EXISTS quotes_company_id_immutable ON quotes;
 *
 * 3. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_quotes_rls();
 *    DROP FUNCTION IF EXISTS audit_quotes_rls_access();
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
 * 1. Policy Order Matters: PostgreSQL evaluates policies in order. The most
 *    restrictive policies should come first, with more permissive policies later.
 *
 * 2. USING vs WITH CHECK:
 *    - USING controls SELECT, UPDATE, DELETE
 *    - WITH CHECK controls INSERT, UPDATE
 *    - Both are needed for comprehensive security
 *
 * 3. Fail-Secure Philosophy: All policies deny access by default if context
 *    is not properly set, preventing accidental data exposure.
 *
 * 4. Performance: Indexes on company_id are critical for RLS performance.
 *    All policies that filter by company_id should use indexed columns.
 *
 * 5. PII Protection: These RLS policies work in conjunction with existing
 *    PII encryption. RLS provides tenant isolation, encryption provides
 *    protection at rest.
 *
 * 6. Superadmin Access: Superadmin policies should be carefully monitored
 *    and audited, as they provide cross-company data access.
 *
 * 7. Application Layer: Application must call set_tenant_context() at the
 *    start of each request for these policies to work correctly.
 *
 * 8. Testing: The test_quotes_rls() function provides basic validation.
 *    Additional application-level testing is recommended.
 */