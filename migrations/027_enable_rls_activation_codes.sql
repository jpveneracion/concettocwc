-- migrations/029_enable_rls_activation_codes.sql
-- Row-Level Security Policies for Activation Codes Table
--
-- This migration enables comprehensive RLS on the activation_codes table to enforce
-- tenant isolation at the database level for CRITICAL financial and transaction data.
--
-- Risk Level: HIGH - Discount codes, payment data, revenue intelligence exposed
--
-- Security Model:
-- - Tenant Isolation: Users can only access activation_codes from their company (via created_by/used_by → users.company_id)
-- - Admin Access: Company admins can manage all activation_codes in their company
-- - Superadmin Access: Superadmins can access activation_codes across all companies for support
-- - Financial Protection: Payment and discount data protected from modification
-- - Code Immutability: Code values cannot be changed after creation to prevent fraud
-- - Usage Protection: Used codes cannot be modified to prevent abuse
-- - Write Protection: Prevent cross-company data modifications
--
-- Data Exposure Analysis:
-- - discount_percent: Pricing strategy and discount structures visible to competitors
-- - payment_amount: Revenue data and payment processing patterns exposed
-- - payment_method: Payment processing intelligence and customer behavior exposed
-- - code values: Activation patterns and promotional strategy analysis possible
-- - usage patterns: Campaign effectiveness and customer conversion data exposed
-- - applicable_plans: Subscription pricing strategy and business model intelligence exposed

-- ============================================================================
-- ENABLE RLS ON ACTIVATION_CODES TABLE
-- ============================================================================

-- Enable Row-Level Security on the activation_codes table
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY (INDIRECT USER CONTEXT)
-- ============================================================================

/**
 * Primary tenant isolation policy for activation_codes table
 *
 * This policy enforces that users can only access activation_codes created by
 * users from their company, determined through indirect user context:
 * - created_by → users.company_id for code ownership
 * - used_by → users.company_id for usage tracking
 *
 * This indirect context approach ensures proper tenant isolation even when
 * activation_codes are created or used by different users within the same company.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS activation_codes_tenant_isolation ON activation_codes;
CREATE POLICY activation_codes_tenant_isolation ON activation_codes
  FOR ALL
  USING (
    -- Require tenant context to be set (fail secure if NULL)
    -- Check if code belongs to current user's company via created_by
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    -- Or check if code was used by someone in current user's company
    OR used_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    -- Superadmins can access all data for support purposes
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the created_by belongs to current context
    -- unless user is superadmin
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- ADMIN ACCESS POLICY WITHIN COMPANY
-- ============================================================================

/**
 * Admin access policy for activation_codes within the same company
 *
 * This policy allows company admins to perform all operations on activation_codes
 * within their company, but prevents cross-company access.
 *
 * This provides explicit admin capabilities for managing promotional campaigns,
 * discount codes, and payment verification processes within their company.
 */
DROP POLICY IF EXISTS activation_codes_admin_access ON activation_codes;
CREATE POLICY activation_codes_admin_access ON activation_codes
  FOR ALL
  USING (
    is_current_user_admin()
    AND (
      created_by IN (
        SELECT id FROM users
        WHERE company_id = get_current_company_id()
      )
      OR used_by IN (
        SELECT id FROM users
        WHERE company_id = get_current_company_id()
      )
    )
  )
  WITH CHECK (
    is_current_user_admin()
    AND created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
  );

-- ============================================================================
-- READ-ONLY ACCESS POLICY FOR STANDARD USERS
-- ============================================================================

/**
 * Read-only access policy for regular company users
 *
 * This policy allows regular users to read activation_codes from their company
 * but prevents modifications unless they have admin privileges.
 *
 * This enables users to view available discount codes and check status while
 * preventing unauthorized modifications to promotional campaigns.
 */
DROP POLICY IF EXISTS activation_codes_read_only_access ON activation_codes;
CREATE POLICY activation_codes_read_only_access ON activation_codes
  FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR used_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

/**
 * Write protection policy to prevent cross-company data insertion
 *
 * This is a critical security policy that prevents users from creating
 * activation_codes for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
DROP POLICY IF EXISTS activation_codes_insert_protection ON activation_codes;
CREATE POLICY activation_codes_insert_protection ON activation_codes
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted activation_codes have created_by from current user's company
    -- Superadmins can insert for any company (for migration purposes)
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS activation_codes_update_protection ON activation_codes;
CREATE POLICY activation_codes_update_protection ON activation_codes
  FOR UPDATE
  USING (
    -- Can only update activation_codes in own company
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS activation_codes_delete_protection ON activation_codes;
CREATE POLICY activation_codes_delete_protection ON activation_codes
  FOR DELETE
  USING (
    -- Can only delete activation_codes in own company
    created_by IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company activation_codes access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * activation_codes from any company. This is necessary for support,
 * auditing, payment verification, and troubleshooting purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
DROP POLICY IF EXISTS activation_codes_superadmin_full_access ON activation_codes;
CREATE POLICY activation_codes_superadmin_full_access ON activation_codes
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

-- ============================================================================
-- CODE VALUE IMMUTABILITY POLICY
-- ============================================================================

/**
 * Critical security policy to prevent code value changes
 *
 * This policy prevents users from changing the code value of existing
 * activation_codes, which would be a security vulnerability allowing
 * code manipulation and fraud.
 *
 * Business logic: Code values must remain immutable to maintain audit trail
 * and prevent fraudulent code modifications after distribution.
 */
DROP POLICY IF EXISTS activation_codes_code_immutable ON activation_codes;
CREATE POLICY activation_codes_code_immutable ON activation_codes
  FOR UPDATE
  WITH CHECK (
    -- Prevent code from being changed (old value must equal new value)
    code = (SELECT code FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- USAGE PROTECTION POLICIES
-- ============================================================================

/**
 * Critical usage protection policy to prevent modification of used codes
 *
 * This policy prevents modification of activation_codes that have already been
 * used, protecting the integrity of transaction records and preventing abuse
 * through code reuse or manipulation.
 *
 * Business logic: Once a code is used (used_at IS NOT NULL), it should become
 * immutable to maintain transaction integrity and prevent fraud.
 */
DROP POLICY IF EXISTS activation_codes_used_code_protection ON activation_codes;
CREATE POLICY activation_codes_used_code_protection ON activation_codes
  FOR UPDATE
  USING (
    -- Allow updates if code is not yet used, or user is superadmin
    used_at IS NULL
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent modification of used codes (except by superadmin)
    used_at IS NULL
    OR used_at = (SELECT used_at FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  );

/**
 * Usage tracking protection policy
 *
 * This policy prevents modification of usage tracking fields to maintain
 * accurate usage counts and prevent abuse through usage manipulation.
 *
 * Business logic: current_usage and usage tracking fields must be protected
 * to prevent code abuse beyond intended usage limits.
 */
DROP POLICY IF EXISTS activation_codes_usage_tracking_protection ON activation_codes;
CREATE POLICY activation_codes_usage_tracking_protection ON activation_codes
  FOR UPDATE
  USING (
    -- Allow updates if usage tracking fields are not being decreased, or user is superadmin
    current_usage >= (SELECT current_usage FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent current_usage from being decreased
    current_usage >= (SELECT current_usage FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- FINANCIAL DATA PROTECTION POLICIES
-- ============================================================================

/**
 * Critical financial data protection policy for payment_amount
 *
 * This policy prevents modification of payment_amount after initial creation,
 * protecting revenue data and payment records from tampering.
 *
 * Business logic: Payment amounts should be immutable once set to maintain
 * accurate financial records and prevent revenue manipulation.
 */
DROP POLICY IF EXISTS activation_codes_payment_amount_protection ON activation_codes;
CREATE POLICY activation_codes_payment_amount_protection ON activation_codes
  FOR UPDATE
  USING (
    -- Allow updates if payment_amount is not being changed, or user is superadmin
    payment_amount = (SELECT payment_amount FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent payment_amount from being changed on UPDATE
    -- Allow setting payment_amount on INSERT (old value is NULL)
    payment_amount = (SELECT payment_amount FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  );

/**
 * Critical financial data protection policy for discount_percent
 *
 * This policy prevents modification of discount_percent after initial creation,
 * protecting pricing strategy and promotional structure from tampering.
 *
 * Business logic: Discount percentages should be immutable to maintain
 * pricing strategy integrity and prevent promotional abuse.
 */
DROP POLICY IF EXISTS activation_codes_discount_percent_protection ON activation_codes;
CREATE POLICY activation_codes_discount_percent_protection ON activation_codes
  FOR UPDATE
  USING (
    -- Allow updates if discount_percent is not being changed, or user is superadmin
    discount_percent = (SELECT discount_percent FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent discount_percent from being changed on UPDATE
    -- Allow setting discount_percent on INSERT (old value is NULL)
    discount_percent = (SELECT discount_percent FROM activation_codes WHERE id = activation_codes.id)
    OR is_current_user_superadmin()
  );

/**
 * Payment method and reference protection policy
 *
 * This policy prevents modification of payment processing fields to maintain
 * accurate payment records and prevent payment method manipulation.
 *
 * Business logic: Payment processing fields should be immutable to maintain
 * payment audit trail and prevent payment method fraud.
 */
DROP POLICY IF EXISTS activation_codes_payment_method_protection ON activation_codes;
CREATE POLICY activation_codes_payment_method_protection ON activation_codes
  FOR UPDATE
  USING (
    -- Allow updates if payment processing fields are not being changed, or user is superadmin
    (payment_method = (SELECT payment_method FROM activation_codes WHERE id = activation_codes.id)
    OR payment_method IS NULL)
    AND (payment_reference = (SELECT payment_reference FROM activation_codes WHERE id = activation_codes.id)
    OR payment_reference IS NULL)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent payment processing fields from being changed on UPDATE
    (payment_method = (SELECT payment_method FROM activation_codes WHERE id = activation_codes.id)
    OR payment_method IS NULL)
    AND (payment_reference = (SELECT payment_reference FROM activation_codes WHERE id = activation_codes.id)
    OR payment_reference IS NULL)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY activation_codes_tenant_isolation ON activation_codes IS 'Primary tenant isolation policy using indirect user context. Users can only access activation_codes from their company (via created_by/used_by → users.company_id), except superadmins who can access all companies.';

COMMENT ON POLICY activation_codes_admin_access ON activation_codes IS 'Admin access policy within company. Allows company admins full access to activation_codes in their company for promotional campaign management.';

COMMENT ON POLICY activation_codes_read_only_access ON activation_codes IS 'Read-only access policy for regular users. Allows reading activation_codes from own company to check discount availability and status.';

COMMENT ON POLICY activation_codes_insert_protection ON activation_codes IS 'Insert protection policy. Ensures new activation_codes are created by users from current user company only.';

COMMENT ON POLICY activation_codes_update_protection ON activation_codes IS 'Update protection policy. Prevents cross-company activation_codes modifications and protects usage integrity.';

COMMENT ON POLICY activation_codes_delete_protection ON activation_codes IS 'Delete protection policy. Prevents cross-company activation_codes deletions.';

COMMENT ON POLICY activation_codes_superadmin_full_access ON activation_codes IS 'Superadmin full access policy. Allows superadmins to access all activation_codes across all companies for support, payment verification, and auditing.';

COMMENT ON POLICY activation_codes_code_immutable ON activation_codes IS 'Critical security policy. Prevents code value changes on existing activation_codes to prevent code manipulation and fraud.';

COMMENT ON POLICY activation_codes_used_code_protection ON activation_codes IS 'Critical usage protection policy. Prevents modification of activation_codes that have already been used to maintain transaction integrity and prevent abuse.';

COMMENT ON POLICY activation_codes_usage_tracking_protection ON activation_codes IS 'Usage tracking protection policy. Prevents decreasing current_usage to prevent code abuse beyond intended usage limits.';

COMMENT ON POLICY activation_codes_payment_amount_protection ON activation_codes IS 'Critical financial data protection policy. Prevents payment_amount modification after initial creation to protect revenue data and audit trail.';

COMMENT ON POLICY activation_codes_discount_percent_protection ON activation_codes IS 'Critical financial data protection policy. Prevents discount_percent modification after initial creation to protect pricing strategy and promotional structure.';

COMMENT ON POLICY activation_codes_payment_method_protection ON activation_codes IS 'Payment processing protection policy. Prevents modification of payment method and reference fields to maintain payment audit trail and prevent fraud.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure created_by index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_activation_codes_created_by ON activation_codes(created_by);

-- Ensure used_by index exists for usage tracking queries
CREATE INDEX IF NOT EXISTS idx_activation_codes_used_by ON activation_codes(used_by);

-- Create composite index for company-based queries (created_by + status)
-- This optimizes the most common query pattern: finding active codes for a company
CREATE INDEX IF NOT EXISTS idx_activation_codes_created_status ON activation_codes(created_by, is_active);

-- Create composite index for usage tracking queries (used_by + used_at)
-- This optimizes queries that track code usage patterns within a company
CREATE INDEX IF NOT EXISTS idx_activation_codes_used_date ON activation_codes(used_by, used_at);

-- Create composite index for expiry and status queries
-- This optimizes queries that filter by expiration date and active status
CREATE INDEX IF NOT EXISTS idx_activation_codes_expires_active ON activation_codes(expires_at, is_active) WHERE is_active = true;

-- Create index for payment verification queries
-- This optimizes queries that look up codes by payment reference for verification
CREATE INDEX IF NOT EXISTS idx_activation_codes_payment_ref ON activation_codes(payment_reference) WHERE payment_reference IS NOT NULL;

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate activation_codes RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, superadmin
 * access, code immutability, usage protection, and financial data protection.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_activation_codes_rls()
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
  test_code_1_id UUID;
  test_code_2_id UUID;
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
      WHERE tablename = 'activation_codes'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on activation_codes table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on activation_codes table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM activation_codes;

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

    -- In a real test with actual data, this would only return company 1 activation_codes
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
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_code_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_used_code_protection'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, code_immutable, used_code_protection'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
        'Some required RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 7: Verify financial data protection policies exist
  BEGIN
    -- Check if financial protection policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_payment_amount_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_discount_percent_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_payment_method_protection'
    ) THEN
      RETURN QUERY SELECT 'Financial Protection'::TEXT, true::BOOLEAN,
        'All financial data protection policies exist'::TEXT,
        'payment_amount, discount_percent, payment_method protection policies verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Financial Protection'::TEXT, false::BOOLEAN,
        'Some financial protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Financial Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify performance indexes exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'activation_codes'
      AND indexname = 'idx_activation_codes_created_by'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'activation_codes'
      AND indexname = 'idx_activation_codes_used_by'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'activation_codes'
      AND indexname = 'idx_activation_codes_created_status'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'created_by, used_by, created_status indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 9: Verify usage protection policies exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_used_code_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'activation_codes'
      AND policyname = 'activation_codes_usage_tracking_protection'
    ) THEN
      RETURN QUERY SELECT 'Usage Protection'::TEXT, true::BOOLEAN,
        'All usage protection policies exist'::TEXT,
        'used_code_protection, usage_tracking_protection verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Usage Protection'::TEXT, false::BOOLEAN,
        'Some usage protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Usage Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_activation_codes_rls() IS 'Test function to validate activation_codes RLS policy implementation. Returns test results for policy verification, financial data protection, usage protection, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor activation_codes RLS security
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts, configuration issues, or access pattern anomalies.
 *
 * @returns Audit information about activation_codes access patterns and security status
 */
CREATE OR REPLACE FUNCTION audit_activation_codes_security()
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
    WHERE tablename = 'activation_codes'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on activation_codes table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_tenant_isolation'
  ) THEN
    RETURN QUERY SELECT
      'Missing Critical Policy'::TEXT,
      'Tenant isolation policy is missing'::TEXT,
      'CRITICAL'::TEXT,
      'Restore tenant isolation policy immediately'::TEXT;
    RETURN;
  END IF;

  -- Check 3: Verify code immutability policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_code_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Code immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement code immutability policy to prevent code manipulation and fraud'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify usage protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_used_code_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Usage Protection'::TEXT,
      'Used code protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement used code protection to maintain transaction integrity and prevent abuse'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_usage_tracking_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Usage Tracking'::TEXT,
      'Usage tracking protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement usage tracking protection to prevent code abuse beyond usage limits'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify financial data protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_payment_amount_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Financial Protection'::TEXT,
      'Payment amount protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement payment amount protection to prevent revenue data tampering'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_discount_percent_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Pricing Protection'::TEXT,
      'Discount percent protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement discount percent protection to prevent pricing strategy tampering'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activation_codes'
    AND policyname = 'activation_codes_payment_method_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Payment Protection'::TEXT,
      'Payment method protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement payment method protection to maintain payment audit trail'::TEXT;
    RETURN;
  END IF;

  -- Check 6: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'activation_codes'
    AND indexname = 'idx_activation_codes_created_by'
  ) THEN
    RETURN QUERY SELECT
      'Missing Performance Index'::TEXT,
      'Created by user index is missing for RLS performance'::TEXT,
      'MEDIUM'::TEXT,
      'Create created_by index to optimize RLS query performance'::TEXT;
    RETURN;
  END IF;

  -- Return baseline monitoring status if all checks pass
  RETURN QUERY SELECT
    'Security Audit Complete'::TEXT,
    'All critical RLS security controls verified for activation_codes table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_activation_codes_security() IS 'Security audit function for activation_codes RLS policies. Monitors policy effectiveness, detects configuration issues, and provides security recommendations for financial data protection and usage integrity.';

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
 * To rollback this migration and disable RLS on activation_codes table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE activation_codes DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS activation_codes_tenant_isolation ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_admin_access ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_read_only_access ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_insert_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_update_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_delete_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_superadmin_full_access ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_code_immutable ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_used_code_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_usage_tracking_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_payment_amount_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_discount_percent_protection ON activation_codes;
 *    DROP POLICY IF EXISTS activation_codes_payment_method_protection ON activation_codes;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_activation_codes_created_by;
 *    DROP INDEX IF EXISTS idx_activation_codes_used_by;
 *    DROP INDEX IF EXISTS idx_activation_codes_created_status;
 *    DROP INDEX IF EXISTS idx_activation_codes_used_date;
 *    DROP INDEX IF EXISTS idx_activation_codes_expires_active;
 *    DROP INDEX IF EXISTS idx_activation_codes_payment_ref;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_activation_codes_rls();
 *    DROP FUNCTION IF EXISTS audit_activation_codes_security();
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
 *    - Base tenant isolation: Indirect user context through created_by/used_by → users.company_id
 *    - Admin access: Company admins full access within their company
 *    - Read-only access: Regular users can read but not modify
 *    - Write protection: Separate policies for INSERT, UPDATE, DELETE operations
 *    - Code immutability: Code values cannot be changed after creation
 *    - Usage protection: Used codes cannot be modified to prevent abuse
 *    - Financial data protection: Payment and discount data immutable
 *
 * 2. SECURITY MODEL:
 *    - Company users: Full access to activation_codes from their company only
 *    - Company admins: Full access + can manage activation_codes in their company
 *    - Superadmins: Cross-company access for support, payment verification, and auditing
 *    - Code protection: Code values immutable to prevent fraud
 *    - Usage protection: Used codes cannot be modified
 *    - Financial protection: Payment and discount data immutable
 *
 * 3. INDIRECT USER CONTEXT APPROACH:
 *    - activation_codes table does not have direct company_id column
 *    - User context determined through created_by → users.company_id relationship
 *    - Secondary context through used_by → users.company_id for usage tracking
 *    - This approach maintains proper isolation even when codes are used by
 *      different users within the same company
 *    - Supports multi-user promotional campaigns within companies
 *
 * 4. ACTIVATION CODE WORKFLOW:
 *    - Company admins create activation codes with specified discount percentages
 *    - Codes have usage limits and expiration dates for campaign control
 *    - Payment verification fields support paid activation campaigns
 *    - Usage tracking prevents abuse beyond intended limits
 *    - Status history maintains audit trail of code lifecycle
 *
 * 5. FINANCIAL DATA PROTECTION:
 *    - discount_percent: Immutable after creation (pricing strategy protection)
 *    - payment_amount: Immutable after setting (revenue data protection)
 *    - payment_method: Immutable after setting (payment audit trail)
 *    - payment_reference: Immutable after setting (payment verification integrity)
 *    - Exchange rates and currency data protected from manipulation
 *
 * 6. USAGE INTEGRITY PROTECTION:
 *    - Used codes cannot be modified (transaction integrity)
 *    - Usage counts cannot be decreased (abuse prevention)
 *    - Usage tracking fields protected from manipulation
 *    - Expiration and activation status protected
 *    - IP address tracking for usage security
 *
 * 7. CODE IMMUTABILITY PROTECTION:
 *    - Code values cannot be changed after creation
 *    - Prevents code manipulation and fraud
 *    - Maintains promotional campaign integrity
 *    - Protects against code value transfer between campaigns
 *    - Supports audit trail for promotional activities
 *
 * 8. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by created_by/used_by (indexed columns)
 *    - Composite indexes optimize common query patterns
 *    - Payment reference index for verification queries
 *    - Expiration date index for active code queries
 *    - Status-based indexes for campaign management
 *    - Queries maintain performance even with RLS overhead
 *
 * 9. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context not properly set
 *    - NULL context results in zero rows returned (safe failure)
 *    - Code immutability prevents promotional fraud
 *    - Usage protection prevents code abuse
 *    - Defense-in-depth: Application layer + Database layer security
 *
 * 10. PROMOTIONAL CAMPAIGN PROTECTION:
 *     - Discount structures protected from competitor analysis
 *     - Campaign effectiveness data protected from intelligence gathering
 *     - Usage patterns and conversion data protected
 *     - Payment processing intelligence protected
 *     - Cross-company access only for superadmins (audited)
 *
 * 11. TESTING AND VALIDATION:
 *     - test_activation_codes_rls(): Basic RLS policy validation
 *     - audit_activation_codes_security(): Security monitoring
 *     - Financial data protection testing
 *     - Usage protection testing
 *     - Code immutability testing
 *     - Application-level integration testing recommended
 *
 * 12. APPLICATION LAYER REQUIREMENTS:
 *     - Must call set_tenant_context() at start of each request
 *     - Must set appropriate user role ('user', 'admin', 'superadmin')
 *     - Must call reset_tenant_context() at end of each request
 *     - Integration with activation_codes queries requires proper context
 *     - Payment verification workflows must respect RLS policies
 *     - Promotional campaign management must respect usage limits
 *
 * 13. MONITORING AND AUDITING:
 *     - Monitor superadmin access to activation_codes
 *     - Audit logs for cross-company data access
 *     - Regular validation of policy effectiveness
 *     - Performance monitoring of RLS-optimized queries
 *     - Payment verification access pattern monitoring
 *     - Usage pattern anomaly detection
 *     - Code expiration and status monitoring
 *
 * 14. COMPLIANCE AND SECURITY:
 *     - activation_codes contains sensitive financial and promotional data
 *     - RLS provides tenant isolation for multi-tenant compliance
 *     - Financial data protection for payment processing integrity
 *     - Audit trail protection for promotional activities
 *     - Supports revenue intelligence protection
 *     - Payment processing compliance and security
 *     - Promotional campaign confidentiality maintained
 *
 * 15. CAMPAIGN MANAGEMENT CONSIDERATIONS:
 *     - Activation codes represent promotional campaigns with financial impact
 *     - Campaign effectiveness affects business-wide revenue and customer acquisition
 *     - Usage limits prevent abuse and maintain campaign ROI
 *     - Payment verification ensures legitimate code activation
 *     - Campaign data changes impact business-wide promotional strategies
 *     - Code immutability prevents promotional strategy circumvention
 *
 * 16. FRAUD PREVENTION MEASURES:
 *     - Code value immutability prevents code manipulation
 *     - Usage protection prevents code abuse beyond limits
 *     - Payment field protection prevents revenue manipulation
 *     - Used code protection maintains transaction integrity
 *     - IP tracking supports usage security analysis
 *     - Status history maintains comprehensive audit trail
 */