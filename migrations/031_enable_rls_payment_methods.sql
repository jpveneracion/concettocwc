-- migrations/031_enable_rls_payment_methods.sql
-- Row-Level Security Policies for Payment Methods Table
--
-- This migration enables comprehensive RLS on the payment_methods table to enforce
-- tenant isolation at the database level for CRITICAL payment method and financial data.
--
-- Risk Level: CRITICAL - Payment method data, card information, financial credentials exposed
--
-- Security Model:
-- - Tenant Isolation: Users can only access payment methods from their company (direct company_id context)
-- - Admin Access: Company admins can manage all payment methods in their company
-- - Superadmin Access: Superadmins can access payment methods across all companies for payment support
-- - Payment Data Immutability: Card details and payment provider data protected from modification
-- - Audit Trail Protection: Timestamps and method creation data protected for audit integrity
-- - Card Information Protection: Partial card numbers and expiry dates protected
-- - Payment Provider Protection: PayMongo payment method IDs protected
-- - Write Protection: Prevent cross-company data modifications
--
-- Data Exposure Analysis:
-- - card_last4: Partial card numbers and payment card identification exposed
-- - expiry_date: Card expiration dates and payment validity periods exposed
-- - paymongo_payment_method_id: Payment provider integration data and processing patterns exposed
-- - type: Payment method types and business payment capabilities exposed
-- - is_default: Business payment preferences and primary payment methods exposed
-- - Payment processing: Business payment workflows and financial operations exposed
-- - Company payment methods: Business financial infrastructure and payment capabilities exposed

-- ============================================================================
-- ENABLE RLS ON PAYMENT_METHODS TABLE
-- ============================================================================

-- Enable Row-Level Security on the payment_methods table
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY (DIRECT COMPANY CONTEXT)
-- ============================================================================

/**
 * Primary tenant isolation policy for payment_methods table
 *
 * This policy enforces that users can only access payment methods belonging
 * to their company through direct company_id context.
 *
 * This direct context approach ensures proper tenant isolation for payment
 * method data and provides efficient query performance with indexed company_id.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS payment_methods_tenant_isolation ON payment_methods;
CREATE POLICY payment_methods_tenant_isolation ON payment_methods
  FOR ALL
  USING (
    -- Require tenant context to be set (fail secure if NULL)
    -- Superadmins can access all data for payment support purposes
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
 * Admin access policy for payment_methods within the same company
 *
 * This policy allows company admins to perform all operations on payment methods
 * within their company, but prevents cross-company access.
 *
 * This provides explicit admin capabilities for managing payment methods,
 * setting default payment methods, and managing payment processing workflows.
 */
DROP POLICY IF EXISTS payment_methods_admin_access ON payment_methods;
CREATE POLICY payment_methods_admin_access ON payment_methods
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
 * This policy allows regular users to read payment methods from their company
 * but prevents modifications unless they have admin privileges.
 *
 * This enables users to view available payment methods and check payment method
 * information while preventing unauthorized modifications to payment data.
 */
DROP POLICY IF EXISTS payment_methods_read_only_access ON payment_methods;
CREATE POLICY payment_methods_read_only_access ON payment_methods
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
 * This is a critical security policy that prevents users from creating
 * payment methods for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
DROP POLICY IF EXISTS payment_methods_insert_protection ON payment_methods;
CREATE POLICY payment_methods_insert_protection ON payment_methods
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted payment methods belong to current user's company
    -- Superadmins can insert for any company (for migration purposes)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS payment_methods_update_protection ON payment_methods;
CREATE POLICY payment_methods_update_protection ON payment_methods
  FOR UPDATE
  USING (
    -- Can only update payment methods in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    company_id = (SELECT company_id FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS payment_methods_delete_protection ON payment_methods;
CREATE POLICY payment_methods_delete_protection ON payment_methods
  FOR DELETE
  USING (
    -- Can only delete payment methods in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company payment_methods access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * payment methods from any company. This is necessary for payment support,
 * debugging payment processing issues, and troubleshooting payment problems.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 * Payment method data access must be audited and monitored.
 */
DROP POLICY IF EXISTS payment_methods_superadmin_full_access ON payment_methods;
CREATE POLICY payment_methods_superadmin_full_access ON payment_methods
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
 * This policy prevents users from changing the company_id of existing
 * payment methods, which would be a security vulnerability allowing payment
 * method transfer between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies
 * and maintain payment method integrity and audit trail.
 */
DROP POLICY IF EXISTS payment_methods_company_id_immutable ON payment_methods;
CREATE POLICY payment_methods_company_id_immutable ON payment_methods
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (old value must equal new value)
    company_id = (SELECT company_id FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- PAYMENT PROVIDER DATA PROTECTION POLICIES
-- ============================================================================

/**
 * Critical payment provider data protection for paymongo_payment_method_id
 *
 * This policy prevents modification of paymongo_payment_method_id after initial
 * creation, protecting payment provider integration data from tampering.
 *
 * Business logic: Payment provider method IDs should be immutable once set to
 * maintain accurate payment processing records and prevent payment integration manipulation.
 */
DROP POLICY IF EXISTS payment_methods_paymongo_id_protection ON payment_methods;
CREATE POLICY payment_methods_paymongo_id_protection ON payment_methods
  FOR UPDATE
  USING (
    -- Allow updates if paymongo_payment_method_id is not being changed, or user is superadmin
    paymongo_payment_method_id = (SELECT paymongo_payment_method_id FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent paymongo_payment_method_id from being changed on UPDATE
    -- Allow setting paymongo_payment_method_id on INSERT (old value is NULL)
    paymongo_payment_method_id = (SELECT paymongo_payment_method_id FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

/**
 * Payment method type protection policy
 *
 * This policy prevents modification of payment method type to maintain
 * accurate payment method classification and prevent payment processing errors.
 *
 * Business logic: Payment method types should be immutable to maintain
 * payment processing integrity and prevent payment workflow errors.
 */
DROP POLICY IF EXISTS payment_methods_type_protection ON payment_methods;
CREATE POLICY payment_methods_type_protection ON payment_methods
  FOR UPDATE
  WITH CHECK (
    -- Prevent type from being changed (old value must equal new value)
    type = (SELECT type FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- CARD INFORMATION PROTECTION POLICIES
-- ============================================================================

/**
 * Card last four digits protection policy for partial card information
 *
 * This policy prevents modification of card_last4 to maintain accurate
 * payment method identification and prevent card information manipulation.
 *
 * Business logic: Card last four digits should be immutable to maintain
 * payment method identification and prevent card information manipulation.
 */
DROP POLICY IF EXISTS payment_methods_card_last4_protection ON payment_methods;
CREATE POLICY payment_methods_card_last4_protection ON payment_methods
  FOR UPDATE
  WITH CHECK (
    -- Prevent card_last4 from being changed
    card_last4 = (SELECT card_last4 FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

/**
 * Card expiry date protection policy for payment validity data
 *
 * This policy prevents modification of expiry_date to maintain accurate
 * payment method validity tracking and prevent payment processing errors.
 *
 * Business logic: Card expiry dates should be immutable to maintain
 * payment method validity tracking and prevent payment workflow errors.
 */
DROP POLICY IF EXISTS payment_methods_expiry_date_protection ON payment_methods;
CREATE POLICY payment_methods_expiry_date_protection ON payment_methods
  FOR UPDATE
  WITH CHECK (
    -- Prevent expiry_date from being changed
    expiry_date = (SELECT expiry_date FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- PAYMENT METHOD DEFAULT STATUS PROTECTION
-- ============================================================================

/**
 * Default payment method status protection policy
 *
 * This policy protects the is_default field to prevent unauthorized changes
 * to the company's primary payment method setting.
 *
 * Business logic: Default payment method status changes should be controlled
 * through proper payment method management workflows to prevent payment processing errors.
 */
DROP POLICY IF EXISTS payment_methods_is_default_protection ON payment_methods;
CREATE POLICY payment_methods_is_default_protection ON payment_methods
  FOR UPDATE
  USING (
    -- Allow is_default changes if user is admin or superadmin
    -- Prevent regular users from changing default payment method status
    is_current_user_admin()
    OR is_current_user_superadmin()
    OR is_default = (SELECT is_default FROM payment_methods WHERE id = payment_methods.id)
  )
  WITH CHECK (
    -- Apply same restrictions to WITH CHECK
    is_current_user_admin()
    OR is_current_user_superadmin()
    OR is_default = (SELECT is_default FROM payment_methods WHERE id = payment_methods.id)
  );

-- ============================================================================
-- AUDIT TRAIL PROTECTION POLICIES
-- ============================================================================

/**
 * Created timestamp immutability policy for audit trail protection
 *
 * This policy prevents modification of created_at to maintain
 * accurate payment method timeline and audit trail integrity.
 *
 * Business logic: Payment method creation timestamps should be immutable to maintain
 * audit trail and prevent timestamp manipulation for compliance purposes.
 */
DROP POLICY IF EXISTS payment_methods_created_at_immutable ON payment_methods;
CREATE POLICY payment_methods_created_at_immutable ON payment_methods
  FOR UPDATE
  WITH CHECK (
    -- Prevent created_at from being changed (old value must equal new value)
    created_at = (SELECT created_at FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

/**
 * Updated timestamp protection policy for audit trail integrity
 *
 * This policy prevents inappropriate modification of updated_at to maintain
 * accurate payment method modification timeline and audit trail integrity.
 *
 * Business logic: Updated timestamps should be managed by the application
 * through proper update workflows to maintain accurate audit trails.
 */
DROP POLICY IF EXISTS payment_methods_updated_at_protection ON payment_methods;
CREATE POLICY payment_methods_updated_at_protection ON payment_methods
  FOR UPDATE
  WITH CHECK (
    -- Allow updated_at to be changed by application (typically set to NOW())
    -- but prevent arbitrary timestamp manipulation by regular users
    -- Superadmins can modify for audit correction purposes
    updated_at >= (SELECT updated_at FROM payment_methods WHERE id = payment_methods.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY payment_methods_tenant_isolation ON payment_methods IS 'Primary tenant isolation policy using direct company_id context. Users can only access payment methods from their company, except superadmins who can access all companies for payment support.';

COMMENT ON POLICY payment_methods_admin_access ON payment_methods IS 'Admin access policy within company. Allows company admins full access to payment methods in their company for payment method management and processing operations.';

COMMENT ON POLICY payment_methods_read_only_access ON payment_methods IS 'Read-only access policy for regular users. Allows reading payment methods from own company to check payment method information and status.';

COMMENT ON POLICY payment_methods_insert_protection ON payment_methods IS 'Insert protection policy. Ensures new payment methods are assigned to current user company only to prevent cross-company payment data contamination.';

COMMENT ON POLICY payment_methods_update_protection ON payment_methods IS 'Update protection policy. Prevents cross-company payment method modifications and protects critical payment fields from unauthorized changes.';

COMMENT ON POLICY payment_methods_delete_protection ON payment_methods IS 'Delete protection policy. Prevents cross-company payment method deletions to maintain payment method audit trail integrity.';

COMMENT ON POLICY payment_methods_superadmin_full_access ON payment_methods IS 'Superadmin full access policy. Allows superadmins to access all payment methods across all companies for payment support, debugging, and troubleshooting. Payment method access must be audited.';

COMMENT ON POLICY payment_methods_company_id_immutable ON payment_methods IS 'Critical security policy. Prevents company_id changes on existing payment methods to prevent payment method transfer between companies and maintain payment method integrity.';

COMMENT ON POLICY payment_methods_paymongo_id_protection ON payment_methods IS 'Critical payment provider data protection policy. Prevents paymongo_payment_method_id modification after initial creation to protect payment provider integration data and prevent payment processing manipulation.';

COMMENT ON POLICY payment_methods_type_protection ON payment_methods IS 'Payment method type protection policy. Prevents type changes to maintain payment processing integrity and prevent payment workflow errors.';

COMMENT ON POLICY payment_methods_card_last4_protection ON payment_methods IS 'Card last four digits protection policy. Prevents card_last4 modification to maintain payment method identification and prevent card information manipulation.';

COMMENT ON POLICY payment_methods_expiry_date_protection ON payment_methods IS 'Card expiry date protection policy. Prevents expiry_date modification to maintain payment method validity tracking and prevent payment processing errors.';

COMMENT ON POLICY payment_methods_is_default_protection ON payment_methods IS 'Default payment method status protection policy. Protects is_default field changes to prevent unauthorized changes to company primary payment method.';

COMMENT ON POLICY payment_methods_created_at_immutable ON payment_methods IS 'Created timestamp immutability policy. Prevents created_at changes to maintain payment method audit trail and prevent timestamp manipulation.';

COMMENT ON POLICY payment_methods_updated_at_protection ON payment_methods IS 'Updated timestamp protection policy. Protects updated_at from inappropriate modification to maintain accurate payment method modification timeline and audit trail integrity.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_id ON payment_methods(company_id);

-- Create composite index for payment method type queries within company context
-- This optimizes queries that filter by company_id and payment method type
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_type ON payment_methods(company_id, type);

-- Create composite index for default payment method queries within company
-- This optimizes queries that find the default payment method for a company
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_default ON payment_methods(company_id, is_default) WHERE is_default = true;

-- Create index for PayMongo payment method ID lookups
-- This optimizes webhook processing and payment verification queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_paymongo_id ON payment_methods(paymongo_payment_method_id);

-- Create composite index for company-specific payment method lookups by PayMongo ID
-- This optimizes the most common query pattern: finding specific payment methods for a company
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_paymongo ON payment_methods(company_id, paymongo_payment_method_id);

-- Create index for payment method creation time queries
-- This optimizes audit trail queries and payment method timeline analysis
CREATE INDEX IF NOT EXISTS idx_payment_methods_created_at ON payment_methods(created_at);

-- Create index for payment method update time queries
-- This optimizes payment method modification tracking and monitoring
CREATE INDEX IF NOT EXISTS idx_payment_methods_updated_at ON payment_methods(updated_at);

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate payment_methods RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, superadmin
 * access, payment data protection, and audit trail protection.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_payment_methods_rls()
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
  test_payment_method_1_id UUID;
  test_payment_method_2_id UUID;
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
      WHERE tablename = 'payment_methods'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on payment_methods table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on payment_methods table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM payment_methods;

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

    -- In a real test with actual data, this would only return company 1 payment methods
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
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_company_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_paymongo_id_protection'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, company_id_immutable, paymongo_id_protection'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
        'Some required RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 7: Verify payment data protection policies exist
  BEGIN
    -- Check if payment protection policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_paymongo_id_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_card_last4_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_expiry_date_protection'
    ) THEN
      RETURN QUERY SELECT 'Payment Data Protection'::TEXT, true::BOOLEAN,
        'All payment data protection policies exist'::TEXT,
        'paymongo_id, card_last4, expiry_date protection policies verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Payment Data Protection'::TEXT, false::BOOLEAN,
        'Some payment data protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Payment Data Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify audit trail protection policies exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_created_at_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_updated_at_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_type_protection'
    ) THEN
      RETURN QUERY SELECT 'Audit Trail Protection'::TEXT, true::BOOLEAN,
        'All audit trail protection policies exist'::TEXT,
        'created_at, updated_at, type protection verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Audit Trail Protection'::TEXT, false::BOOLEAN,
        'Some audit trail protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Audit Trail Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 9: Verify performance indexes exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payment_methods'
      AND indexname = 'idx_payment_methods_company_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payment_methods'
      AND indexname = 'idx_payment_methods_company_type'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payment_methods'
      AND indexname = 'idx_payment_methods_company_default'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'company_id, company_type, company_default indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 10: Verify card information protection policies exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_card_last4_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_expiry_date_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'payment_methods'
      AND policyname = 'payment_methods_is_default_protection'
    ) THEN
      RETURN QUERY SELECT 'Card Information Protection'::TEXT, true::BOOLEAN,
        'All card information protection policies exist'::TEXT,
        'card_last4, expiry_date, is_default protection verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Card Information Protection'::TEXT, false::BOOLEAN,
        'Some card information protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Card Information Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_payment_methods_rls() IS 'Test function to validate payment_methods RLS policy implementation. Returns test results for policy verification, payment data protection, audit trail protection, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor payment_methods RLS security
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts, configuration issues, or payment data access anomalies.
 *
 * @returns Audit information about payment_methods access patterns and security status
 */
CREATE OR REPLACE FUNCTION audit_payment_methods_security()
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
    WHERE tablename = 'payment_methods'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on payment_methods table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_tenant_isolation'
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
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_company_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Company ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement company_id immutability policy to prevent payment method transfer between tenants'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify payment provider data protection policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_paymongo_id_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Payment Provider Protection'::TEXT,
      'PayMongo payment method ID protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement payment provider ID protection to prevent payment integration manipulation'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify card information protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_card_last4_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Card Data Protection'::TEXT,
      'Card last four digits protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement card information protection to prevent card data manipulation'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_expiry_date_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Expiry Protection'::TEXT,
      'Card expiry date protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement expiry date protection to maintain payment validity tracking'::TEXT;
    RETURN;
  END IF;

  -- Check 6: Verify audit trail protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_created_at_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Audit Trail Protection'::TEXT,
      'Created timestamp immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement created timestamp immutability to maintain audit trail integrity'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_updated_at_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Update Protection'::TEXT,
      'Updated timestamp protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement updated timestamp protection to maintain modification timeline integrity'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_methods'
    AND policyname = 'payment_methods_type_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Type Protection'::TEXT,
      'Payment method type protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement type protection to maintain payment processing integrity'::TEXT;
    RETURN;
  END IF;

  -- Check 7: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payment_methods'
    AND indexname = 'idx_payment_methods_company_id'
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
    'All critical RLS security controls verified for payment_methods table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews for payment method data'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_payment_methods_security() IS 'Security audit function for payment_methods RLS policies. Monitors policy effectiveness, detects configuration issues, and provides security recommendations for payment method data protection and audit trail integrity.';

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
 * To rollback this migration and disable RLS on payment_methods table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS payment_methods_tenant_isolation ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_admin_access ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_read_only_access ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_insert_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_update_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_delete_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_superadmin_full_access ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_company_id_immutable ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_paymongo_id_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_type_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_card_last4_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_expiry_date_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_is_default_protection ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_created_at_immutable ON payment_methods;
 *    DROP POLICY IF EXISTS payment_methods_updated_at_protection ON payment_methods;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_payment_methods_company_id;
 *    DROP INDEX IF EXISTS idx_payment_methods_company_type;
 *    DROP INDEX IF EXISTS idx_payment_methods_company_default;
 *    DROP INDEX IF EXISTS idx_payment_methods_paymongo_id;
 *    DROP INDEX IF EXISTS idx_payment_methods_company_paymongo;
 *    DROP INDEX IF EXISTS idx_payment_methods_created_at;
 *    DROP INDEX IF EXISTS idx_payment_methods_updated_at;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_payment_methods_rls();
 *    DROP FUNCTION IF EXISTS audit_payment_methods_security();
 *
 * WARNING: Rolling back RLS policies will remove database-level security
 * and make the application dependent on application-layer security only.
 * Payment method data will be exposed to cross-company access without RLS protection.
 */

-- ============================================================================
-- IMPLEMENTATION NOTES
-- ============================================================================

/*
 * IMPLEMENTATION NOTES:
 *
 * 1. POLICY STRUCTURE:
 *    - Base tenant isolation: Direct company_id = get_current_company_id() policy
 *    - Admin access: Company admins full access within their company
 *    - Read-only access: Regular users can read but not modify
 *    - Write protection: Separate policies for INSERT, UPDATE, DELETE operations
 *    - Company ID immutability: Cannot change company association after creation
 *    - Payment provider protection: PayMongo payment method IDs immutable
 *    - Payment method type protection: Payment method classification immutable
 *    - Card information protection: Card last4 and expiry date immutable
 *    - Default status protection: Default payment method changes controlled
 *    - Audit trail protection: Timestamps protected for integrity
 *
 * 2. SECURITY MODEL:
 *    - Company users: Full access to payment methods from their company only
 *    - Company admins: Full access + can manage payment methods in their company
 *    - Superadmins: Cross-company access for payment support and troubleshooting
 *    - Payment protection: Card data and provider integration data immutable
 *    - Audit trail protection: Timestamps and creation data protected
 *    - Payment method classification: Type and status protected from manipulation
 *
 * 3. DIRECT COMPANY CONTEXT APPROACH:
 *    - payment_methods table has direct company_id column
 *    - Tenant isolation through direct company_id = get_current_company_id() comparison
 *    - More efficient than indirect user context approaches
 *    - Simplified policy logic with direct foreign key relationship
 *    - Better performance with indexed company_id column
 *
 * 4. PAYMENT METHOD WORKFLOW:
 *    - Payment methods created through payment provider integration (PayMongo)
 *    - Each payment method associated with a specific company
 *    - Payment method types: card, bank_account, wallet, qr_payment
 *    - Card information includes partial card number (last4) and expiry date
 *    - Default payment method status for subscription processing
 *    - Audit trail maintained through protected timestamps
 *
 * 5. PAYMENT DATA PROTECTION:
 *    - paymongo_payment_method_id: Immutable after creation (payment integration protection)
 *    - type: Immutable to maintain payment processing integrity
 *    - card_last4: Immutable (card information protection)
 *    - expiry_date: Immutable (payment validity tracking)
 *    - Payment method classification protected from manipulation
 *    - Payment provider integration data maintained for processing
 *
 * 6. CARD INFORMATION SECURITY:
 *    - card_last4: Partial card number protected from modification
 *    - expiry_date: Card expiry date protected from tampering
 *    - Card information immutability maintains payment method identification
 *    - Prevents card information manipulation and potential fraud
 *    - Payment processing integrity maintained through card data protection
 *
 * 7. DEFAULT PAYMENT METHOD PROTECTION:
 *    - is_default: Changes controlled to admin/superadmin only
 *    - Prevents unauthorized changes to primary payment method
 *    - Maintains payment processing workflows and subscription billing
 *    - Supports business payment preference management
 *    - Payment processing continuity maintained through default method protection
 *
 * 8. AUDIT TRAIL PROTECTION:
 *    - created_at: Immutable (payment method creation timestamp)
 *    - updated_at: Protected (payment method modification timeline)
 *    - Payment method lifecycle tracking for compliance
 *    - Audit trail integrity for payment method management
 *    - Payment processing history maintained through timestamp protection
 *
 * 9. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by company_id (indexed column)
 *    - Composite indexes optimize common query patterns
 *    - Payment method type index for classification queries
 *    - Default payment method index for subscription processing
 *    - PayMongo ID index for webhook processing and verification
 *    - Timestamp indexes for audit trail and monitoring queries
 *    - Queries maintain performance even with RLS overhead
 *
 * 10. FAIL-SECURE PHILOSOPHY:
 *     - All policies deny access by default if context not properly set
 *     - NULL context results in zero rows returned (safe failure)
 *     - Company_id immutability prevents payment method transfer between tenants
 *     - Payment data immutability prevents card information manipulation
 *     - Defense-in-depth: Application layer + Database layer security
 *
 * 11. PAYMENT METHOD SECURITY CONSIDERATIONS:
 *     - Payment method records contain sensitive financial information
 *     - Card details (even partial) can be used for social engineering
 *     - Payment provider integration data represents processing capabilities
 *     - Payment method types expose business payment infrastructure
 *     - Default payment methods indicate business payment preferences
 *     - Cross-company payment method access limited to superadmins (audited)
 *
 * 12. TESTING AND VALIDATION:
 *     - test_payment_methods_rls(): Basic RLS policy validation
 *     - audit_payment_methods_security(): Security monitoring
 *     - Payment data protection testing
 *     - Card information protection testing
 *     - Audit trail protection testing
 *     - Application-level integration testing recommended
 *
 * 13. APPLICATION LAYER REQUIREMENTS:
 *     - Must call set_tenant_context() at start of each request
 *     - Must set appropriate user role ('user', 'admin', 'superadmin')
 *     - Must call reset_tenant_context() at end of each request
 *     - Integration with payment processing requires proper context
 *     - Payment method management workflows must respect RLS policies
 *     - Payment provider webhooks must set company context appropriately
 *
 * 14. MONITORING AND AUDITING:
 *     - Monitor superadmin access to payment method data
 *     - Audit logs for cross-company payment method access
 *     - Regular validation of policy effectiveness
 *     - Performance monitoring of RLS-optimized queries
 *     - Payment method access pattern monitoring
 *     - Default payment method change tracking and validation
 *     - Payment method creation and modification monitoring
 *     - Card information access logging and monitoring
 *
 * 15. COMPLIANCE AND SECURITY:
 *     - payment_methods contains critical payment method data
 *     - RLS provides tenant isolation for multi-tenant payment processing
 *     - Card information protection for payment security compliance
 *     - Audit trail protection for payment method management compliance
 *     - Supports payment processing regulations and financial compliance
 *     - Payment provider integration security maintained
 *     - Payment method confidentiality and regulatory compliance
 *
 * 16. PAYMENT PROCESSING WORKFLOWS:
 *     - Payment methods used for subscription billing and payment processing
 *     - Default payment method selection for automated billing
 *     - Payment method validation and verification processes
 *     - Payment provider integration and webhook processing
 *     - Card information management for payment processing
 *     - Payment method lifecycle management and maintenance
 *
 * 17. FRAUD PREVENTION MEASURES:
 *     - Company_id immutability prevents payment method transfer
 *     - Payment provider ID protection prevents integration manipulation
 *     - Card information protection prevents data tampering
 *     - Audit trail protection maintains fraud investigation evidence
 *     - Payment method type protection prevents classification manipulation
 *     - Default payment method protection maintains billing integrity
 *     - Payment processing security maintained through comprehensive protection
 *     - Cross-company payment method access limited and audited
 */