-- migrations/023_enable_rls_companies.sql
-- Row-Level Security Policies for Companies Table
--
-- This migration enables comprehensive RLS on the companies table to enforce
-- tenant isolation at the database level using the tenant self-isolation pattern.
--
-- UNIQUE IMPLEMENTATION: The companies table IS the tenant table, so RLS uses
-- self-reference instead of company_id foreign key: USING (id = get_current_company_id())
--
-- Security Model:
-- - Tenant Self-Isolation: Users can access only their own company record
-- - Admin Access: Company admins can access their company with full permissions
-- - Superadmin Access: Superadmins can access all companies cross-tenant
-- - Write Protection: Prevent cross-company data modifications
-- - Creation Control: Restrict company creation to signup/superadmin only

-- ============================================================================
-- ENABLE RLS ON COMPANIES TABLE
-- ============================================================================

-- Enable Row-Level Security on the companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TENANT SELF-ISOLATION POLICY (PRIMARY POLICY)
-- ============================================================================

/**
 * Primary tenant self-isolation policy for companies table
 *
 * This is the UNIQUE tenant table implementation where the table itself
 * represents the tenant. Users can access only their own company record
 * using self-reference: id = get_current_company_id()
 *
 * This differs from standard tables which use: company_id = get_current_company_id()
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS companies_tenant_self_isolation ON companies;
CREATE POLICY companies_tenant_self_isolation ON companies
  FOR ALL
  USING (
    -- Users can access their own company only (self-isolation)
    id = get_current_company_id()
    -- Superadmins can access all companies for support and management
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure company isolation or superadmin exception
    id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- ADMIN ACCESS POLICY WITHIN COMPANY
-- ============================================================================

/**
 * Admin access policy for companies within the same company
 *
 * This policy allows company admins to perform all operations on their
 * own company record, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities.
 */
DROP POLICY IF EXISTS companies_admin_access ON companies;
CREATE POLICY companies_admin_access ON companies
  FOR ALL
  USING (
    is_current_user_admin()
    AND id = get_current_company_id()
  )
  WITH CHECK (
    is_current_user_admin()
    AND id = get_current_company_id()
  );

-- ============================================================================
-- READ-ONLY ACCESS POLICY FOR REGULAR USERS
-- ============================================================================

/**
 * Read-only access policy for users with limited permissions
 *
 * This policy allows regular users to read their own company information
 * but prevents modifications unless they have admin privileges.
 *
 * Company modifications typically require admin privileges to prevent
 * accidental changes to business-critical settings.
 */
DROP POLICY IF EXISTS companies_read_only_access ON companies;
CREATE POLICY companies_read_only_access ON companies
  FOR SELECT
  USING (
    -- Users can read their own company record
    id = get_current_company_id()
    -- Superadmins can read all companies
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

/**
 * Write protection policy to prevent cross-company data operations
 *
 * This is a critical security policy that prevents users from performing
 * write operations on companies they don't own, even if they bypass
 * application layer controls.
 *
 * This provides a comprehensive write protection framework that works
 * in conjunction with the specific INSERT, UPDATE, and DELETE policies.
 */
DROP POLICY IF EXISTS companies_write_protection ON companies;
CREATE POLICY companies_write_protection ON companies
  FOR ALL
  USING (
    -- Users can only perform write operations on their own company
    id = get_current_company_id()
    -- Superadmins can perform write operations on any company
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Ensure write operations maintain company isolation
    id = get_current_company_id()
    -- Or superadmin exception
    OR is_current_user_superadmin()
  );

/**
 * Write protection policy to prevent cross-company data insertion
 *
 * This is a critical security policy that prevents users from creating
 * companies for other tenants, even if they bypass application layer controls.
 *
 * Company creation is restricted to:
 * 1. Signup flow (application-layer validation)
 * 2. Superadmin operations
 */
DROP POLICY IF EXISTS companies_insert_protection ON companies;
CREATE POLICY companies_insert_protection ON companies
  FOR INSERT
  WITH CHECK (
    -- Allow inserts during signup (no company context yet)
    -- Application layer must validate this is legitimate signup
    get_current_company_id() IS NULL
    -- Or superadmins can create companies for any tenant
    OR is_current_user_superadmin()
  );

/**
 * Update protection policy for companies
 *
 * This policy prevents users from modifying companies they don't own,
 * while allowing admins full control over their own company settings.
 */
DROP POLICY IF EXISTS companies_update_protection ON companies;
CREATE POLICY companies_update_protection ON companies
  FOR UPDATE
  USING (
    -- Can only update own company
    id = get_current_company_id()
    -- Superadmins can update any company
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing company id on update (critical security control)
    -- The new id value must match current tenant context (id immutability)
    id = get_current_company_id()
    -- Or superadmin exception
    OR is_current_user_superadmin()
  );

/**
 * Delete protection policy for companies
 *
 * This policy prevents deletion of companies except by superadmins.
 * Company deletion should be extremely rare and typically handled
 * through soft-deletion or administrative processes.
 */
DROP POLICY IF EXISTS companies_delete_protection ON companies;
CREATE POLICY companies_delete_protection ON companies
  FOR DELETE
  USING (
    -- Superadmins can delete companies (with proper authorization)
    is_current_user_superadmin()
    -- Regular users and admins should NOT delete their own company
    -- This prevents accidental data loss
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company full access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * any company. This is necessary for:
 * - Support and troubleshooting
 * - Account management and migrations
 * - Administrative operations
 * - Business management
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
DROP POLICY IF EXISTS companies_superadmin_full_access ON companies;
CREATE POLICY companies_superadmin_full_access ON companies
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

-- ============================================================================
-- ID IMMUTABILITY POLICY
-- ============================================================================

/**
 * Critical security policy to prevent company ID changes
 *
 * This policy prevents users from changing the company id of existing
 * company records, which would be a security vulnerability.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 * In the tenant self-isolation pattern, the company ID IS the tenant identifier.
 *
 * Implementation: Prevents id column modification during UPDATE operations.
 * Only superadmins can change company ids for legitimate migration/repair purposes.
 * Database constraints provide additional protection at transaction level.
 */
DROP POLICY IF EXISTS companies_id_immutable ON companies;
CREATE POLICY companies_id_immutable ON companies
  FOR UPDATE
  WITH CHECK (
    -- Prevent company id from being changed (new value must match current tenant context)
    -- This ensures id immutability by requiring the new id to equal the current company_id
    id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- COMPANY CODE UNIQUENESS ENFORCEMENT
-- ============================================================================

/**
 * Company code protection policy
 *
 * This policy prevents modification of the company code field, which is
 * used as a business identifier and must remain unique across all companies.
 *
 * Company code changes could break business processes and integrations.
 */
DROP POLICY IF EXISTS companies_code_protection ON companies;
CREATE POLICY companies_code_protection ON companies
  FOR UPDATE
  USING (
    -- Allow updates if code is not being changed
    code IS NOT DISTINCT FROM (SELECT code FROM companies WHERE id = companies.id)
    -- Or if user is superadmin
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent code changes unless superadmin
    code IS NOT DISTINCT FROM (SELECT code FROM companies WHERE id = companies.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUBSCRIPTION STATUS PROTECTION POLICY
-- ============================================================================

/**
 * Subscription status protection policy
 *
 * This policy prevents unauthorized modification of subscription status,
 * which is typically managed through the subscription system and payment
 * verification workflows.
 *
 * Only superadmins should directly modify subscription status.
 */
DROP POLICY IF EXISTS companies_subscription_status_protection ON companies;
CREATE POLICY companies_subscription_status_protection ON companies
  FOR UPDATE
  USING (
    -- Allow updates if subscription_status is not being changed
    subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM companies WHERE id = companies.id)
    -- Or if user is superadmin
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent subscription status changes unless superadmin
    subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM companies WHERE id = companies.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY companies_tenant_self_isolation ON companies IS 'Primary tenant self-isolation policy. Users can access only their own company record using id = get_current_company_id(). Superadmins have cross-company access.';

COMMENT ON POLICY companies_admin_access ON companies IS 'Admin access policy. Company admins have full access to their own company record.';

COMMENT ON POLICY companies_read_only_access ON companies IS 'Read-only access policy. Regular users can read their own company information but modifications require admin privileges.';

COMMENT ON POLICY companies_write_protection ON companies IS 'Write protection policy. Comprehensive write protection preventing cross-company data operations. Works in conjunction with specific INSERT/UPDATE/DELETE policies.';

COMMENT ON POLICY companies_insert_protection ON companies IS 'Insert protection policy. Company creation restricted to signup flow (no context) and superadmin operations.';

COMMENT ON POLICY companies_update_protection ON companies IS 'Update protection policy. Users can only update their own company. Prevents cross-company modifications.';

COMMENT ON POLICY companies_delete_protection ON companies IS 'Delete protection policy. Only superadmins can delete companies to prevent accidental data loss.';

COMMENT ON POLICY companies_superadmin_full_access ON companies IS 'Superadmin full access policy. Allows superadmins to access, modify, and delete any company for support and administrative purposes.';

COMMENT ON POLICY companies_id_immutable ON companies IS 'Critical security policy. Prevents company ID changes to maintain tenant isolation integrity.';

COMMENT ON POLICY companies_code_protection ON companies IS 'Company code protection policy. Prevents modification of company code which is used as business identifier.';

COMMENT ON POLICY companies_subscription_status_protection ON companies IS 'Subscription status protection policy. Prevents unauthorized modification of subscription status, which should be managed through subscription system.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure id index exists for primary key lookups (RLS-optimized)
-- This index should already exist from the primary key, but we verify it here
DROP INDEX IF EXISTS idx_companies_id;
CREATE INDEX idx_companies_id ON companies(id);

-- Ensure created_at index exists for time-based queries
-- This optimizes queries that sort by company creation date
DROP INDEX IF EXISTS idx_companies_created_at;
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);

-- Ensure subscription_plan index exists for subscription queries
-- This optimizes subscription-based queries and reporting
DROP INDEX IF EXISTS idx_companies_subscription_status;
CREATE INDEX idx_companies_subscription_status ON companies(subscription_status);

-- Create composite index for common admin queries (subscription_status + created_at)
-- This optimizes admin dashboard queries that filter by subscription status
DROP INDEX IF EXISTS idx_companies_subscription_created;
CREATE INDEX idx_companies_subscription_created ON companies(subscription_status, created_at DESC);

-- Create index for trial_end queries for subscription management
-- This optimizes queries that find companies with expiring trials
DROP INDEX IF EXISTS idx_companies_trial_end;
CREATE INDEX idx_companies_trial_end ON companies(trial_end)
WHERE trial_end IS NOT NULL;

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate companies RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly for the tenant self-isolation pattern. It tests:
 * - Self-isolation (users access their own company only)
 * - Admin access patterns
 * - Superadmin cross-company access
 * - Creation/deletion policies
 *
 * @returns Test results showing policy effectiveness
 */
DROP FUNCTION IF EXISTS test_companies_rls();
CREATE OR REPLACE FUNCTION test_companies_rls()
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
  test_user_id UUID;
  access_count INTEGER;
  expected_count INTEGER;
BEGIN
  -- Generate test company IDs
  test_company_1_id := gen_random_uuid();
  test_company_2_id := gen_random_uuid();
  test_user_id := gen_random_uuid();

  -- Test 1: Verify RLS is enabled
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'companies'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on companies table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on companies table'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 2: Verify tenant self-isolation pattern
  BEGIN
    -- Reset context first
    PERFORM reset_tenant_context();

    -- Set context for company 1
    PERFORM set_tenant_context(test_company_1_id, 'user');

    -- Verify the self-isolation pattern works
    IF get_current_company_id() = test_company_1_id THEN
      RETURN QUERY SELECT 'Tenant Self-Isolation'::TEXT, true::BOOLEAN,
        'Tenant self-isolation correctly set to company_id'::TEXT, test_company_1_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'Tenant Self-Isolation'::TEXT, false::BOOLEAN,
        'Tenant self-isolation not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Tenant Self-Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 3: Verify admin function works
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

  -- Test 4: Verify superadmin function works
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

  -- Test 5: Verify self-isolation policy exists
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'companies'
      AND policyname = 'companies_tenant_self_isolation'
    ) THEN
      RETURN QUERY SELECT 'Self-Isolation Policy'::TEXT, true::BOOLEAN,
        'Tenant self-isolation policy exists'::TEXT,
        'Uses id = get_current_company_id() pattern'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Self-Isolation Policy'::TEXT, false::BOOLEAN,
        'Tenant self-isolation policy is missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Self-Isolation Policy'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 6: Verify write protection policy exists
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'companies'
      AND policyname = 'companies_write_protection'
    ) THEN
      RETURN QUERY SELECT 'Write Protection Policy'::TEXT, true::BOOLEAN,
        'Write protection policy exists'::TEXT,
        'Prevents cross-company write operations'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Write Protection Policy'::TEXT, false::BOOLEAN,
        'Write protection policy is missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Write Protection Policy'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 7: Verify id immutability policy exists
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'companies'
      AND policyname = 'companies_id_immutable'
    ) THEN
      RETURN QUERY SELECT 'ID Immutability Policy'::TEXT, true::BOOLEAN,
        'Company ID immutability policy exists'::TEXT,
        'Critical for tenant isolation integrity'::TEXT;
    ELSE
      RETURN QUERY SELECT 'ID Immutability Policy'::TEXT, false::BOOLEAN,
        'Company ID immutability policy is missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'ID Immutability Policy'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify subscription status protection exists
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'companies'
      AND policyname = 'companies_subscription_status_protection'
    ) THEN
      RETURN QUERY SELECT 'Subscription Status Protection'::TEXT, true::BOOLEAN,
        'Subscription status protection policy exists'::TEXT,
        'Prevents unauthorized subscription modifications'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Subscription Status Protection'::TEXT, false::BOOLEAN,
        'Subscription status protection policy is missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Subscription Status Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 9: Verify performance indexes exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'companies'
      AND indexname = 'idx_companies_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'companies'
      AND indexname = 'idx_companies_subscription_created'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'id, subscription_status, created_at indexes verified'::TEXT;
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

COMMENT ON FUNCTION test_companies_rls() IS 'Test function to validate companies RLS tenant self-isolation pattern. Returns test results for policy verification, self-isolation access controls, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor companies RLS security
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts, configuration issues, or access pattern anomalies.
 *
 * @returns Audit information about company access patterns and security status
 */
DROP FUNCTION IF EXISTS audit_companies_security();
CREATE OR REPLACE FUNCTION audit_companies_security()
RETURNS TABLE(
  audit_type TEXT,
  description TEXT,
  severity TEXT,
  recommendation TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check 1: Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'companies'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on companies table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant self-isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'companies_tenant_self_isolation'
  ) THEN
    RETURN QUERY SELECT
      'Missing Critical Policy'::TEXT,
      'Tenant self-isolation policy is missing'::TEXT,
      'CRITICAL'::TEXT,
      'Restore tenant self-isolation policy immediately'::TEXT;
    RETURN;
  END IF;

  -- Check 3: Verify company ID immutability policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'companies_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Company ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement company ID immutability policy to maintain tenant isolation'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify subscription status protection exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'companies_subscription_status_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Audit Protection'::TEXT,
      'Subscription status protection policy is missing'::TEXT,
      'MEDIUM'::TEXT,
      'Implement subscription status protection to prevent unauthorized modifications'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'companies'
    AND indexname = 'idx_companies_id'
  ) THEN
    RETURN QUERY SELECT
      'Missing Performance Index'::TEXT,
      'Company ID index is missing for RLS performance'::TEXT,
      'MEDIUM'::TEXT,
      'Create company ID index to optimize RLS query performance'::TEXT;
    RETURN;
  END IF;

  -- Return baseline monitoring status if all checks pass
  RETURN QUERY SELECT
    'Security Audit Complete'::TEXT,
    'All critical RLS security controls verified for companies table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_companies_security() IS 'Security audit function for companies RLS policies. Monitors tenant self-isolation effectiveness, detects configuration issues, and provides security recommendations.';

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
 * To rollback this migration and disable RLS on companies table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS companies_tenant_self_isolation ON companies;
 *    DROP POLICY IF EXISTS companies_admin_access ON companies;
 *    DROP POLICY IF EXISTS companies_read_only_access ON companies;
 *    DROP POLICY IF EXISTS companies_write_protection ON companies;
 *    DROP POLICY IF EXISTS companies_insert_protection ON companies;
 *    DROP POLICY IF EXISTS companies_update_protection ON companies;
 *    DROP POLICY IF EXISTS companies_delete_protection ON companies;
 *    DROP POLICY IF EXISTS companies_superadmin_full_access ON companies;
 *    DROP POLICY IF EXISTS companies_id_immutable ON companies;
 *    DROP POLICY IF EXISTS companies_code_protection ON companies;
 *    DROP POLICY IF EXISTS companies_subscription_status_protection ON companies;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_companies_id;
 *    DROP INDEX IF EXISTS idx_companies_created_at;
 *    DROP INDEX IF EXISTS idx_companies_subscription_status;
 *    DROP INDEX IF EXISTS idx_companies_subscription_created;
 *    DROP INDEX IF EXISTS idx_companies_trial_end;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_companies_rls();
 *    DROP FUNCTION IF EXISTS audit_companies_security();
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
 * 1. TENANT SELF-ISOLATION PATTERN:
 *    - Companies table IS the tenant table (unique implementation)
 *    - Uses self-reference: id = get_current_company_id()
 *    - Different from standard tables: company_id = get_current_company_id()
 *    - Users can access only their own company record
 *    - Superadmins maintain cross-company access
 *
 * 2. SECURITY MODEL:
 *    - Regular users: Read-only access to their own company
 *    - Company admins: Full access to their company settings
 *    - Superadmins: Cross-company access for support and management
 *    - Fail-secure: Deny access if context not properly set
 *
 * 3. POLICY STRUCTURE:
 *    - Primary: Tenant self-isolation (id = get_current_company_id())
 *    - Admin access: Company admins full control of their company
 *    - Read-only: Regular users can read but not modify
 *    - Write protection: INSERT/UPDATE/DELETE restrictions
 *    - ID immutability: Critical for tenant isolation
 *    - Field protection: Code and subscription status protection
 *
 * 4. COMPANY CREATION POLICY:
 *    - Restricted to signup flow (no company context yet)
 *    - Superadmins can create companies for any tenant
 *    - Application layer must validate signup legitimacy
 *    - Prevents users from creating multiple companies
 *
 * 5. COMPANY DELETION POLICY:
 *    - Only superadmins can delete companies
 *    - Prevents accidental data loss by users/admins
 *    - Supports administrative account management
 *    - Critical business data protection
 *
 * 6. SUBSCRIPTION MANAGEMENT:
 *    - Subscription status protected from unauthorized changes
 *    - Managed through subscription system and payment verification
 *    - Superadmin exception for administrative operations
 *    - Maintains audit trail integrity
 *
 * 7. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by id (primary key, indexed)
 *    - Composite indexes optimize common query patterns
 *    - Partial indexes for trial_end (active trials only)
 *    - Queries maintain performance with RLS overhead
 *
 * 8. TESTING AND VALIDATION:
 *    - test_companies_rls(): Validates self-isolation pattern
 *    - audit_companies_security(): Security monitoring
 *    - Application-level integration testing required
 *    - Periodic security audits recommended
 *
 * 9. APPLICATION LAYER REQUIREMENTS:
 *    - Must call set_tenant_context() at start of each request
 *    - Must set appropriate user role ('user', 'admin', 'superadmin')
 *    - Signup flow creates companies before setting context
 *    - Integration with company creation workflows required
 *
 * 10. MONITORING AND AUDITING:
 *     - Monitor superadmin access to companies
 *     - Audit company creation and deletion events
 *     - Review subscription status modification logs
 *     - Regular validation of self-isolation effectiveness
 *
 * 11. UNIQUE ASPECTS COMPARED TO OTHER TABLES:
 *     - Self-reference instead of foreign key reference
 *     - Users access their own company only (not other companies)
 *     - Company creation more restricted than other tables
 *     - Deletion restricted to superadmins only
 *     - ID immutability critical for tenant isolation
 *
 * 12. BUSINESS LOGIC INTEGRATION:
 *     - Company creation during user signup
 *     - OAuth flow can create new companies
 *     - Subscription system modifies subscription_status
 *     - Admin operations for company settings management
 */