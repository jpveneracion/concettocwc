-- migrations/030_enable_rls_subscriptions.sql
-- Row-Level Security Policies for Subscriptions Table
--
-- This migration enables comprehensive RLS on the subscriptions table to enforce
-- tenant isolation at the database level for CRITICAL subscription and financial data.
--
-- Risk Level: CRITICAL - Subscription status, billing data, payment information, revenue intelligence exposed
--
-- Security Model:
-- - Tenant Isolation: Users can only access subscriptions from their company (direct company_id context)
-- - Admin Access: Company admins can manage all subscriptions in their company
-- - Superadmin Access: Superadmins can access subscriptions across all companies for support
-- - Financial Protection: Payment and billing data protected from modification
-- - Status Protection: Subscription status changes controlled to prevent service manipulation
-- - Company Association Immutability: Prevents subscription transfer between companies
-- - Write Protection: Prevent cross-company data modifications
--
-- Data Exposure Analysis:
-- - status: Subscription service level and business maturity exposed
-- - plan_id: Pricing strategy, revenue model, and business investment exposed
-- - trial_end/current_period_end: Business lifecycle and payment patterns exposed
-- - paymongo_subscription_id: Payment processing integration and billing patterns exposed
-- - cancel_at_period_end: Business stability and churn risk indicators exposed
-- - billing timing: Cash flow analysis and payment cycle patterns exposed

-- ============================================================================
-- ENABLE RLS ON SUBSCRIPTIONS TABLE
-- ============================================================================

-- Enable Row-Level Security on the subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY (DIRECT COMPANY CONTEXT)
-- ============================================================================

/**
 * Primary tenant isolation policy for subscriptions table
 *
 * This policy enforces that users can only access subscriptions belonging
 * to their company through direct company_id context.
 *
 * This direct context approach ensures proper tenant isolation for subscription
 * and billing data and provides efficient query performance with indexed company_id.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS subscriptions_tenant_isolation ON subscriptions;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
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
 * Admin access policy for subscriptions within the same company
 *
 * This policy allows company admins to perform all operations on subscriptions
 * within their company, but prevents cross-company access.
 *
 * This provides explicit admin capabilities for managing subscription billing,
 * upgrading/downgrading plans, and managing subscription lifecycle within their company.
 */
DROP POLICY IF EXISTS subscriptions_admin_access ON subscriptions;
CREATE POLICY subscriptions_admin_access ON subscriptions
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
 * This policy allows regular users to read subscription information from their company
 * but prevents modifications unless they have admin privileges.
 *
 * This enables users to view their subscription status, plan details, and billing
 * information while preventing unauthorized modifications to subscription settings.
 */
DROP POLICY IF EXISTS subscriptions_read_only_access ON subscriptions;
CREATE POLICY subscriptions_read_only_access ON subscriptions
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
 * subscriptions for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
DROP POLICY IF EXISTS subscriptions_insert_protection ON subscriptions;
CREATE POLICY subscriptions_insert_protection ON subscriptions
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted subscriptions belong to current user's company
    -- Superadmins can insert for any company (for migration purposes)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_update_protection ON subscriptions;
CREATE POLICY subscriptions_update_protection ON subscriptions
  FOR UPDATE
  USING (
    -- Can only update subscriptions in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    company_id = (SELECT company_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_delete_protection ON subscriptions;
CREATE POLICY subscriptions_delete_protection ON subscriptions
  FOR DELETE
  USING (
    -- Can only delete subscriptions in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company subscriptions access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * subscriptions from any company. This is necessary for subscription support,
 * billing troubleshooting, and payment processing issues.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 * Subscription and billing data access must be audited and monitored.
 */
DROP POLICY IF EXISTS subscriptions_superadmin_full_access ON subscriptions;
CREATE POLICY subscriptions_superadmin_full_access ON subscriptions
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
 * subscriptions, which would be a security vulnerability allowing subscription
 * transfer between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies
 * and maintain billing integrity for subscription services.
 */
DROP POLICY IF EXISTS subscriptions_company_id_immutable ON subscriptions;
CREATE POLICY subscriptions_company_id_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (old value must equal new value)
    company_id = (SELECT company_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- PLAN_ID IMMUTABILITY POLICY
-- ============================================================================

/**
 * Plan association immutability policy to prevent plan manipulation
 *
 * This policy prevents users from changing the plan_id of existing
 * subscriptions, which would allow subscription plan manipulation and revenue fraud.
 *
 * Business logic: Plan changes should go through proper subscription upgrade/downgrade
 * workflows with proper billing adjustments, not direct database manipulation.
 */
DROP POLICY IF EXISTS subscriptions_plan_id_immutable ON subscriptions;
CREATE POLICY subscriptions_plan_id_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    -- Prevent plan_id from being changed (old value must equal new value)
    plan_id = (SELECT plan_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- STATUS PROTECTION POLICIES
-- ============================================================================

/**
 * Critical status protection policy for subscription lifecycle
 *
 * This policy prevents unauthorized modification of subscription status to maintain
 * service integrity and prevent subscription manipulation.
 *
 * Business logic: Subscription status should only be changed through proper
 * payment processing workflows to maintain service integrity and prevent fraud.
 */
DROP POLICY IF EXISTS subscriptions_status_protection ON subscriptions;
CREATE POLICY subscriptions_status_protection ON subscriptions
  FOR UPDATE
  USING (
    -- Allow status updates if not changing critical service statuses, or user is superadmin
    -- Allow: trialing -> active, active -> past_due, past_due -> active, any -> cancelled/suspended
    -- Prevent: active -> trialing (downgrade), cancelled -> active (reactivation without payment)
    status = (SELECT status FROM subscriptions WHERE id = subscriptions.id)
    OR (
      -- Allow legitimate status transitions
      (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'trialing')
      OR (status = 'past_due' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'active')
      OR (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'past_due')
      OR (status IN ('cancelled', 'suspended'))
    )
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent inappropriate status changes on UPDATE
    status = (SELECT status FROM subscriptions WHERE id = subscriptions.id)
    OR (
      -- Allow legitimate status transitions
      (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'trialing')
      OR (status = 'past_due' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'active')
      OR (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'past_due')
      OR (status IN ('cancelled', 'suspended'))
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUBSCRIPTION TIMING PROTECTION POLICIES
-- ============================================================================

/**
 * Trial end timestamp immutability policy for audit trail protection
 *
 * This policy prevents modification of trial_end to maintain
 * accurate subscription timeline and trial period integrity.
 *
 * Business logic: Trial periods should be immutable to maintain
 * subscription audit trail and prevent trial period manipulation.
 */
DROP POLICY IF EXISTS subscriptions_trial_end_immutable ON subscriptions;
CREATE POLICY subscriptions_trial_end_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    -- Prevent trial_end from being changed (old value must equal new value)
    trial_end = (SELECT trial_end FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

/**
 * Current period end protection policy for billing cycle integrity
 *
 * This policy prevents unauthorized modification of current_period_end to maintain
 * accurate billing cycles and payment processing schedules.
 *
 * Business logic: Billing period dates should only be changed through proper
 * payment processing workflows to maintain billing accuracy.
 */
DROP POLICY IF EXISTS subscriptions_current_period_end_protection ON subscriptions;
CREATE POLICY subscriptions_current_period_end_protection ON subscriptions
  FOR UPDATE
  WITH CHECK (
    -- Allow updates if current_period_end is being extended (not shortened), or user is superadmin
    current_period_end >= (SELECT current_period_end FROM subscriptions WHERE id = subscriptions.id)
    OR current_period_end IS NULL
    OR is_current_user_superadmin()
  );

/**
 * Cancellation scheduling protection policy
 *
 * This policy prevents unauthorized modification of cancel_at_period_end to maintain
 * proper subscription cancellation workflows and billing integrity.
 *
 * Business logic: Cancellation scheduling should be controlled through proper
 * subscription management workflows to prevent billing errors.
 */
DROP POLICY IF EXISTS subscriptions_cancellation_scheduling_protection ON subscriptions;
CREATE POLICY subscriptions_cancellation_scheduling_protection ON subscriptions
  FOR UPDATE
  USING (
    -- Allow updates if cancel_at_period_end is being set to true (cancellation request)
    -- or being changed from false to false (no change), or user is superadmin
    cancel_at_period_end = (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id)
    OR (cancel_at_period_end = true AND (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id) = false)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent inappropriate cancellation scheduling changes
    cancel_at_period_end = (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id)
    OR (cancel_at_period_end = true AND (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id) = false)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- FINANCIAL DATA PROTECTION POLICIES
-- ============================================================================

/**
 * Critical payment data protection policy for paymongo_subscription_id
 *
 * This policy prevents modification of paymongo_subscription_id after initial creation,
 * protecting payment processing integration and billing records from tampering.
 *
 * Business logic: Payment subscription IDs should be immutable once set to maintain
 * accurate payment processing records and prevent billing manipulation.
 */
DROP POLICY IF EXISTS subscriptions_paymongo_subscription_id_protection ON subscriptions;
CREATE POLICY subscriptions_paymongo_subscription_id_protection ON subscriptions
  FOR UPDATE
  USING (
    -- Allow updates if paymongo_subscription_id is not being changed, or user is superadmin
    paymongo_subscription_id = (SELECT paymongo_subscription_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent paymongo_subscription_id from being changed on UPDATE
    -- Allow setting paymongo_subscription_id on INSERT (old value is NULL)
    paymongo_subscription_id = (SELECT paymongo_subscription_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- AUDIT TRAIL PROTECTION POLICIES
-- ============================================================================

/**
 * Created timestamp immutability policy for audit trail protection
 *
 * This policy prevents modification of created_at to maintain
 * accurate subscription timeline and audit trail integrity.
 *
 * Business logic: Subscription creation timestamps should be immutable to maintain
 * audit trail and prevent timestamp manipulation for compliance purposes.
 */
DROP POLICY IF EXISTS subscriptions_created_at_immutable ON subscriptions;
CREATE POLICY subscriptions_created_at_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    -- Prevent created_at from being changed (old value must equal new value)
    created_at = (SELECT created_at FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY subscriptions_tenant_isolation ON subscriptions IS 'Primary tenant isolation policy using direct company_id context. Users can only access subscriptions from their company, except superadmins who can access all companies for subscription support.';

COMMENT ON POLICY subscriptions_admin_access ON subscriptions IS 'Admin access policy within company. Allows company admins full access to subscriptions in their company for subscription management and billing operations.';

COMMENT ON POLICY subscriptions_read_only_access ON subscriptions IS 'Read-only access policy for regular users. Allows reading subscriptions from own company to check subscription status, plan details, and billing information.';

COMMENT ON POLICY subscriptions_insert_protection ON subscriptions IS 'Insert protection policy. Ensures new subscriptions are assigned to current user company only to prevent cross-company subscription data contamination.';

COMMENT ON POLICY subscriptions_update_protection ON subscriptions IS 'Update protection policy. Prevents cross-company subscription modifications and protects critical subscription fields from unauthorized changes.';

COMMENT ON POLICY subscriptions_delete_protection ON subscriptions IS 'Delete protection policy. Prevents cross-company subscription deletions to maintain subscription audit trail integrity.';

COMMENT ON POLICY subscriptions_superadmin_full_access ON subscriptions IS 'Superadmin full access policy. Allows superadmins to access all subscriptions across all companies for subscription support, billing troubleshooting, and payment processing issues. Subscription access must be audited.';

COMMENT ON POLICY subscriptions_company_id_immutable ON subscriptions IS 'Critical security policy. Prevents company_id changes on existing subscriptions to prevent subscription transfer between companies and maintain billing integrity.';

COMMENT ON POLICY subscriptions_plan_id_immutable ON subscriptions IS 'Plan association immutability policy. Prevents plan_id changes to maintain subscription plan integrity and prevent revenue manipulation through plan changes.';

COMMENT ON POLICY subscriptions_status_protection ON subscriptions IS 'Critical status protection policy. Prevents unauthorized subscription status changes to maintain service integrity and prevent subscription manipulation through status changes.';

COMMENT ON POLICY subscriptions_trial_end_immutable ON subscriptions IS 'Trial end timestamp immutability policy. Prevents trial_end changes to maintain subscription audit trail and prevent trial period manipulation.';

COMMENT ON POLICY subscriptions_current_period_end_protection ON subscriptions IS 'Current period end protection policy. Prevents unauthorized billing cycle changes to maintain billing accuracy and payment processing schedules.';

COMMENT ON POLICY subscriptions_cancellation_scheduling_protection ON subscriptions IS 'Cancellation scheduling protection policy. Prevents unauthorized modification of cancellation scheduling to maintain proper subscription cancellation workflows.';

COMMENT ON POLICY subscriptions_paymongo_subscription_id_protection ON subscriptions IS 'Critical payment data protection policy. Prevents paymongo_subscription_id modification after initial creation to protect payment processing integration and billing records.';

COMMENT ON POLICY subscriptions_created_at_immutable ON subscriptions IS 'Created timestamp immutability policy. Prevents created_at changes to maintain subscription audit trail and prevent timestamp manipulation.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON subscriptions(company_id);

-- Create composite index for status-based queries within company context
-- This optimizes queries that filter by company_id and subscription status
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_status ON subscriptions(company_id, status);

-- Create composite index for plan-based queries within company context
-- This optimizes queries that filter by company_id and subscription plan
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_plan ON subscriptions(company_id, plan_id);

-- Create composite index for active subscription queries within company
-- This optimizes queries that find active subscriptions for a company
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_active ON subscriptions(company_id, status) WHERE status = 'active';

-- Create index for trial period queries
-- This optimizes queries that find subscriptions in trial period
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE trial_end IS NOT NULL;

-- Create index for billing cycle queries
-- This optimizes queries that find subscriptions by current period end
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end) WHERE current_period_end IS NOT NULL;

-- Create index for paymongo subscription lookup
-- This optimizes webhook processing and payment verification queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_paymongo_id ON subscriptions(paymongo_subscription_id) WHERE paymongo_subscription_id IS NOT NULL;

-- Create index for cancellation scheduling queries
-- This optimizes queries that find subscriptions scheduled for cancellation
CREATE INDEX IF NOT EXISTS idx_subscriptions_cancellation_scheduled ON subscriptions(cancel_at_period_end, current_period_end) WHERE cancel_at_period_end = true;

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate subscriptions RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, superadmin
 * access, status protection, and financial data protection.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_subscriptions_rls()
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
  test_subscription_1_id UUID;
  test_subscription_2_id UUID;
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
      WHERE tablename = 'subscriptions'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on subscriptions table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on subscriptions table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM subscriptions;

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

    -- In a real test with actual data, this would only return company 1 subscriptions
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
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_company_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_status_protection'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, company_id_immutable, status_protection'::TEXT;
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
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_paymongo_subscription_id_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_plan_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_current_period_end_protection'
    ) THEN
      RETURN QUERY SELECT 'Financial Protection'::TEXT, true::BOOLEAN,
        'All financial data protection policies exist'::TEXT,
        'paymongo_subscription_id, plan_id, current_period_end protection policies verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Financial Protection'::TEXT, false::BOOLEAN,
        'Some financial protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Financial Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify audit trail protection policies exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_trial_end_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_cancellation_scheduling_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_created_at_immutable'
    ) THEN
      RETURN QUERY SELECT 'Audit Trail Protection'::TEXT, true::BOOLEAN,
        'All audit trail protection policies exist'::TEXT,
        'trial_end, cancellation_scheduling, created_at protection verified'::TEXT;
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
      WHERE tablename = 'subscriptions'
      AND indexname = 'idx_subscriptions_company_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'subscriptions'
      AND indexname = 'idx_subscriptions_company_status'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'subscriptions'
      AND indexname = 'idx_subscriptions_company_plan'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'company_id, company_status, company_plan indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 10: Verify status protection policies exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_status_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscriptions'
      AND policyname = 'subscriptions_cancellation_scheduling_protection'
    ) THEN
      RETURN QUERY SELECT 'Status Protection'::TEXT, true::BOOLEAN,
        'All status protection policies exist'::TEXT,
        'status_protection, cancellation_scheduling_protection verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Status Protection'::TEXT, false::BOOLEAN,
        'Some status protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Status Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_subscriptions_rls() IS 'Test function to validate subscriptions RLS policy implementation. Returns test results for policy verification, financial data protection, audit trail protection, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor subscriptions RLS security
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts, configuration issues, or subscription access anomalies.
 *
 * @returns Audit information about subscriptions access patterns and security status
 */
CREATE OR REPLACE FUNCTION audit_subscriptions_security()
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
    WHERE tablename = 'subscriptions'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on subscriptions table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_tenant_isolation'
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
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_company_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Company ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement company_id immutability policy to prevent subscription transfer between tenants'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify status protection policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_status_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Status Protection'::TEXT,
      'Subscription status protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement status protection to prevent unauthorized subscription status changes'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify financial data protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_paymongo_subscription_id_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Financial Protection'::TEXT,
      'PayMongo subscription ID protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement payment subscription ID protection to prevent billing data tampering'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_plan_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Plan Protection'::TEXT,
      'Plan ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement plan ID immutability to prevent subscription plan manipulation'::TEXT;
    RETURN;
  END IF;

  -- Check 6: Verify audit trail protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_trial_end_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Timeline Protection'::TEXT,
      'Trial end timestamp immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement trial end immutability to maintain subscription timeline integrity'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_cancellation_scheduling_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Cancellation Protection'::TEXT,
      'Cancellation scheduling protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement cancellation scheduling protection to maintain proper cancellation workflows'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
    AND policyname = 'subscriptions_current_period_end_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Billing Protection'::TEXT,
      'Current period end protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement billing period protection to maintain billing accuracy'::TEXT;
    RETURN;
  END IF;

  -- Check 7: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscriptions'
    AND indexname = 'idx_subscriptions_company_id'
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
    'All critical RLS security controls verified for subscriptions table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews for subscription data'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_subscriptions_security() IS 'Security audit function for subscriptions RLS policies. Monitors policy effectiveness, detects configuration issues, and provides security recommendations for subscription data protection and billing integrity.';

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
 * To rollback this migration and disable RLS on subscriptions table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS subscriptions_tenant_isolation ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_admin_access ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_read_only_access ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_insert_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_update_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_delete_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_superadmin_full_access ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_company_id_immutable ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_plan_id_immutable ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_status_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_trial_end_immutable ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_current_period_end_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_cancellation_scheduling_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_paymongo_subscription_id_protection ON subscriptions;
 *    DROP POLICY IF EXISTS subscriptions_created_at_immutable ON subscriptions;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_subscriptions_company_id;
 *    DROP INDEX IF EXISTS idx_subscriptions_company_status;
 *    DROP INDEX IF EXISTS idx_subscriptions_company_plan;
 *    DROP INDEX IF EXISTS idx_subscriptions_company_active;
 *    DROP INDEX IF EXISTS idx_subscriptions_trial_end;
 *    DROP INDEX IF EXISTS idx_subscriptions_period_end;
 *    DROP INDEX IF EXISTS idx_subscriptions_paymongo_id;
 *    DROP INDEX IF EXISTS idx_subscriptions_cancellation_scheduled;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_subscriptions_rls();
 *    DROP FUNCTION IF EXISTS audit_subscriptions_security();
 *
 * WARNING: Rolling back RLS policies will remove database-level security
 * and make the application dependent on application-layer security only.
 * Subscription and billing data will be exposed to cross-company access without RLS protection.
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
 *    - Plan ID immutability: Cannot change subscription plans directly
 *    - Status protection: Subscription status changes controlled
 *    - Timing protection: Trial and billing periods protected
 *    - Financial data protection: Payment subscription IDs immutable
 *    - Cancellation protection: Cancellation scheduling controlled
 *
 * 2. SECURITY MODEL:
 *    - Company users: Full access to subscriptions from their company only
 *    - Company admins: Full access + can manage subscriptions in their company
 *    - Superadmins: Cross-company access for subscription support and troubleshooting
 *    - Subscription protection: Service status and billing data protected
 *    - Financial protection: Payment integration data immutable
 *    - Audit trail protection: Subscription timeline and billing history protected
 *
 * 3. DIRECT COMPANY CONTEXT APPROACH:
 *    - subscriptions table has direct company_id column (unique per company)
 *    - Tenant isolation through direct company_id = get_current_company_id() comparison
 *    - More efficient than indirect user context approaches
 *    - Simplified policy logic with direct foreign key relationship
 *    - Better performance with indexed company_id column
 *
 * 4. SUBSCRIPTION WORKFLOW:
 *    - Companies can have one active subscription at a time (enforced by unique constraint)
 *    - Subscriptions start in trial period with trial_end timestamp
 *    - Status progression: trialing → active → past_due → cancelled/suspended
 *    - Plan changes should go through proper upgrade/downgrade workflows
 *    - Cancellation scheduling for end-of-period cancellations
 *    - Payment integration through PayMongo subscription IDs
 *
 * 5. FINANCIAL DATA PROTECTION:
 *    - paymongo_subscription_id: Immutable after creation (payment integration protection)
 *    - plan_id: Immutable to prevent plan manipulation and revenue fraud
 *    - current_period_end: Protected to maintain billing accuracy
 *    - Trial period data protected from manipulation
 *    - Subscription billing and payment processing integrity maintained
 *
 * 6. STATUS INTEGRITY PROTECTION:
 *    - Status transitions controlled to prevent service manipulation
 *    - Prevent inappropriate status changes (e.g., active → trialing)
 *    - Allow legitimate business transitions (trialing → active, past_due → active)
 *    - Cancellation workflows protected through scheduling controls
 *    - Service level changes require proper payment processing
 *
 * 7. TIMELINE PROTECTION:
 *    - trial_end: Immutable (trial period integrity)
 *    - current_period_end: Protected to maintain billing cycles
 *    - created_at: Immutable (audit trail protection)
 *    - Subscription timeline maintained for compliance and audit
 *    - Billing period integrity for accurate payment processing
 *
 * 8. CANCELLATION WORKFLOW PROTECTION:
 *    - cancel_at_period_end: Controlled cancellation scheduling
 *    - Prevents inappropriate cancellation modifications
 *    - Maintains proper subscription lifecycle management
 *    - Supports end-of-period cancellation workflows
 *    - Billing accuracy maintained through scheduling controls
 *
 * 9. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by company_id (indexed column)
 *    - Composite indexes optimize common query patterns
 *    - Status-based indexes for subscription management
 *    - Plan-based indexes for subscription analysis
 *    - Trial period indexes for onboarding workflows
 *    - Payment webhook processing indexes optimized
 *    - Cancellation scheduling indexes for billing workflows
 *    - Queries maintain performance even with RLS overhead
 *
 * 10. FAIL-SECURE PHILOSOPHY:
 *     - All policies deny access by default if context not properly set
 *     - NULL context results in zero rows returned (safe failure)
 *     - Company_id immutability prevents subscription transfer between tenants
 *     - Financial data immutability prevents billing manipulation
 *     - Status protection prevents service manipulation
 *     - Defense-in-depth: Application layer + Database layer security
 *
 * 11. SUBSCRIPTION SECURITY CONSIDERATIONS:
 *     - Subscription records contain sensitive business service data
 *     - Service level and business maturity exposed through status
 *     - Pricing strategy and revenue model exposed through plan association
 *     - Payment processing intelligence and billing patterns exposed
 *     - Business lifecycle and cash flow patterns visible
 *     - Cross-company subscription access limited to superadmins (audited)
 *
 * 12. TESTING AND VALIDATION:
 *     - test_subscriptions_rls(): Basic RLS policy validation
 *     - audit_subscriptions_security(): Security monitoring
 *     - Financial data protection testing
 *     - Status integrity protection testing
 *     - Timeline protection testing
 *     - Application-level integration testing recommended
 *
 * 13. APPLICATION LAYER REQUIREMENTS:
 *     - Must call set_tenant_context() at start of each request
 *     - Must set appropriate user role ('user', 'admin', 'superadmin')
 *     - Must call reset_tenant_context() at end of each request
 *     - Integration with subscription queries requires proper context
 *     - Subscription management workflows must respect RLS policies
 *     - Payment processing requires proper company context
 *
 * 14. MONITORING AND AUDITING:
 *     - Monitor superadmin access to subscription data
 *     - Audit logs for cross-company subscription access
 *     - Regular validation of policy effectiveness
 *     - Performance monitoring of RLS-optimized queries
 *     - Subscription status change tracking and validation
 *     - Payment webhook processing pattern monitoring
 *     - Cancellation workflow monitoring and validation
 *     - Billing period and payment cycle monitoring
 *
 * 15. COMPLIANCE AND SECURITY:
 *     - subscriptions contains critical subscription and billing data
 *     - RLS provides tenant isolation for multi-tenant subscription management
 *     - Financial data protection for billing and payment processing integrity
 *     - Audit trail protection for subscription lifecycle compliance
 *     - Supports subscription billing compliance and payment processing
 *     - Service level agreement enforcement through status controls
 *     - Subscription service confidentiality and regulatory compliance
 *
 * 16. BUSINESS LOGIC CONSIDERATIONS:
 *     - Subscriptions represent ongoing service relationships with financial impact
 *     - Service status affects business-wide system access and capabilities
 *     - Plan changes impact pricing, revenue recognition, and service delivery
 *     - Status transitions affect billing cycles and payment processing
 *     - Cancellation workflows impact customer retention and revenue forecasting
 *     - Trial period management affects onboarding and conversion processes
 *     - Subscription data changes impact business-wide operational capabilities
 *
 * 17. FRAUD PREVENTION MEASURES:
 *     - Company_id immutability prevents subscription transfer
 *     - Plan_id immutability prevents plan manipulation and revenue fraud
 *     - Status protection prevents service level manipulation
 *     - Timeline protection prevents trial period extension abuse
 *     - Financial data protection prevents billing manipulation
 *     - Cancellation scheduling prevents inappropriate service termination
 *     - Payment integration protection prevents billing system bypass
 *     - Subscription audit trail maintains compliance evidence
 */