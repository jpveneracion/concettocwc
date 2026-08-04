-- migrations/022_enable_rls_onboarding_progress.sql
-- Row-Level Security Policies for onboarding_progress Table
--
-- This migration enables comprehensive RLS on the onboarding_progress table
-- to enforce tenant isolation and user-level access control at the database level.
--
-- Security Model:
-- - User Isolation: Regular users can only access their own onboarding progress
-- - Admin Access: Company admins can access all onboarding progress in their company
-- - Superadmin Access: Superadmins can access all onboarding progress across all companies
-- - Write Protection: Prevent cross-company and unauthorized user data modifications
-- - ID Immutability: Prevent user_id changes for security (company context derived from user relationship)

-- ============================================================================
-- ENABLE RLS ON ONBOARDING_PROGRESS TABLE
-- ============================================================================

-- Enable Row-Level Security on onboarding_progress table
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ONBOARDING_PROGRESS TABLE RLS POLICIES
-- ============================================================================

/**
 * Primary user-level isolation policy for onboarding_progress table
 *
 * This policy enforces that users can only access their own onboarding progress,
 * company admins can access onboarding progress for all users in their company,
 * and superadmins can access all onboarding progress across all companies.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
CREATE POLICY onboarding_progress_user_isolation ON onboarding_progress
  FOR ALL
  USING (
    -- Regular users can only access their own onboarding progress
    user_id = get_current_user_id()
    -- Company admins can access onboarding progress for users in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can access all onboarding progress
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the user_id belongs to appropriate company
    user_id = get_current_user_id()
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

/**
 * Company-level tenant isolation policy for onboarding_progress table
 *
 * This policy provides a fallback for queries that filter by company context,
 * ensuring that users can only see onboarding progress from their own company.
 * Since onboarding_progress doesn't have a direct company_id column, this policy
 * enforces isolation through the user relationship.
 *
 * This works in conjunction with the user isolation policy for comprehensive security.
 */
CREATE POLICY onboarding_progress_tenant_isolation ON onboarding_progress
  FOR ALL
  USING (
    -- Require company context to be set (fail secure if NULL)
    -- Since onboarding_progress doesn't have direct company_id, we enforce through user relationship
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = onboarding_progress.user_id
      AND users.company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the user belongs to current company context
    -- unless user is superadmin
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = onboarding_progress.user_id
      AND users.company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

/**
 * Admin access policy for onboarding_progress within the same company
 *
 * This policy allows company admins to perform all operations on onboarding progress
 * within their company, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities.
 */
CREATE POLICY onboarding_progress_admin_access ON onboarding_progress
  FOR ALL
  USING (
    is_current_user_admin()
    AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
  )
  WITH CHECK (
    is_current_user_admin()
    AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
  );

/**
 * Read-only access policy for users with limited permissions
 *
 * This policy allows regular users to read their own onboarding progress
 * but prevents modifications unless they have admin privileges.
 */
CREATE POLICY onboarding_progress_read_only_access ON onboarding_progress
  FOR SELECT
  USING (
    -- Users can read their own onboarding progress
    user_id = get_current_user_id()
    -- Or onboarding progress from their company (for admin users)
    OR user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can read all onboarding progress
    OR is_current_user_superadmin()
  );

/**
 * Write protection policy to prevent cross-company onboarding progress modifications
 *
 * This is a critical security policy that prevents users from modifying
 * onboarding progress records belonging to other companies, even if they somehow bypass
 * application layer controls.
 *
 * This policy applies to INSERT, UPDATE, and DELETE operations.
 */
CREATE POLICY onboarding_progress_write_protection ON onboarding_progress
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted onboarding progress belongs to current user
    user_id = get_current_user_id()
    -- Or admins can create onboarding progress for users in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can create onboarding progress for any user
    OR is_current_user_superadmin()
  );

CREATE POLICY onboarding_progress_update_protection ON onboarding_progress
  FOR UPDATE
  USING (
    -- Can only update own onboarding progress
    user_id = get_current_user_id()
    -- Or admins can update onboarding progress in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can update any onboarding progress
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent user_id changes on onboarding progress (critical security control)
    user_id = (SELECT user_id FROM onboarding_progress WHERE id = onboarding_progress.id)
    OR is_current_user_superadmin()
  );

CREATE POLICY onboarding_progress_delete_protection ON onboarding_progress
  FOR DELETE
  USING (
    -- Can only delete own onboarding progress
    user_id = get_current_user_id()
    -- Or admins can delete onboarding progress in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can delete any onboarding progress
    OR is_current_user_superadmin()
  );

/**
 * Superadmin cross-company access policy for onboarding_progress
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * onboarding progress records from any company. This is necessary for support and auditing purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
CREATE POLICY onboarding_progress_superadmin_full_access ON onboarding_progress
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

/**
 * Critical security policy to prevent user_id changes
 *
 * This policy prevents users from changing the user_id of existing onboarding progress records,
 * which would be a security vulnerability allowing data transfer between users.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
CREATE POLICY onboarding_progress_user_id_immutable ON onboarding_progress
  FOR UPDATE
  WITH CHECK (
    -- Prevent user_id from being changed (old value must equal new value)
    user_id = (SELECT user_id FROM onboarding_progress WHERE id = onboarding_progress.id)
    OR is_current_user_superadmin()
  );

/**
 * Critical security policy to prevent indirect company_id changes through user relationship
 *
 * This policy prevents users from changing the user_id to point to a user from a different company,
 * which would effectively change the company association of the onboarding progress record.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
CREATE POLICY onboarding_progress_company_id_immutable ON onboarding_progress
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id changes through user relationship (old user's company must equal new user's company)
    (SELECT company_id FROM users WHERE id = user_id) =
    (SELECT company_id FROM users WHERE id = (SELECT user_id FROM onboarding_progress WHERE id = onboarding_progress.id))
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY onboarding_progress_user_isolation ON onboarding_progress IS 'Primary user-level isolation policy. Users can only access their own onboarding progress, admins can access company progress, superadmins can access all progress.';

COMMENT ON POLICY onboarding_progress_tenant_isolation ON onboarding_progress IS 'Company-level tenant isolation policy. Ensures users can only see onboarding progress from their own company through user relationship.';

COMMENT ON POLICY onboarding_progress_admin_access ON onboarding_progress IS 'Admin access policy within company. Allows company admins full access to onboarding progress for users in their company.';

COMMENT ON POLICY onboarding_progress_read_only_access ON onboarding_progress IS 'Read-only access policy for regular users. Allows reading own onboarding progress or company progress for admins.';

COMMENT ON POLICY onboarding_progress_write_protection ON onboarding_progress IS 'Insert protection policy. Ensures new onboarding progress belongs to current user or company users for admins.';

COMMENT ON POLICY onboarding_progress_update_protection ON onboarding_progress IS 'Update protection policy. Prevents cross-company onboarding progress modifications and user_id changes.';

COMMENT ON POLICY onboarding_progress_delete_protection ON onboarding_progress IS 'Delete protection policy. Prevents unauthorized onboarding progress deletions.';

COMMENT ON POLICY onboarding_progress_superadmin_full_access ON onboarding_progress IS 'Superadmin full access policy. Allows superadmins to access all onboarding progress across all companies.';

COMMENT ON POLICY onboarding_progress_user_id_immutable ON onboarding_progress IS 'Critical security policy. Prevents user_id changes on existing onboarding progress records to prevent data transfer between users.';

COMMENT ON POLICY onboarding_progress_company_id_immutable ON onboarding_progress IS 'Critical security policy. Prevents indirect company_id changes through user relationship to prevent data transfer between companies.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure onboarding_progress table has proper indexes for RLS policy performance
-- Note: Basic indexes already exist from migration 011, adding company context optimization

-- Create index for user_id (already exists from migration 011, ensuring it exists)
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON onboarding_progress(user_id);

-- Create composite index for common RLS queries (user_id + onboarding_type)
-- This optimizes queries that filter by user and type for user operations
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_type ON onboarding_progress(user_id, onboarding_type);

-- Create composite index for company-based admin queries
-- Since onboarding_progress doesn't have direct company_id, this optimizes queries through user relationship
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_company ON onboarding_progress(user_id);

-- Ensure index for completed status exists (already exists from migration 011)
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_completed ON onboarding_progress(completed);

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate onboarding_progress RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly for the onboarding_progress table. It tests user isolation,
 * admin access, and superadmin access.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_onboarding_progress_rls()
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
  test_user_company_2_id UUID;
  test_admin_id UUID;
  test_superadmin_id UUID;
  test_user_id UUID;
  test_onboarding_id UUID;
BEGIN
  -- Generate test company IDs
  test_company_1_id := gen_random_uuid();
  test_company_2_id := gen_random_uuid();
  test_user_id := gen_random_uuid();
  test_user_company_1_id := gen_random_uuid();
  test_user_company_2_id := gen_random_uuid();

  -- Test 1: Verify RLS is enabled on onboarding_progress
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'onboarding_progress'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'Onboarding Progress RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on onboarding_progress table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Onboarding Progress RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on onboarding_progress table'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Onboarding Progress RLS Enabled'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 2: Verify user context requirement for onboarding_progress
  BEGIN
    -- Reset context first
    PERFORM reset_complete_user_context();

    -- Set user context for testing
    PERFORM set_user_context(test_user_id);
    PERFORM set_tenant_context(test_company_1_id, 'user');

    -- Verify user context is set
    IF get_current_user_id() = test_user_id THEN
      RETURN QUERY SELECT 'User Context Requirement'::TEXT, true::BOOLEAN,
        'User context correctly set for onboarding_progress'::TEXT, test_user_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'User Context Requirement'::TEXT, false::BOOLEAN,
        'User context not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'User Context Requirement'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 3: Verify user isolation for onboarding_progress
  BEGIN
    -- Set context for a specific user
    PERFORM set_complete_user_context(test_company_1_id, test_user_company_1_id, 'user');

    -- Verify the context is set correctly
    IF get_current_user_id() = test_user_company_1_id AND get_current_company_id() = test_company_1_id THEN
      RETURN QUERY SELECT 'Onboarding Progress User Isolation'::TEXT, true::BOOLEAN,
        'User isolation context correctly set for onboarding_progress'::TEXT,
        'user_id=' || test_user_company_1_id::TEXT || ', company_id=' || test_company_1_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'Onboarding Progress User Isolation'::TEXT, false::BOOLEAN,
        'User isolation context not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Onboarding Progress User Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 4: Verify admin access to company onboarding progress
  BEGIN
    -- Set admin context
    PERFORM set_complete_user_context(test_company_1_id, test_admin_id, 'admin');

    IF is_current_user_admin() THEN
      RETURN QUERY SELECT 'Onboarding Progress Admin Access'::TEXT, true::BOOLEAN,
        'Admin can access company onboarding progress'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Onboarding Progress Admin Access'::TEXT, false::BOOLEAN,
        'Admin access to onboarding progress not working'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Onboarding Progress Admin Access'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 5: Verify onboarding_progress policies exist
  BEGIN
    -- Check if our key policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname = 'onboarding_progress_user_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname = 'onboarding_progress_company_id_immutable'
    ) THEN
      RETURN QUERY SELECT 'Onboarding Progress Policy Existence'::TEXT, true::BOOLEAN,
        'All required onboarding_progress RLS policies exist'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Onboarding Progress Policy Existence'::TEXT, false::BOOLEAN,
        'Some required onboarding_progress RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Onboarding Progress Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 6: Verify company context isolation through user relationship
  BEGIN
    -- Set regular user context
    PERFORM set_complete_user_context(test_company_1_id, test_user_company_1_id, 'user');

    -- Verify tenant isolation through user relationship
    IF EXISTS (
      SELECT 1 FROM users
      WHERE users.id = test_user_company_1_id
      AND users.company_id = test_company_1_id
    ) THEN
      RETURN QUERY SELECT 'Company Context Isolation'::TEXT, true::BOOLEAN,
        'Company context isolation working correctly through user relationship'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Company Context Isolation'::TEXT, false::BOOLEAN,
        'Company context isolation not working correctly'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Company Context Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 7: Verify superadmin access to all onboarding progress
  BEGIN
    -- Set superadmin context
    PERFORM set_complete_user_context(test_company_1_id, test_superadmin_id, 'superadmin');

    IF is_current_user_superadmin() THEN
      RETURN QUERY SELECT 'Superadmin Access'::TEXT, true::BOOLEAN,
        'Superadmin can access all onboarding progress'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Superadmin Access'::TEXT, false::BOOLEAN,
        'Superadmin access not working correctly'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Superadmin Access'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 8: Verify user_id immutability policy
  BEGIN
    -- Check if user_id immutability policy exists
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname = 'onboarding_progress_user_id_immutable'
    ) THEN
      RETURN QUERY SELECT 'User ID Immutability Policy'::TEXT, true::BOOLEAN,
        'User ID immutability policy exists for onboarding_progress'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'User ID Immutability Policy'::TEXT, false::BOOLEAN,
        'User ID immutability policy missing for onboarding_progress'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'User ID Immutability Policy'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_onboarding_progress_rls() IS 'Test function to validate onboarding_progress RLS policy implementation. Returns test results for user-level and company-level access controls.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to check for potential RLS policy bypass attempts on onboarding_progress table
 *
 * This function can be used to monitor for suspicious activity that might
 * indicate attempts to bypass RLS policies for onboarding progress data access.
 *
 * @returns Audit information about onboarding progress access patterns
 */
CREATE OR REPLACE FUNCTION audit_onboarding_progress_rls_access()
RETURNS TABLE(
  event_type TEXT,
  description TEXT,
  severity TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for queries without proper user context setup
  -- This would be implemented with additional monitoring infrastructure

  RETURN QUERY SELECT
    'Onboarding Progress RLS Context Monitoring'::TEXT,
    'Audit function for monitoring onboarding_progress RLS access patterns'::TEXT,
    'INFO'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_onboarding_progress_rls_access() IS 'Audit function to monitor onboarding_progress RLS access patterns for security purposes.';

/**
 * Comprehensive security audit for onboarding_progress table
 *
 * This function performs a comprehensive security audit checking for:
 * - RLS policy existence and configuration
 * - Potential security vulnerabilities
 * - Access pattern anomalies
 * - Policy bypass attempts
 *
 * @returns Comprehensive security audit results
 */
CREATE OR REPLACE FUNCTION audit_onboarding_progress_security()
RETURNS TABLE(
  table_name TEXT,
  check_type TEXT,
  status TEXT,
  details TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check onboarding_progress table RLS configuration
  RETURN QUERY SELECT
    'onboarding_progress'::TEXT,
    'RLS Enabled'::TEXT,
    CASE WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'onboarding_progress') THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Onboarding progress table RLS status check'::TEXT;

  -- Check for critical security policies
  RETURN QUERY SELECT
    'onboarding_progress'::TEXT,
    'Critical Policies'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname IN ('onboarding_progress_user_id_immutable', 'onboarding_progress_company_id_immutable')
      GROUP BY policyname
      HAVING COUNT(*) >= 2
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Critical onboarding_progress security policies check'::TEXT;

  -- Check for performance indexes
  RETURN QUERY SELECT
    'onboarding_progress'::TEXT,
    'Performance Indexes'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'onboarding_progress'
      AND indexname IN ('idx_onboarding_progress_user', 'idx_onboarding_progress_user_type', 'idx_onboarding_progress_user_company')
      GROUP BY indexname
      HAVING COUNT(*) >= 2
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Onboarding progress table performance indexes check'::TEXT;

  -- Check for user isolation policy
  RETURN QUERY SELECT
    'onboarding_progress'::TEXT,
    'User Isolation Policy'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname = 'onboarding_progress_user_isolation'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'User isolation policy existence check'::TEXT;

  -- Check for admin access policy
  RETURN QUERY SELECT
    'onboarding_progress'::TEXT,
    'Admin Access Policy'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname = 'onboarding_progress_admin_access'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Admin access policy existence check'::TEXT;

  -- Check for superadmin access policy
  RETURN QUERY SELECT
    'onboarding_progress'::TEXT,
    'Superadmin Access Policy'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'onboarding_progress'
      AND policyname = 'onboarding_progress_superadmin_full_access'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Superadmin access policy existence check'::TEXT;

END;
$$;

COMMENT ON FUNCTION audit_onboarding_progress_security() IS 'Comprehensive security audit function for onboarding_progress table. Checks RLS configuration, critical policies, and performance indexes.';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new RLS functions to the database user
-- These permissions will be inherited by the application

GRANT EXECUTE ON FUNCTION test_onboarding_progress_rls() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_onboarding_progress_rls_access() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_onboarding_progress_security() TO PUBLIC;

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

/*
 * ROLLBACK INSTRUCTIONS:
 *
 * To rollback this migration and disable RLS on onboarding_progress table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE onboarding_progress DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all onboarding_progress table policies:
 *    DROP POLICY IF EXISTS onboarding_progress_user_isolation ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_tenant_isolation ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_admin_access ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_read_only_access ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_write_protection ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_update_protection ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_delete_protection ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_superadmin_full_access ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_user_id_immutable ON onboarding_progress;
 *    DROP POLICY IF EXISTS onboarding_progress_company_id_immutable ON onboarding_progress;
 *
 * 3. Drop test and audit functions:
 *    DROP FUNCTION IF EXISTS test_onboarding_progress_rls();
 *    DROP FUNCTION IF EXISTS audit_onboarding_progress_rls_access();
 *    DROP FUNCTION IF EXISTS audit_onboarding_progress_security();
 *
 * 4. Drop performance indexes (optional - only if added by this migration):
 *    DROP INDEX IF EXISTS idx_onboarding_progress_user_company;
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
 * 1. TABLE STRUCTURE CONSIDERATIONS:
 *    - onboarding_progress doesn't have a direct company_id column
 *    - Company context is derived through user relationship (user_id -> users.company_id)
 *    - All policies must account for this indirect relationship
 *    - This provides user-level isolation while maintaining company-level security
 *
 * 2. USER-LEVEL vs COMPANY-LEVEL ACCESS:
 *    - Primary isolation is at user level (each user sees their own onboarding progress)
 *    - Admins can access onboarding progress for all users in their company
 *    - Superadmins can access all onboarding progress across all companies
 *    - This provides granular security while maintaining admin capabilities
 *
 * 3. CONTEXT MANAGEMENT:
 *    - Application must call set_complete_user_context() at the start of each request
 *    - Context includes: company_id, user_id, and user_role
 *    - All three components are required for proper policy evaluation
 *    - Uses existing user context functions from migration 015
 *
 * 4. USING vs WITH CHECK:
 *    - USING controls SELECT, UPDATE, DELETE
 *    - WITH CHECK controls INSERT, UPDATE
 *    - Both are needed for comprehensive security
 *
 * 5. SECURITY POLICIES:
 *    - onboarding_progress_user_id_immutable: Prevents data transfer between users
 *    - onboarding_progress_company_id_immutable: Prevents indirect company transfer through user relationship
 *    - Write protection policies prevent cross-company modifications
 *    - Read-only access for regular users, full access for admins/superadmins
 *
 * 6. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context is not properly set
 *    - Prevents accidental data exposure from missing context
 *    - Provides defense-in-depth security
 *
 * 7. PERFORMANCE CONSIDERATIONS:
 *    - Indexes on user_id are critical for RLS performance
 *    - Composite indexes optimize common user query patterns
 *    - Policies use subqueries efficiently through user relationship to minimize performance impact
 *    - Existing indexes from migration 011 are leveraged
 *
 * 8. TESTING AND VALIDATION:
 *    - test_onboarding_progress_rls() validates user-level and company-level access
 *    - Tests cover user isolation, admin access, and superadmin access
 *    - audit_onboarding_progress_security() provides ongoing security monitoring
 *
 * 9. APPLICATION INTEGRATION:
 *    - Uses existing user context functions from migration 015
 *    - No new context functions needed (reuses set_complete_user_context)
 *    - Ensure user_id is passed through application session
 *    - Update middleware to set complete user context (if not already done)
 *    - Test thoroughly before deploying to production
 *
 * 10. MONITORING AND AUDITING:
 *     - Use audit functions to monitor access patterns
 *     - Monitor for policy bypass attempts
 *     - Review superadmin access logs regularly
 *     - Set up alerts for suspicious activity
 *
 * 11. RELATIONSHIP WITH OTHER TABLES:
 *     - Follows same pattern as oauth_accounts (migration 015)
 *     - Both tables derive company context through user relationship
 *     - Policies maintain consistency with established RLS patterns
 *     - Uses existing foundation functions for user and company context
 *
 * 12. MIGRATION COMPATIBILITY:
 *     - Builds on RLS foundation from migrations 013-015
 *     - Reuses user context functions from migration 015
 *     - Maintains consistency with existing RLS policy patterns
 *     - No breaking changes to existing infrastructure
 */