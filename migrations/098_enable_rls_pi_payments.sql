-- migrations/098_enable_rls_pi_payments.sql
-- Row-Level Security Policies for Pi Payments Table
--
-- DEPENDENCY: Requires migration 097_create_pi_payments_table.sql
--
-- Security Model (mirrors payment_verifications):
-- - Tenant Isolation: Users can only access Pi payments from their company
-- - Admin Access: Company admins can access all Pi payments in their company
-- - Superadmin Access: Superadmins can access Pi payments across all companies
-- - Write Protection: Prevent cross-company data modifications
-- - Completed payments are immutable (audit trail protection)

-- ============================================================================
-- ENABLE RLS ON PI PAYMENTS TABLE
-- ============================================================================

ALTER TABLE pi_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BASE TENANT ISOLATION POLICY
-- ============================================================================

DROP POLICY IF EXISTS pi_payments_tenant_isolation ON pi_payments;
CREATE POLICY pi_payments_tenant_isolation ON pi_payments
  FOR ALL
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- ADMIN ACCESS POLICY WITHIN COMPANY
-- ============================================================================

DROP POLICY IF EXISTS pi_payments_admin_access ON pi_payments;
CREATE POLICY pi_payments_admin_access ON pi_payments
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

DROP POLICY IF EXISTS pi_payments_read_only_access ON pi_payments;
CREATE POLICY pi_payments_read_only_access ON pi_payments
  FOR SELECT
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS pi_payments_insert_protection ON pi_payments;
CREATE POLICY pi_payments_insert_protection ON pi_payments
  FOR INSERT
  WITH CHECK (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS pi_payments_update_protection ON pi_payments;
CREATE POLICY pi_payments_update_protection ON pi_payments
  FOR UPDATE
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM pi_payments WHERE id = pi_payments.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS pi_payments_delete_protection ON pi_payments;
CREATE POLICY pi_payments_delete_protection ON pi_payments
  FOR DELETE
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

DROP POLICY IF EXISTS pi_payments_superadmin_full_access ON pi_payments;
CREATE POLICY pi_payments_superadmin_full_access ON pi_payments
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

DROP POLICY IF EXISTS pi_payments_company_id_immutable ON pi_payments;
CREATE POLICY pi_payments_company_id_immutable ON pi_payments
  FOR UPDATE
  WITH CHECK (
    company_id = (SELECT company_id FROM pi_payments WHERE id = pi_payments.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- COMPLETED PAYMENT PROTECTION POLICIES
-- ============================================================================

-- Prevent modification of completed Pi payments (audit trail integrity)
DROP POLICY IF EXISTS pi_payments_completed_status_protection ON pi_payments;
CREATE POLICY pi_payments_completed_status_protection ON pi_payments
  FOR UPDATE
  USING (
    status != 'completed'
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    status != 'completed'
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS pi_payments_completed_delete_protection ON pi_payments;
CREATE POLICY pi_payments_completed_delete_protection ON pi_payments
  FOR DELETE
  USING (
    status != 'completed'
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY pi_payments_tenant_isolation ON pi_payments IS 'Primary tenant isolation policy. Users can only access Pi payments from their company, except superadmins who can access all companies.';

COMMENT ON POLICY pi_payments_admin_access ON pi_payments IS 'Admin access policy within company. Allows company admins full access to Pi payments in their company.';

COMMENT ON POLICY pi_payments_read_only_access ON pi_payments IS 'Read-only access policy for regular users. Allows reading Pi payments from own company.';

COMMENT ON POLICY pi_payments_insert_protection ON pi_payments IS 'Insert protection policy. Ensures new Pi payments are assigned to current user company only.';

COMMENT ON POLICY pi_payments_update_protection ON pi_payments IS 'Update protection policy. Prevents cross-company Pi payment modifications and company_id changes.';

COMMENT ON POLICY pi_payments_delete_protection ON pi_payments IS 'Delete protection policy. Prevents cross-company Pi payment deletions.';

COMMENT ON POLICY pi_payments_superadmin_full_access ON pi_payments IS 'Superadmin full access policy. Allows superadmins to access all Pi payments across all companies for support and auditing.';

COMMENT ON POLICY pi_payments_company_id_immutable ON pi_payments IS 'Critical security policy. Prevents company_id changes on existing Pi payments to prevent data transfer between companies.';

COMMENT ON POLICY pi_payments_completed_status_protection ON pi_payments IS 'Protection policy for completed Pi payments. Prevents modification of payments that have completed to maintain audit trail integrity.';

COMMENT ON POLICY pi_payments_completed_delete_protection ON pi_payments IS 'Delete protection for completed Pi payments. Prevents deletion of payments that have completed to maintain audit trail.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure company_id index exists for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_pi_payments_company_id ON pi_payments(company_id);

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

/*
 * ROLLBACK INSTRUCTIONS:
 *
 * 1. Disable RLS:
 *    ALTER TABLE pi_payments DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS pi_payments_tenant_isolation ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_admin_access ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_read_only_access ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_insert_protection ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_update_protection ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_delete_protection ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_superadmin_full_access ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_company_id_immutable ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_completed_status_protection ON pi_payments;
 *    DROP POLICY IF EXISTS pi_payments_completed_delete_protection ON pi_payments;
 */
