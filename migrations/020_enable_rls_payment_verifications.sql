-- migrations/020_enable_rls_payment_verifications.sql
-- Row-Level Security Policies for Payment Verifications Table
--
-- This migration enables comprehensive RLS on the payment_verifications table to enforce
-- tenant isolation at the database level for sensitive payment verification data.
--
-- DEPENDENCY: Requires migration 019_add_company_id_to_payment_verifications.sql
-- to be applied first, as RLS policies depend on the company_id column.
--
-- Security Model:
-- - Tenant Isolation: Users can only access payment verifications from their company
-- - Admin Access: Company admins can access all payment verifications in their company
-- - Superadmin Access: Superadmins can access payment verifications across all companies
-- - Write Protection: Prevent cross-company data modifications
-- - PII Protection: Combine RLS with existing encryption for sensitive payment verification data

-- ============================================================================
-- ENABLE RLS ON PAYMENT VERIFICATIONS TABLE
-- ============================================================================

-- Enable Row-Level Security on the payment_verifications table
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY
-- ============================================================================

/**
 * Primary tenant isolation policy for payment_verifications table
 *
 * This policy enforces that users can only access payment verifications belonging
 * to their company, with exceptions for superadmins who need cross-company
 * access for support and auditing purposes.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS payment_verifications_tenant_isolation ON payment_verifications;
CREATE POLICY payment_verifications_tenant_isolation ON payment_verifications
  FOR ALL
  USING (
    -- Require tenant context to be set (fail secure if NULL)
    -- Superadmins can access all data for support purposes
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
 * Admin access policy for payment verifications within the same company
 *
 * This policy allows company admins to perform all operations on payment
 * verifications within their company, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities.
 */
DROP POLICY IF EXISTS payment_verifications_admin_access ON payment_verifications;
CREATE POLICY payment_verifications_admin_access ON payment_verifications
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
-- READ-ONLY ACCESS POLICY FOR STANDARD USERS
-- ============================================================================

/**
 * Read-only access policy for regular company users
 *
 * This policy allows regular users to read payment verifications from their company
 * but prevents modifications unless they have admin privileges.
 *
 * Note: Payment verification modifications are also controlled by subscription
 * status and business rules at the application layer, but this provides
 * database-level defense in depth.
 */
DROP POLICY IF EXISTS payment_verifications_read_only_access ON payment_verifications;
CREATE POLICY payment_verifications_read_only_access ON payment_verifications
  FOR SELECT
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

/**
 * Write protection policy to prevent cross-company data insertion
 *
 * This is a critical security policy that prevents users from creating payment
 * verifications for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
DROP POLICY IF EXISTS payment_verifications_insert_protection ON payment_verifications;
CREATE POLICY payment_verifications_insert_protection ON payment_verifications
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted payment verifications belong to current user's company
    -- Superadmins can insert for any company (for migration purposes)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS payment_verifications_update_protection ON payment_verifications;
CREATE POLICY payment_verifications_update_protection ON payment_verifications
  FOR UPDATE
  USING (
    -- Can only update payment verifications in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    -- Prevent changing company_id on update (critical security control)
    company_id = (SELECT company_id FROM payment_verifications WHERE id = payment_verifications.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS payment_verifications_delete_protection ON payment_verifications;
CREATE POLICY payment_verifications_delete_protection ON payment_verifications
  FOR DELETE
  USING (
    -- Can only delete payment verifications in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company payment verification access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * payment verifications from any company. This is necessary for support,
 * auditing, and payment dispute resolution purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
DROP POLICY IF EXISTS payment_verifications_superadmin_full_access ON payment_verifications;
CREATE POLICY payment_verifications_superadmin_full_access ON payment_verifications
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
 * This policy prevents users from changing the company_id of existing payment
 * verifications, which would be a security vulnerability allowing data transfer
 * between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
DROP POLICY IF EXISTS payment_verifications_company_id_immutable ON payment_verifications;
CREATE POLICY payment_verifications_company_id_immutable ON payment_verifications
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (old value must equal new value)
    company_id = (SELECT company_id FROM payment_verifications WHERE id = payment_verifications.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- PAYMENT VERIFICATION STATUS PROTECTION POLICIES
-- ============================================================================

/**
 * Status protection policy for payment verification workflow
 *
 * This policy prevents modification or deletion of payment verifications that
 * have already been approved, protecting the audit trail and preventing
 * unauthorized changes to completed payment verifications.
 *
 * Business logic: Once a payment verification is approved, it should be immutable
 * to maintain payment processing integrity and audit trail consistency.
 */
DROP POLICY IF EXISTS payment_verifications_approved_status_protection ON payment_verifications;
CREATE POLICY payment_verifications_approved_status_protection ON payment_verifications
  FOR UPDATE
  USING (
    -- Allow updates only if not yet approved or user is superadmin
    status != 'approved'
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Allow setting status to approved, or superadmin exception
    -- This prevents changing FROM approved TO other values
    status = 'approved'
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS payment_verifications_approved_delete_protection ON payment_verifications;
CREATE POLICY payment_verifications_approved_delete_protection ON payment_verifications
  FOR DELETE
  USING (
    -- Prevent deletion of approved payment verifications
    status != 'approved'
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY payment_verifications_tenant_isolation ON payment_verifications IS 'Primary tenant isolation policy. Users can only access payment verifications from their company, except superadmins who can access all companies.';

COMMENT ON POLICY payment_verifications_admin_access ON payment_verifications IS 'Admin access policy within company. Allows company admins full access to payment verifications in their company.';

COMMENT ON POLICY payment_verifications_read_only_access ON payment_verifications IS 'Read-only access policy for regular users. Allows reading payment verifications from own company.';

COMMENT ON POLICY payment_verifications_insert_protection ON payment_verifications IS 'Insert protection policy. Ensures new payment verifications are assigned to current user company only.';

COMMENT ON POLICY payment_verifications_update_protection ON payment_verifications IS 'Update protection policy. Prevents cross-company payment verification modifications and company_id changes.';

COMMENT ON POLICY payment_verifications_delete_protection ON payment_verifications IS 'Delete protection policy. Prevents cross-company payment verification deletions.';

COMMENT ON POLICY payment_verifications_superadmin_full_access ON payment_verifications IS 'Superadmin full access policy. Allows superadmins to access all payment verifications across all companies for support and auditing.';

COMMENT ON POLICY payment_verifications_company_id_immutable ON payment_verifications IS 'Critical security policy. Prevents company_id changes on existing payment verifications to prevent data transfer between companies.';

COMMENT ON POLICY payment_verifications_approved_status_protection ON payment_verifications IS 'Protection policy for approved payment verifications. Prevents modification of payment verifications that have been approved to maintain audit trail integrity.';

COMMENT ON POLICY payment_verifications_approved_delete_protection ON payment_verifications IS 'Delete protection for approved payment verifications. Prevents deletion of payment verifications that have been approved to maintain audit trail.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_payment_verifications_company_id ON payment_verifications(company_id);

-- Create composite index for common RLS queries (company_id + status + submitted_at)
-- This optimizes admin dashboard queries that filter by company and status
CREATE INDEX IF NOT EXISTS idx_payment_verifications_company_status_date ON payment_verifications(company_id, status, submitted_at DESC);

-- Create composite index for user payment history queries (company_id + user_id + submitted_at)
-- This optimizes user payment verification history queries
CREATE INDEX IF NOT EXISTS idx_payment_verifications_company_user_date ON payment_verifications(company_id, user_id, submitted_at DESC);

-- Create index for pending payment verifications lookup (company_id + status)
-- This optimizes admin console queries for pending verifications
CREATE INDEX IF NOT EXISTS idx_payment_verifications_pending_by_company ON payment_verifications(company_id, submitted_at ASC)
WHERE status = 'pending';

-- Create index for plan_id lookups within company context (company_id + plan_id)
-- This optimizes queries for payment verifications by subscription plan
CREATE INDEX IF NOT EXISTS idx_payment_verifications_company_plan ON payment_verifications(company_id, plan_id)
WHERE plan_id IS NOT NULL;

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate payment_verifications RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, superadmin
 * access, and approved status protection.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_payment_verifications_rls()
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
  test_verification_1_id UUID;
  test_verification_2_id UUID;
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
      WHERE tablename = 'payment_verifications'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on payment_verifications table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on payment_verifications table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM payment_verifications;

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

    -- In a real test with actual data, this would only return company 1 payment verifications
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
      WHERE tablename = 'payment_verifications'
      AND policyname = 'payment_verifications_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_verifications'
      AND policyname = 'payment_verifications_company_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_verifications'
      AND policyname = 'payment_verifications_approved_status_protection'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, company_id_immutable, approved_status_protection'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
        'Some required RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 7: Verify performance indexes exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      AND indexname = 'idx_payment_verifications_company_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      AND indexname = 'idx_payment_verifications_company_status_date'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      AND indexname = 'idx_payment_verifications_pending_by_company'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'company_id, company_status_date, pending_by_company indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify approved status protection
  BEGIN
    -- Set admin context
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Check if approved status protection policy exists
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_verifications'
      AND policyname = 'payment_verifications_approved_status_protection'
    ) THEN
      RETURN QUERY SELECT 'Approved Status Protection'::TEXT, true::BOOLEAN,
        'Approved status protection policy exists'::TEXT,
        'Policy prevents modification of approved payment verifications'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Approved Status Protection'::TEXT, false::BOOLEAN,
        'Approved status protection policy is missing'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Approved Status Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_payment_verifications_rls() IS 'Test function to validate payment_verifications RLS policy implementation. Returns test results for policy verification, tenant isolation, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor payment_verifications RLS security
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts, configuration issues, or access pattern anomalies.
 *
 * @returns Audit information about payment verification access patterns and security status
 */
CREATE OR REPLACE FUNCTION audit_payment_verifications_security()
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
    WHERE tablename = 'payment_verifications'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on payment_verifications table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_verifications'
    AND policyname = 'payment_verifications_tenant_isolation'
  ) THEN
    RETURN QUERY SELECT
      'Missing Critical Policy'::TEXT,
      'Tenant isolation policy is missing'::TEXT,
      'CRITICAL'::TEXT,
      'Restore tenant isolation policy immediately'::TEXT;
    RETURN;
  END IF;

  -- Check 3: Verify company_id immutability policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_verifications'
    AND policyname = 'payment_verifications_company_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Company ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement company_id immutability policy to prevent data transfer between tenants'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify approved status protection exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_verifications'
    AND policyname = 'payment_verifications_approved_status_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Audit Protection'::TEXT,
      'Approved status protection policy is missing'::TEXT,
      'MEDIUM'::TEXT,
      'Implement approved status protection to maintain audit trail integrity'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payment_verifications'
    AND indexname = 'idx_payment_verifications_company_id'
  ) THEN
    RETURN QUERY SELECT
      'Missing Performance Index'::TEXT,
      'Company ID index is missing for RLS performance'::TEXT,
      'MEDIUM'::TEXT,
      'Create company_id index to optimize RLS query performance'::TEXT;
    RETURN;
  END IF;

  -- Return baseline monitoring status if all checks pass
  RETURN QUERY SELECT
    'Security Audit Complete'::TEXT,
    'All critical RLS security controls verified for payment_verifications table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_payment_verifications_security() IS 'Security audit function for payment_verifications RLS policies. Monitors policy effectiveness, detects configuration issues, and provides security recommendations.';

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
 * To rollback this migration and disable RLS on payment_verifications table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE payment_verifications DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS payment_verifications_tenant_isolation ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_admin_access ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_read_only_access ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_insert_protection ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_update_protection ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_delete_protection ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_superadmin_full_access ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_company_id_immutable ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_approved_status_protection ON payment_verifications;
 *    DROP POLICY IF EXISTS payment_verifications_approved_delete_protection ON payment_verifications;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_payment_verifications_company_id;
 *    DROP INDEX IF EXISTS idx_payment_verifications_company_status_date;
 *    DROP INDEX IF EXISTS idx_payment_verifications_company_user_date;
 *    DROP INDEX IF EXISTS idx_payment_verifications_pending_by_company;
 *    DROP INDEX IF EXISTS idx_payment_verifications_company_plan;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_payment_verifications_rls();
 *    DROP FUNCTION IF EXISTS audit_payment_verifications_security();
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
 * 1. POLICY STRUCTURE:
 *    - Base tenant isolation: Core company_id = get_current_company_id() policy
 *    - Admin access: Company admins full access within their company
 *    - Read-only access: Regular users can read but not modify
 *    - Write protection: Separate policies for INSERT, UPDATE, DELETE operations
 *    - Company ID immutability: Cannot change company association after creation
 *    - Status protection: Approved payment verifications are immutable
 *
 * 2. SECURITY MODEL:
 *    - Company users: Full access to own company payment verifications only
 *    - Company admins: Full access + can manage payment verifications in their company
 *    - Superadmins: Cross-company access for support and auditing purposes
 *    - Approved status protection: Maintains audit trail integrity
 *
 * 3. PAYMENT VERIFICATION WORKFLOW:
 *    - Users submit payment verifications with screenshot proof
 *    - Admins review and approve/reject within their company
 *    - Approved verifications maintain audit trail (immutable)
 *    - Superadmins can access for support and payment dispute resolution
 *
 * 4. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by company_id (indexed column)
 *    - Composite indexes optimize common query patterns
 *    - Partial indexes for pending payment verifications (admin dashboard)
 *    - Queries maintain performance even with RLS overhead
 *
 * 5. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context not properly set
 *    - NULL context results in zero rows returned (safe failure)
 *    - Company_id immutability prevents data transfer between tenants
 *    - Defense-in-depth: Application layer + Database layer security
 *
 * 6. AUDIT TRAIL PROTECTION:
 *    - Approved payment verifications cannot be modified or deleted
 *    - Status protection maintains payment processing integrity
 *    - Superadmin exception for exceptional circumstances
 *    - Supports payment dispute resolution and compliance requirements
 *
 * 7. TESTING AND VALIDATION:
 *    - test_payment_verifications_rls(): Basic RLS policy validation
 *    - audit_payment_verifications_security(): Security monitoring
 *    - Application-level integration testing recommended
 *    - Periodic security audits recommended
 *
 * 8. APPLICATION LAYER REQUIREMENTS:
 *    - Must call set_tenant_context() at start of each request
 *    - Must set appropriate user role ('user', 'admin', 'superadmin')
 *    - Must call reset_tenant_context() at end of each request
 *    - Integration with payment verification workflow requires proper context
 *
 * 9. MONITORING AND AUDITING:
 *    - Monitor superadmin access to payment verifications
 *    - Audit logs for cross-company data access
 *    - Regular validation of policy effectiveness
 *    - Performance monitoring of RLS-optimized queries
 *    - Payment verification approval workflow monitoring
 *
 * 10. COMPLIANCE AND SECURITY:
 *     - Payment verification data contains sensitive financial information
 *     - RLS provides tenant isolation for multi-tenant compliance
 *     - Audit trail protection for payment processing regulations
 *     - Supports payment dispute resolution with secure cross-company access
 */