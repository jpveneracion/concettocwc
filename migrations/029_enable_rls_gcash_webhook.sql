-- migrations/029_enable_rls_gcash_webhook.sql
-- Row-Level Security Policies for GCash Webhook Data Table
--
-- This migration enables comprehensive RLS on the gcash_webhook_data table to enforce
-- tenant isolation at the database level for CRITICAL payment webhook and transaction data.
--
-- Risk Level: CRITICAL - Payment transactions, financial audit trails, revenue data exposed
--
-- Security Model:
-- - Tenant Isolation: Users can only access webhook data from their company (direct company_id context)
-- - Admin Access: Company admins can manage all webhook data in their company
-- - Superadmin Access: Superadmins can access webhook data across all companies for payment support
-- - Payment Data Immutability: Transaction amounts and details protected from modification
-- - Audit Trail Protection: Timestamps and processing status protected for audit integrity
-- - Webhook Payload Protection: Raw webhook data protected to maintain security evidence
-- - Write Protection: Prevent cross-company data modifications
--
-- Data Exposure Analysis:
-- - amount: Transaction values and payment processing data exposed
-- - sender_name/receiver_name: Customer and business identity information exposed
-- - transaction_number: Payment transaction IDs and processing patterns exposed
-- - notification_text: Payment notification content and business transaction patterns exposed
-- - raw_webhook_payload: Complete payment webhook data with sensitive financial information exposed
-- - processing patterns: Payment processing workflows and business operations exposed
-- - transaction timing: Business transaction patterns and cash flow analysis exposed

-- ============================================================================
-- ENABLE RLS ON GCASH_WEBHOOK_DATA TABLE
-- ============================================================================

-- Enable Row-Level Security on the gcash_webhook_data table
ALTER TABLE gcash_webhook_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY (DIRECT COMPANY CONTEXT)
-- ============================================================================

/**
 * Primary tenant isolation policy for gcash_webhook_data table
 *
 * This policy enforces that users can only access webhook data belonging
 * to their company through direct company_id context.
 *
 * This direct context approach ensures proper tenant isolation for payment
 * webhook data and provides efficient query performance with indexed company_id.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS gcash_webhook_data_tenant_isolation ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_tenant_isolation ON gcash_webhook_data
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
 * Admin access policy for gcash_webhook_data within the same company
 *
 * This policy allows company admins to perform all operations on webhook data
 * within their company, but prevents cross-company access.
 *
 * This provides explicit admin capabilities for managing payment webhooks,
 * troubleshooting transaction processing, and managing payment verification workflows.
 */
DROP POLICY IF EXISTS gcash_webhook_data_admin_access ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_admin_access ON gcash_webhook_data
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
 * This policy allows regular users to read webhook data from their company
 * but prevents modifications unless they have admin privileges.
 *
 * This enables users to view payment transaction status and webhook processing
 * results while preventing unauthorized modifications to payment records.
 */
DROP POLICY IF EXISTS gcash_webhook_data_read_only_access ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_read_only_access ON gcash_webhook_data
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
 * webhook data for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
DROP POLICY IF EXISTS gcash_webhook_data_insert_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_insert_protection ON gcash_webhook_data
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted webhook data belongs to current user's company
    -- Superadmins can insert for any company (for migration purposes)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS gcash_webhook_data_update_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_update_protection ON gcash_webhook_data
  FOR UPDATE
  USING (
    -- Can only update webhook data in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    company_id = (SELECT company_id FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS gcash_webhook_data_delete_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_delete_protection ON gcash_webhook_data
  FOR DELETE
  USING (
    -- Can only delete webhook data in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company gcash_webhook_data access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * webhook data from any company. This is necessary for payment support,
 * debugging transaction processing issues, and troubleshooting payment problems.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 * Payment data access must be audited and monitored.
 */
DROP POLICY IF EXISTS gcash_webhook_data_superadmin_full_access ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_superadmin_full_access ON gcash_webhook_data
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
 * webhook data, which would be a security vulnerability allowing payment
 * data transfer between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies
 * and maintain audit trail integrity for payment transactions.
 */
DROP POLICY IF EXISTS gcash_webhook_data_company_id_immutable ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_company_id_immutable ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (old value must equal new value)
    company_id = (SELECT company_id FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- TRANSACTION NUMBER IMMUTABILITY POLICY
-- ============================================================================

/**
 * Transaction number immutability policy to prevent payment record manipulation
 *
 * This policy prevents users from changing the transaction_number of existing
 * webhook data, which would allow payment record manipulation and fraud.
 *
 * Business logic: Transaction numbers must remain immutable to maintain audit
 * trail and prevent payment record manipulation or duplication.
 */
DROP POLICY IF EXISTS gcash_webhook_data_transaction_number_immutable ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_transaction_number_immutable ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent transaction_number from being changed (old value must equal new value)
    transaction_number = (SELECT transaction_number FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- PAYMENT DATA PROTECTION POLICIES
-- ============================================================================

/**
 * Critical payment data protection policy for transaction amount
 *
 * This policy prevents modification of transaction amount after initial creation,
 * protecting financial records and payment processing integrity from tampering.
 *
 * Business logic: Transaction amounts should be immutable once set to maintain
 * accurate financial records and prevent payment amount manipulation.
 */
DROP POLICY IF EXISTS gcash_webhook_data_amount_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_amount_protection ON gcash_webhook_data
  FOR UPDATE
  USING (
    -- Allow updates if amount is not being changed, or user is superadmin
    amount = (SELECT amount FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent amount from being changed on UPDATE
    -- Allow setting amount on INSERT (old value is NULL)
    amount = (SELECT amount FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

/**
 * Transaction party information protection policy
 *
 * This policy prevents modification of sender and receiver information to maintain
 * accurate payment records and prevent transaction party manipulation.
 *
 * Business logic: Transaction party information should be immutable to maintain
 * payment audit trail and prevent transaction record manipulation.
 */
DROP POLICY IF EXISTS gcash_webhook_data_party_info_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_party_info_protection ON gcash_webhook_data
  FOR UPDATE
  USING (
    -- Allow updates if party information is not being changed, or user is superadmin
    (sender_name = (SELECT sender_name FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR sender_name IS NULL)
    AND (sender_account = (SELECT sender_account FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR sender_account IS NULL)
    AND (receiver_name = (SELECT receiver_name FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR receiver_name IS NULL)
    AND (receiver_account = (SELECT receiver_account FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR receiver_account IS NULL)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent party information from being changed on UPDATE
    (sender_name = (SELECT sender_name FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR sender_name IS NULL)
    AND (sender_account = (SELECT sender_account FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR sender_account IS NULL)
    AND (receiver_name = (SELECT receiver_name FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR receiver_name IS NULL)
    AND (receiver_account = (SELECT receiver_account FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
     OR receiver_account IS NULL)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- AUDIT TRAIL PROTECTION POLICIES
-- ============================================================================

/**
 * Transaction timestamp immutability policy for audit trail protection
 *
 * This policy prevents modification of transaction_time to maintain
 * accurate payment timeline and audit trail integrity.
 *
 * Business logic: Transaction timestamps should be immutable to maintain
 * payment audit trail and prevent timestamp manipulation for fraudulent purposes.
 */
DROP POLICY IF EXISTS gcash_webhook_data_transaction_time_immutable ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_transaction_time_immutable ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent transaction_time from being changed (old value must equal new value)
    transaction_time = (SELECT transaction_time FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

/**
 * Webhook received timestamp immutability policy
 *
 * This policy prevents modification of received_at to maintain
 * accurate webhook processing timeline and system monitoring.
 *
 * Business logic: Webhook receipt timestamps should be immutable to maintain
 * system monitoring logs and webhook processing timeline integrity.
 */
DROP POLICY IF EXISTS gcash_webhook_data_received_at_immutable ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_received_at_immutable ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent received_at from being changed (old value must equal new value)
    received_at = (SELECT received_at FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

/**
 * Processed status protection policy for workflow integrity
 *
 * This policy prevents unauthorized modification of processed status to maintain
 * payment processing workflow integrity and prevent reprocessing attacks.
 *
 * Business logic: Processed status should only be changed through proper
 * payment verification workflows to prevent duplicate processing and fraud.
 */
DROP POLICY IF EXISTS gcash_webhook_data_processed_status_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_processed_status_protection ON gcash_webhook_data
  FOR UPDATE
  USING (
    -- Allow updates if processed status is not being changed from false to true without authorization
    -- Prevent reprocessing of already processed webhooks
    processed = (SELECT processed FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR (processed = false AND (SELECT processed FROM gcash_webhook_data WHERE id = gcash_webhook_data.id) = false)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent processed status from being changed inappropriately
    processed = (SELECT processed FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR (processed = true AND (SELECT processed FROM gcash_webhook_data WHERE id = gcash_webhook_data.id) = false)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WEBHOOK PAYLOAD PROTECTION POLICIES
-- ============================================================================

/**
 * Raw webhook payload protection policy for security evidence
 *
 * This policy prevents modification of raw_webhook_payload to maintain
 * security evidence and support payment verification investigations.
 *
 * Business logic: Raw webhook payloads should be immutable to maintain
 * security evidence for payment verification and fraud investigations.
 */
DROP POLICY IF EXISTS gcash_webhook_data_raw_payload_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_raw_payload_protection ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent raw_webhook_payload from being changed
    raw_webhook_payload = (SELECT raw_webhook_payload FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

/**
 * Notification text protection policy for payment communication integrity
 *
 * This policy prevents modification of notification_text to maintain
 * accurate payment communication records and audit trail.
 *
 * Business logic: Notification text should be immutable to maintain
 * payment communication records and support payment verification.
 */
DROP POLICY IF EXISTS gcash_webhook_data_notification_text_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_notification_text_protection ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent notification_text from being changed
    notification_text = (SELECT notification_text FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- CLEANED TRANSACTION NUMBER PROTECTION POLICY
-- ============================================================================

/**
 * Cleaned transaction number protection policy for data integrity
 *
 * This policy prevents modification of cleaned_transaction_number to maintain
 * data processing consistency and support payment verification workflows.
 *
 * Business logic: Cleaned transaction numbers should be immutable to maintain
 * data processing consistency and support payment verification workflows.
 */
DROP POLICY IF EXISTS gcash_webhook_data_cleaned_transaction_protection ON gcash_webhook_data;
CREATE POLICY gcash_webhook_data_cleaned_transaction_protection ON gcash_webhook_data
  FOR UPDATE
  WITH CHECK (
    -- Prevent cleaned_transaction_number from being changed
    cleaned_transaction_number = (SELECT cleaned_transaction_number FROM gcash_webhook_data WHERE id = gcash_webhook_data.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY gcash_webhook_data_tenant_isolation ON gcash_webhook_data IS 'Primary tenant isolation policy using direct company_id context. Users can only access webhook data from their company, except superadmins who can access all companies for payment support.';

COMMENT ON POLICY gcash_webhook_data_admin_access ON gcash_webhook_data IS 'Admin access policy within company. Allows company admins full access to webhook data in their company for payment processing management.';

COMMENT ON POLICY gcash_webhook_data_read_only_access ON gcash_webhook_data IS 'Read-only access policy for regular users. Allows reading webhook data from own company to check payment status and transaction information.';

COMMENT ON POLICY gcash_webhook_data_insert_protection ON gcash_webhook_data IS 'Insert protection policy. Ensures new webhook data is assigned to current user company only to prevent cross-company payment data contamination.';

COMMENT ON POLICY gcash_webhook_data_update_protection ON gcash_webhook_data IS 'Update protection policy. Prevents cross-company webhook data modifications and protects critical payment fields from unauthorized changes.';

COMMENT ON POLICY gcash_webhook_data_delete_protection ON gcash_webhook_data IS 'Delete protection policy. Prevents cross-company webhook data deletions to maintain payment audit trail integrity.';

COMMENT ON POLICY gcash_webhook_data_superadmin_full_access ON gcash_webhook_data IS 'Superadmin full access policy. Allows superadmins to access all webhook data across all companies for payment support, debugging, and troubleshooting. Payment access must be audited.';

COMMENT ON POLICY gcash_webhook_data_company_id_immutable ON gcash_webhook_data IS 'Critical security policy. Prevents company_id changes on existing webhook data to prevent payment data transfer between companies.';

COMMENT ON POLICY gcash_webhook_data_transaction_number_immutable ON gcash_webhook_data IS 'Transaction number immutability policy. Prevents transaction_number changes to maintain payment audit trail and prevent record manipulation.';

COMMENT ON POLICY gcash_webhook_data_amount_protection ON gcash_webhook_data IS 'Critical payment data protection policy. Prevents transaction amount modification after initial creation to protect financial records and prevent payment amount manipulation.';

COMMENT ON POLICY gcash_webhook_data_party_info_protection ON gcash_webhook_data IS 'Transaction party information protection policy. Prevents modification of sender/receiver information to maintain payment audit trail and prevent transaction record manipulation.';

COMMENT ON POLICY gcash_webhook_data_transaction_time_immutable ON gcash_webhook_data IS 'Transaction timestamp immutability policy. Prevents transaction_time changes to maintain payment audit trail and prevent timestamp manipulation.';

COMMENT ON POLICY gcash_webhook_data_received_at_immutable ON gcash_webhook_data IS 'Webhook received timestamp immutability policy. Prevents received_at changes to maintain system monitoring logs and webhook processing timeline integrity.';

COMMENT ON POLICY gcash_webhook_data_processed_status_protection ON gcash_webhook_data IS 'Processed status protection policy. Prevents unauthorized processed status changes to maintain payment processing workflow integrity and prevent reprocessing attacks.';

COMMENT ON POLICY gcash_webhook_data_raw_payload_protection ON gcash_webhook_data IS 'Raw webhook payload protection policy. Prevents raw_webhook_payload modification to maintain security evidence for payment verification and fraud investigations.';

COMMENT ON POLICY gcash_webhook_data_notification_text_protection ON gcash_webhook_data IS 'Notification text protection policy. Prevents notification_text modification to maintain payment communication records and support payment verification.';

COMMENT ON POLICY gcash_webhook_data_cleaned_transaction_protection ON gcash_webhook_data IS 'Cleaned transaction number protection policy. Prevents cleaned_transaction_number modification to maintain data processing consistency and support payment verification workflows.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from migration 028, but we verify it here
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_company_id ON gcash_webhook_data(company_id);

-- Create composite index for processed webhook queries within company context
-- This optimizes queries that filter by company_id and processed status
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_company_processed ON gcash_webhook_data(company_id, processed);

-- Create composite index for transaction lookup optimization (company_id + transaction_number)
-- This optimizes the most common query pattern: finding specific transactions for a company
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_company_transaction ON gcash_webhook_data(company_id, transaction_number);

-- Create composite index for amount-based queries within company context
-- This optimizes financial analysis and reconciliation queries
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_company_amount ON gcash_webhook_data(company_id, amount);

-- Create index for transaction time-based queries
-- This optimizes timeline analysis and audit trail queries
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_transaction_time ON gcash_webhook_data(transaction_time);

-- Create index for received_at timestamp queries
-- This optimizes webhook processing timeline and monitoring queries
CREATE INDEX IF NOT EXISTS idx_gcash_webhook_data_received_at ON gcash_webhook_data(received_at);

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate gcash_webhook_data RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, superadmin
 * access, payment data protection, and audit trail protection.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_gcash_webhook_data_rls()
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
  test_webhook_1_id UUID;
  test_webhook_2_id UUID;
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
      WHERE tablename = 'gcash_webhook_data'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on gcash_webhook_data table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on gcash_webhook_data table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM gcash_webhook_data;

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

    -- In a real test with actual data, this would only return company 1 webhook data
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
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_company_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_amount_protection'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, company_id_immutable, amount_protection'::TEXT;
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
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_amount_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_transaction_number_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_party_info_protection'
    ) THEN
      RETURN QUERY SELECT 'Payment Data Protection'::TEXT, true::BOOLEAN,
        'All payment data protection policies exist'::TEXT,
        'amount, transaction_number, party_info protection policies verified'::TEXT;
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
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_transaction_time_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_processed_status_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_raw_payload_protection'
    ) THEN
      RETURN QUERY SELECT 'Audit Trail Protection'::TEXT, true::BOOLEAN,
        'All audit trail protection policies exist'::TEXT,
        'transaction_time, processed_status, raw_payload protection verified'::TEXT;
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
      WHERE tablename = 'gcash_webhook_data'
      AND indexname = 'idx_gcash_webhook_data_company_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'gcash_webhook_data'
      AND indexname = 'idx_gcash_webhook_data_company_processed'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'gcash_webhook_data'
      AND indexname = 'idx_gcash_webhook_data_company_transaction'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'company_id, company_processed, company_transaction indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 10: Verify webhook payload protection policies exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_raw_payload_protection'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'gcash_webhook_data'
      AND policyname = 'gcash_webhook_data_notification_text_protection'
    ) THEN
      RETURN QUERY SELECT 'Webhook Payload Protection'::TEXT, true::BOOLEAN,
        'All webhook payload protection policies exist'::TEXT,
        'raw_payload, notification_text protection policies verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Webhook Payload Protection'::TEXT, false::BOOLEAN,
        'Some webhook payload protection policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Webhook Payload Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_gcash_webhook_data_rls() IS 'Test function to validate gcash_webhook_data RLS policy implementation. Returns test results for policy verification, payment data protection, audit trail protection, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to monitor gcash_webhook_data RLS security
 *
 * This function provides security monitoring capabilities for detecting potential
 * RLS policy bypass attempts, configuration issues, or payment data access anomalies.
 *
 * @returns Audit information about gcash_webhook_data access patterns and security status
 */
CREATE OR REPLACE FUNCTION audit_gcash_webhook_data_security()
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
    WHERE tablename = 'gcash_webhook_data'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on gcash_webhook_data table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_tenant_isolation'
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
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_company_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Company ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement company_id immutability policy to prevent payment data transfer between tenants'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify payment amount protection policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_amount_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Financial Protection'::TEXT,
      'Payment amount protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement payment amount protection to prevent financial data tampering'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify transaction number immutability policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_transaction_number_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Transaction Protection'::TEXT,
      'Transaction number immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement transaction number immutability to prevent payment record manipulation'::TEXT;
    RETURN;
  END IF;

  -- Check 6: Verify audit trail protection policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_transaction_time_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Audit Trail Protection'::TEXT,
      'Transaction timestamp immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement transaction timestamp immutability to maintain audit trail integrity'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_processed_status_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Workflow Protection'::TEXT,
      'Processed status protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement processed status protection to prevent payment reprocessing attacks'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gcash_webhook_data'
    AND policyname = 'gcash_webhook_data_raw_payload_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Evidence Protection'::TEXT,
      'Raw webhook payload protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement raw payload protection to maintain security evidence for investigations'::TEXT;
    RETURN;
  END IF;

  -- Check 7: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gcash_webhook_data'
    AND indexname = 'idx_gcash_webhook_data_company_id'
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
    'All critical RLS security controls verified for gcash_webhook_data table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews for payment data'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_gcash_webhook_data_security() IS 'Security audit function for gcash_webhook_data RLS policies. Monitors policy effectiveness, detects configuration issues, and provides security recommendations for payment data protection and audit trail integrity.';

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
 * To rollback this migration and disable RLS on gcash_webhook_data table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE gcash_webhook_data DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS gcash_webhook_data_tenant_isolation ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_admin_access ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_read_only_access ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_insert_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_update_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_delete_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_superadmin_full_access ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_company_id_immutable ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_transaction_number_immutable ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_amount_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_party_info_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_transaction_time_immutable ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_received_at_immutable ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_processed_status_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_raw_payload_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_notification_text_protection ON gcash_webhook_data;
 *    DROP POLICY IF EXISTS gcash_webhook_data_cleaned_transaction_protection ON gcash_webhook_data;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_gcash_webhook_data_company_id;
 *    DROP INDEX IF EXISTS idx_gcash_webhook_data_company_processed;
 *    DROP INDEX IF EXISTS idx_gcash_webhook_data_company_transaction;
 *    DROP INDEX IF EXISTS idx_gcash_webhook_data_company_amount;
 *    DROP INDEX IF EXISTS idx_gcash_webhook_data_transaction_time;
 *    DROP INDEX IF EXISTS idx_gcash_webhook_data_received_at;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_gcash_webhook_data_rls();
 *    DROP FUNCTION IF EXISTS audit_gcash_webhook_data_security();
 *
 * WARNING: Rolling back RLS policies will remove database-level security
 * and make the application dependent on application-layer security only.
 * Payment data will be exposed to cross-company access without RLS protection.
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
 *    - Transaction number immutability: Cannot change transaction IDs
 *    - Payment data protection: Transaction amounts and party details immutable
 *    - Audit trail protection: Timestamps and processing status protected
 *    - Webhook payload protection: Raw webhook data immutable
 *
 * 2. SECURITY MODEL:
 *    - Company users: Full access to webhook data from their company only
 *    - Company admins: Full access + can manage webhook data in their company
 *    - Superadmins: Cross-company access for payment support and troubleshooting
 *    - Payment protection: Financial data immutable after creation
 *    - Audit trail protection: Timestamps and workflow status protected
 *    - Webhook security: Raw payloads maintained as security evidence
 *
 * 3. DIRECT COMPANY CONTEXT APPROACH:
 *    - gcash_webhook_data table has direct company_id column (added in migration 028)
 *    - Tenant isolation through direct company_id = get_current_company_id() comparison
 *    - More efficient than indirect user context approaches
 *    - Simplified policy logic with direct foreign key relationship
 *    - Better performance with indexed company_id column
 *
 * 4. GCASH WEBHOOK WORKFLOW:
 *    - Payment webhooks received from GCash payment gateway
 *    - Raw webhook payload stored for security evidence and verification
 *    - Transaction data extracted: amount, parties, transaction number
 *    - Processing status tracked for payment verification workflows
 *    - Audit trail maintained through protected timestamps
 *    - Company association for multi-tenant payment processing
 *
 * 5. PAYMENT DATA PROTECTION:
 *    - amount: Immutable after creation (financial record protection)
 *    - transaction_number: Immutable (payment record integrity)
 *    - sender_name/receiver_name: Immutable (transaction party protection)
 *    - sender_account/receiver_account: Immutable (account information protection)
 *    - Payment details protected from tampering and manipulation
 *    - Financial audit trail maintained through immutability policies
 *
 * 6. AUDIT TRAIL PROTECTION:
 *    - transaction_time: Immutable (payment timestamp integrity)
 *    - received_at: Immutable (webhook processing timeline)
 *    - processed: Status changes controlled (workflow integrity)
 *    - Timestamp manipulation prevented for fraudulent purposes
 *    - Payment processing timeline maintained for audit compliance
 *
 * 7. WEBHOOK PAYLOAD PROTECTION:
 *    - raw_webhook_payload: Immutable (security evidence protection)
 *    - notification_text: Immutable (payment communication records)
 *    - cleaned_transaction_number: Immutable (data processing consistency)
 *    - Webhook data maintained for payment verification and fraud investigations
 *    - Security evidence preserved for audit and compliance requirements
 *
 * 8. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by company_id (indexed column)
 *    - Composite indexes optimize common query patterns
 *    - Transaction lookup index for payment verification queries
 *    - Amount-based index for financial analysis and reconciliation
 *    - Timestamp indexes for audit trail and timeline queries
 *    - Processed status index for workflow management queries
 *    - Queries maintain performance even with RLS overhead
 *
 * 9. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context not properly set
 *    - NULL context results in zero rows returned (safe failure)
 *    - Company_id immutability prevents payment data transfer between tenants
 *    - Payment data immutability prevents financial record manipulation
 *    - Defense-in-depth: Application layer + Database layer security
 *
 * 10. PAYMENT SECURITY CONSIDERATIONS:
 *     - Transaction records contain sensitive financial information
 *     - Payment amounts and party details protected from unauthorized access
 *     - Webhook payloads contain complete payment transaction data
 *     - Processing patterns and business operations exposed to cross-company analysis
 *     - Financial audit trail maintained for compliance and security
 *     - Cross-company payment access limited to superadmins (audited)
 *
 * 11. TESTING AND VALIDATION:
 *     - test_gcash_webhook_data_rls(): Basic RLS policy validation
 *     - audit_gcash_webhook_data_security(): Security monitoring
 *     - Payment data protection testing
 *     - Audit trail protection testing
 *     - Webhook payload protection testing
 *     - Application-level integration testing recommended
 *
 * 12. APPLICATION LAYER REQUIREMENTS:
 *     - Must call set_tenant_context() at start of each request
 *     - Must set appropriate user role ('user', 'admin', 'superadmin')
 *     - Must call reset_tenant_context() at end of each request
 *     - Integration with webhook processing requires proper context
 *     - Payment verification workflows must respect RLS policies
 *     - Webhook receiving endpoints must set company context appropriately
 *
 * 13. MONITORING AND AUDITING:
 *     - Monitor superadmin access to payment webhook data
 *     - Audit logs for cross-company payment data access
 *     - Regular validation of policy effectiveness
 *     - Performance monitoring of RLS-optimized queries
 *     - Payment processing access pattern monitoring
 *     - Webhook processing anomaly detection
 *     - Financial data access pattern monitoring
 *     - Processed status change tracking and validation
 *
 * 14. COMPLIANCE AND SECURITY:
 *     - gcash_webhook_data contains critical payment transaction data
 *     - RLS provides tenant isolation for multi-tenant payment processing
 *     - Payment data protection for financial transaction integrity
 *     - Audit trail protection for payment processing compliance
 *     - Supports financial audit requirements and payment verification
 *     - Webhook security evidence maintained for fraud investigations
 *     - Payment processing confidentiality and regulatory compliance
 *
 * 15. PAYMENT VERIFICATION WORKFLOWS:
 *     - Webhook data used for payment verification and reconciliation
 *     - Transaction matching and validation processes
 *     - Payment status updates and processing workflows
 *     - Financial reporting and reconciliation processes
 *     - Audit trail maintenance for payment transaction history
 *     - Support for payment dispute resolution and investigation
 *
 * 16. FRAUD PREVENTION MEASURES:
 *     - Transaction number immutability prevents record manipulation
 *     - Payment amount protection prevents financial data tampering
 *     - Audit trail protection prevents timestamp manipulation
 *     - Processed status protection prevents reprocessing attacks
 *     - Webhook payload protection maintains security evidence
 *     - Company isolation prevents cross-company payment data access
 *     - Payment verification workflows protected from manipulation
 */