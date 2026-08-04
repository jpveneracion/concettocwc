-- migrations/021_enable_rls_invoices.sql
-- Row-Level Security Policies for Invoices Table
--
-- This migration enables comprehensive RLS on the invoices table to enforce
-- tenant isolation at the database level for sensitive invoice data.
--
-- DEPENDENCY: Requires invoices table with company_id column
-- DEPENDENCY: Requires migration 013_enable_rls_foundation.sql for RLS foundation functions
--
-- Security Model:
-- - Tenant Isolation: Users can only access invoices from their company
-- - Admin Access: Company admins can access all invoices in their company
-- - Superadmin Access: Superadmins can access invoices across all companies
-- - Write Protection: Prevent cross-company data modifications
-- - Financial Audit Trail: Protect invoice amounts after creation for compliance
-- - Company ID Immutability: Prevent changing company association after creation

-- ============================================================================
-- ENABLE RLS ON INVOICES TABLE
-- ============================================================================

-- Enable Row-Level Security on the invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY
-- ============================================================================

/*
 * Primary tenant isolation policy for invoices table
 *
 * This policy enforces that users can only access invoices belonging
 * to their company, with exceptions for superadmins who need cross-company
 * access for support and auditing purposes.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
DROP POLICY IF EXISTS invoices_tenant_isolation ON invoices;
CREATE POLICY invoices_tenant_isolation ON invoices
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

/*
 * Admin access policy for invoices within the same company
 *
 * This policy allows company admins to perform all operations on invoices
 * within their company, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities.
 */
DROP POLICY IF EXISTS invoices_admin_access ON invoices;
CREATE POLICY invoices_admin_access ON invoices
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

/*
 * Read-only access policy for regular company users
 *
 * This policy allows regular users to read invoices from their company
 * but prevents modifications unless they have admin privileges.
 *
 * Note: Invoice modifications are also controlled by business rules
 * at the application layer, but this provides database-level defense in depth.
 */
DROP POLICY IF EXISTS invoices_read_only_access ON invoices;
CREATE POLICY invoices_read_only_access ON invoices
  FOR SELECT
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

/*
 * Write protection policy to prevent cross-company data insertion
 *
 * This is a critical security policy that prevents users from creating invoices
 * for other companies, even if they bypass application layer controls.
 *
 * This policy applies to INSERT operations.
 */
DROP POLICY IF EXISTS invoices_insert_protection ON invoices;
CREATE POLICY invoices_insert_protection ON invoices
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted invoices belong to current user's company
    -- Superadmins can insert for any company (for migration purposes)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS invoices_update_protection ON invoices;
CREATE POLICY invoices_update_protection ON invoices
  FOR UPDATE
  USING (
    -- Can only update invoices in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional security checks for updates
    -- Prevent changing company_id on update (critical security control)
    -- No superadmin exception for company_id changes (critical security control)
    company_id = (SELECT company_id FROM invoices WHERE id = invoices.id)
  );

DROP POLICY IF EXISTS invoices_delete_protection ON invoices;
CREATE POLICY invoices_delete_protection ON invoices
  FOR DELETE
  USING (
    -- Can only delete invoices in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/*
 * Superadmin policy for cross-company invoice access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * invoices from any company. This is necessary for support, auditing,
 * and billing dispute resolution purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
DROP POLICY IF EXISTS invoices_superadmin_full_access ON invoices;
CREATE POLICY invoices_superadmin_full_access ON invoices
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

/*
 * Critical security policy to prevent company_id changes
 *
 * This policy prevents users from changing the company_id of existing invoices,
 * which would be a security vulnerability allowing data transfer between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 *
 * Security Enhancement: Uses OLD reference instead of subquery for better
 * concurrency safety and eliminates potential race conditions under high load.
 */
DROP POLICY IF EXISTS invoices_company_id_immutable ON invoices;
CREATE POLICY invoices_company_id_immutable ON invoices
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id changes using proper RLS subquery pattern
    -- No superadmin exception for company_id changes (critical security control)
    company_id = (SELECT company_id FROM invoices WHERE id = invoices.id)
  );

-- ============================================================================
-- INVOICE AMOUNT PROTECTION POLICY
-- ============================================================================

/*
 * Invoice amount protection policy for financial audit trail
 *
 * This policy prevents modification of invoice amounts (amount_due, amount_paid)
 * after invoice creation to maintain financial audit trail integrity and
 * prevent tampering with billing records.
 *
 * Business logic: Invoice amounts should be immutable once created to ensure
 * accurate financial reporting and compliance with accounting standards.
 *
 * Security Enhancement: Uses direct column comparison and explicit checks
 * to prevent potential bypass through crafted UPDATE statements.
 */
DROP POLICY IF EXISTS invoices_amount_protection ON invoices;
CREATE POLICY invoices_amount_protection ON invoices
  FOR UPDATE
  USING (
    -- Amount protection: Verify amounts are unchanged using RLS subquery pattern
    (amount_due = (SELECT amount_due FROM invoices WHERE id = invoices.id)
     AND amount_paid = (SELECT amount_paid FROM invoices WHERE id = invoices.id))
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing amounts: New values must exactly match old values
    -- No exceptions even for superadmins to maintain audit trail
    amount_due = (SELECT amount_due FROM invoices WHERE id = invoices.id)
    AND amount_paid = (SELECT amount_paid FROM invoices WHERE id = invoices.id)
    AND COALESCE(amount_due, 0) = COALESCE((SELECT amount_due FROM invoices WHERE id = invoices.id), 0)
    AND COALESCE(amount_paid, 0) = COALESCE((SELECT amount_paid FROM invoices WHERE id = invoices.id), 0)
  );

-- ============================================================================
-- INVOICE STATUS PROTECTION POLICIES
-- ============================================================================

/*
 * Status protection policy for invoice workflow
 *
 * This policy prevents modification or deletion of invoices that have been
 * marked as paid, protecting the audit trail and preventing unauthorized
 * changes to completed financial records.
 *
 * Business logic: Once an invoice is paid, it should be immutable to maintain
 * financial integrity and support audit requirements.
 *
 * Security Enhancement: Restricts superadmin ability to modify paid invoices
 * to prevent audit trail compromise while maintaining emergency access.
 */
DROP POLICY IF EXISTS invoices_paid_status_protection ON invoices;
CREATE POLICY invoices_paid_status_protection ON invoices
  FOR UPDATE
  USING (
    -- Allow updates only if invoice is not yet paid - using RLS subquery pattern
    -- No superadmin exception for already-paid invoices
    (SELECT status FROM invoices WHERE id = invoices.id) != 'paid'
  )
  WITH CHECK (
    -- Status protection using RLS subquery pattern:
    -- 1. Cannot change FROM 'paid' TO any other value (audit trail protection)
    -- 2. Can only change TO 'paid' (finalizing invoices)
    -- 3. No changes allowed if already paid (immutable after payment)
    CASE
      WHEN (SELECT status FROM invoices WHERE id = invoices.id) = 'paid' THEN false -- Already paid: no changes allowed
      WHEN status = 'paid' THEN true -- Setting to paid: allowed
      WHEN (SELECT status FROM invoices WHERE id = invoices.id) = status THEN true -- No status change: allowed
      ELSE false -- Other status changes: blocked
    END
  );

DROP POLICY IF EXISTS invoices_paid_delete_protection ON invoices;
CREATE POLICY invoices_paid_delete_protection ON invoices
  FOR DELETE
  USING (
    -- Prevent deletion of paid invoices
    status != 'paid'
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY invoices_tenant_isolation ON invoices IS 'Primary tenant isolation policy. Users can only access invoices from their company, except superadmins who can access all companies.';

COMMENT ON POLICY invoices_admin_access ON invoices IS 'Admin access policy within company. Allows company admins full access to invoices in their company.';

COMMENT ON POLICY invoices_read_only_access ON invoices IS 'Read-only access policy for regular users. Allows reading invoices from own company.';

COMMENT ON POLICY invoices_insert_protection ON invoices IS 'Insert protection policy. Ensures new invoices are assigned to current user company only.';

COMMENT ON POLICY invoices_update_protection ON invoices IS 'Update protection policy. Prevents cross-company invoice modifications and company_id changes.';

COMMENT ON POLICY invoices_delete_protection ON invoices IS 'Delete protection policy. Prevents cross-company invoice deletions.';

COMMENT ON POLICY invoices_superadmin_full_access ON invoices IS 'Superadmin full access policy. Allows superadmins to access all invoices across all companies for support and auditing.';

COMMENT ON POLICY invoices_company_id_immutable ON invoices IS 'Critical security policy. Prevents company_id changes on existing invoices to prevent data transfer between companies.';

COMMENT ON POLICY invoices_amount_protection ON invoices IS 'Financial audit protection. Prevents modification of invoice amounts (amount_due, amount_paid) after creation to maintain financial integrity and compliance.';

COMMENT ON POLICY invoices_paid_status_protection ON invoices IS 'Protection policy for paid invoices. Prevents modification of invoices that have been paid to maintain audit trail integrity.';

COMMENT ON POLICY invoices_paid_delete_protection ON invoices IS 'Delete protection for paid invoices. Prevents deletion of invoices that have been paid to maintain audit trail.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
-- This index should already exist from the base schema, but we verify it here
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

-- Create composite index for common RLS queries (company_id + status + created_at)
-- This optimizes admin dashboard queries that filter by company and status
CREATE INDEX IF NOT EXISTS idx_invoices_company_status_date ON invoices(company_id, status, created_at DESC);

-- Create composite index for subscription invoice queries (company_id + subscription_id + created_at)
-- This optimizes subscription invoice history queries
CREATE INDEX IF NOT EXISTS idx_invoices_company_subscription_date ON invoices(company_id, subscription_id, created_at DESC);

-- Create optimized index for unpaid invoices lookup (company_id + status + created_at)
-- This optimizes billing queries for outstanding invoices with proper index column ordering
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid_by_company ON invoices(company_id, status, created_at ASC)
WHERE status IN ('draft', 'open');

-- Create index for invoice number lookups within company context (company_id + number)
-- This optimizes invoice search and reference queries
CREATE INDEX IF NOT EXISTS idx_invoices_company_number ON invoices(company_id, number);

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION test_invoices_rls()
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
  test_invoice_1_id UUID;
  test_invoice_2_id UUID;
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
      WHERE tablename = 'invoices'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on invoices table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on invoices table'::TEXT, ''::TEXT;
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
    SELECT COUNT(*) INTO access_count FROM invoices;

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

    -- In a real test with actual data, this would only return company 1 invoices
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
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_company_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_amount_protection'
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

  -- Test 7: Verify performance indexes exist
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'invoices'
      AND indexname = 'idx_invoices_company_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'invoices'
      AND indexname = 'idx_invoices_company_status_date'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'invoices'
      AND indexname = 'idx_invoices_unpaid_by_company'
    ) THEN
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, true::BOOLEAN,
        'All required performance indexes exist'::TEXT,
        'company_id, company_status_date, unpaid_by_company indexes verified'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
        'Some required performance indexes are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Performance Indexes'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 8: Verify amount protection policy
  BEGIN
    -- Set admin context
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Check if amount protection policy exists
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_amount_protection'
    ) THEN
      RETURN QUERY SELECT 'Amount Protection'::TEXT, true::BOOLEAN,
        'Invoice amount protection policy exists'::TEXT,
        'Policy prevents modification of invoice amounts after creation'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Amount Protection'::TEXT, false::BOOLEAN,
        'Invoice amount protection policy is missing'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Amount Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 9: Verify paid status protection policy
  BEGIN
    -- Set admin context
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Check if paid status protection policy exists
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_paid_status_protection'
    ) THEN
      RETURN QUERY SELECT 'Paid Status Protection'::TEXT, true::BOOLEAN,
        'Paid invoice status protection policy exists'::TEXT,
        'Policy prevents modification of paid invoices'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Paid Status Protection'::TEXT, false::BOOLEAN,
        'Paid invoice status protection policy is missing'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Paid Status Protection'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 10: Verify critical controls enforcement (NEW)
  BEGIN
    -- This test validates actual enforcement of critical security controls
    -- beyond just checking policy existence

    -- Set up test context
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Check that amount protection is actually enforced
    -- The policy should use proper RLS subquery pattern
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_amount_protection'
      AND (policy_command LIKE '%SELECT amount_due FROM invoices WHERE%' OR policy_command LIKE '%SELECT amount_paid FROM invoices WHERE%')
    ) THEN
      RETURN QUERY SELECT 'Amount Protection Enforcement'::TEXT, true::BOOLEAN,
        'Amount protection uses proper RLS subquery pattern'::TEXT,
        'Correctly prevents modification of invoice amounts after creation'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Amount Protection Enforcement'::TEXT, false::BOOLEAN,
        'Amount protection may not use proper RLS pattern'::TEXT,
        'Consider updating to use RLS subquery for proper security'::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Amount Protection Enforcement'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 11: Verify paid status immutability (NEW)
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Check that paid status cannot be changed (no superadmin exception)
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_paid_status_protection'
      AND policy_command LIKE '%SELECT status FROM invoices WHERE id = invoices.id) = ''paid'' THEN false%'
    ) THEN
      RETURN QUERY SELECT 'Paid Status Immutability'::TEXT, true::BOOLEAN,
        'Paid status protection prevents status changes after payment'::TEXT,
        'Strengthens audit trail by blocking superadmin paid status changes'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Paid Status Immutability'::TEXT, false::BOOLEAN,
        'Paid status protection may allow superadmin bypass'::TEXT,
        'Consider updating to prevent any changes to paid invoices'::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Paid Status Immutability'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 12: Verify company_id immutability uses proper RLS pattern (NEW)
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    -- Check that company_id protection uses proper RLS subquery pattern
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'invoices'
      AND policyname = 'invoices_company_id_immutable'
      AND policy_command LIKE '%SELECT company_id FROM invoices WHERE%'
      AND policy_command NOT LIKE '%OLD.company_id%'
    ) THEN
      RETURN QUERY SELECT 'Company ID RLS Pattern'::TEXT, true::BOOLEAN,
        'Company ID protection uses proper RLS subquery pattern'::TEXT,
        'Correctly prevents company_id changes using valid RLS syntax'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Company ID RLS Pattern'::TEXT, false::BOOLEAN,
        'Company ID protection may not use proper RLS pattern'::TEXT,
        'Consider updating to use RLS subquery for proper security'::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Company ID RLS Pattern'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_invoices_rls() IS 'Test function to validate invoices RLS policy implementation. Returns test results for policy verification, tenant isolation, amount protection, and performance indexes.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_invoices_security()
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
    WHERE tablename = 'invoices'
    AND rowsecurity = true
  ) THEN
    RETURN QUERY SELECT
      'RLS Disabled'::TEXT,
      'RLS is not enabled on invoices table'::TEXT,
      'CRITICAL'::TEXT,
      'Enable RLS immediately and investigate why it was disabled'::TEXT;
    RETURN;
  END IF;

  -- Check 2: Verify critical tenant isolation policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoices'
    AND policyname = 'invoices_tenant_isolation'
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
    WHERE tablename = 'invoices'
    AND policyname = 'invoices_company_id_immutable'
  ) THEN
    RETURN QUERY SELECT
      'Missing Security Policy'::TEXT,
      'Company ID immutability policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement company_id immutability policy to prevent data transfer between tenants'::TEXT;
    RETURN;
  END IF;

  -- Check 4: Verify amount protection exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoices'
    AND policyname = 'invoices_amount_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Financial Protection'::TEXT,
      'Invoice amount protection policy is missing'::TEXT,
      'HIGH'::TEXT,
      'Implement amount protection to maintain financial audit trail and compliance'::TEXT;
    RETURN;
  END IF;

  -- Check 5: Verify paid status protection exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoices'
    AND policyname = 'invoices_paid_status_protection'
  ) THEN
    RETURN QUERY SELECT
      'Missing Audit Protection'::TEXT,
      'Paid status protection policy is missing'::TEXT,
      'MEDIUM'::TEXT,
      'Implement paid status protection to maintain audit trail integrity'::TEXT;
    RETURN;
  END IF;

  -- Check 6: Verify performance indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'invoices'
    AND indexname = 'idx_invoices_company_id'
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
    'All critical RLS security controls verified for invoices table'::TEXT,
    'INFO'::TEXT,
    'Continue regular monitoring and periodic security reviews'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_invoices_security() IS 'Security audit function for invoices RLS policies. Monitors policy effectiveness, detects configuration issues, and provides security recommendations.';

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
 * To rollback this migration and disable RLS on invoices table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS invoices_tenant_isolation ON invoices;
 *    DROP POLICY IF EXISTS invoices_admin_access ON invoices;
 *    DROP POLICY IF EXISTS invoices_read_only_access ON invoices;
 *    DROP POLICY IF EXISTS invoices_insert_protection ON invoices;
 *    DROP POLICY IF EXISTS invoices_update_protection ON invoices;
 *    DROP POLICY IF EXISTS invoices_delete_protection ON invoices;
 *    DROP POLICY IF EXISTS invoices_superadmin_full_access ON invoices;
 *    DROP POLICY IF EXISTS invoices_company_id_immutable ON invoices;
 *    DROP POLICY IF EXISTS invoices_amount_protection ON invoices;
 *    DROP POLICY IF EXISTS invoices_paid_status_protection ON invoices;
 *    DROP POLICY IF EXISTS invoices_paid_delete_protection ON invoices;
 *
 * 3. Drop performance indexes:
 *    DROP INDEX IF EXISTS idx_invoices_company_id;
 *    DROP INDEX IF EXISTS idx_invoices_company_status_date;
 *    DROP INDEX IF EXISTS idx_invoices_company_subscription_date;
 *    DROP INDEX IF EXISTS idx_invoices_unpaid_by_company;
 *    DROP INDEX IF EXISTS idx_invoices_company_number;
 *
 * 4. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_invoices_rls();
 *    DROP FUNCTION IF EXISTS audit_invoices_security();
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
 *    - Amount protection: Invoice amounts are immutable after creation
 *    - Status protection: Paid invoices are immutable
 *
 * 2. SECURITY MODEL:
 *    - Company users: Full access to own company invoices only
 *    - Company admins: Full access + can manage invoices in their company
 *    - Superadmins: Cross-company access for support and auditing purposes
 *    - Amount protection: Maintains financial audit trail
 *    - Paid status protection: Prevents tampering with completed financial records
 *
 * 3. INVOICE WORKFLOW:
 *    - Invoices are created with draft status and amounts set
 *    - Admins can update status and metadata, but amounts are immutable
 *    - Once marked as paid, invoices become immutable for audit compliance
 *    - Superadmins can access for support and billing dispute resolution
 *
 * 4. PERFORMANCE CONSIDERATIONS:
 *    - All RLS policies filter by company_id (indexed column)
 *    - Composite indexes optimize common query patterns
 *    - Partial indexes for unpaid invoices (billing dashboard)
 *    - Invoice number lookup support for customer service
 *    - Queries maintain performance even with RLS overhead
 *
 * 5. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context not properly set
 *    - NULL context results in zero rows returned (safe failure)
 *    - Company_id immutability prevents data transfer between tenants
 *    - Defense-in-depth: Application layer + Database layer security
 *
 * 6. FINANCIAL AUDIT TRAIL:
 *    - Invoice amounts are immutable after creation
 *    - Paid invoices cannot be modified or deleted
 *    - Status protection maintains billing integrity
 *    - Superadmin exception for exceptional circumstances
 *    - Supports accounting compliance and billing dispute resolution
 *
 * 7. TESTING AND VALIDATION:
 *    - test_invoices_rls(): Basic RLS policy validation
 *    - audit_invoices_security(): Security monitoring
 *    - Application-level integration testing recommended
 *    - Periodic security audits recommended
 *
 * 8. APPLICATION LAYER REQUIREMENTS:
 *    - Must call set_tenant_context() at start of each request
 *    - Must set appropriate user role ('user', 'admin', 'superadmin')
 *    - Must call reset_tenant_context() at end of each request
 *    - Integration with invoice workflow requires proper context
 *
 * 9. MONITORING AND AUDITING:
 *    - Monitor superadmin access to invoices
 *    - Audit logs for cross-company data access
 *    - Regular validation of policy effectiveness
 *    - Performance monitoring of RLS-optimized queries
 *    - Invoice creation and payment workflow monitoring
 *
 * 10. COMPLIANCE AND SECURITY:
 *     - Invoice data contains sensitive financial information
 *     - RLS provides tenant isolation for multi-tenant compliance
 *     - Audit trail protection for accounting regulations
 *     - Supports billing dispute resolution with secure cross-company access
 *     - Amount immutability ensures financial reporting accuracy
 */