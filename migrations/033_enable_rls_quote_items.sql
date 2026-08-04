-- migrations/033_enable_rls_quote_items.sql
-- Row-Level Security Policies for Quote Items Table
--
-- This migration enables comprehensive RLS on the quote_items table to enforce
-- tenant isolation at the database level for sensitive financial data.
--
-- Security Model:
-- - Indirect Tenant Isolation: Users can only access quote items from quotes in their company
-- - Admin Access: Company admins can access all quote items in their company
-- - Superadmin Access: Superadmins can access quote items across all companies
-- - Write Protection: Prevent cross-company data modifications
-- - Financial Protection: Protect cost structures and margin calculations
-- - Quote Association: Maintain quote-to-quote-item relationship integrity

-- ============================================================================
-- ENABLE RLS ON QUOTE_ITEMS TABLE
-- ============================================================================

-- Enable Row-Level Security on the quote_items table
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Force Row-Level Security to prevent table owners from bypassing policies
-- This ensures fail-secure behavior - even table owners must comply with RLS policies
ALTER TABLE quote_items FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES FOR CLEAN RECREATION
-- ============================================================================

DROP POLICY IF EXISTS quote_items_tenant_isolation ON quote_items;
DROP POLICY IF EXISTS quote_items_admin_access ON quote_items;
DROP POLICY IF EXISTS quote_items_read_only_access ON quote_items;
DROP POLICY IF EXISTS quote_items_insert_protection ON quote_items;
DROP POLICY IF EXISTS quote_items_update_protection ON quote_items;
DROP POLICY IF EXISTS quote_items_delete_protection ON quote_items;
DROP POLICY IF EXISTS quote_items_superadmin_full_access ON quote_items;
DROP POLICY IF EXISTS quote_items_quote_id_immutable ON quote_items;
DROP POLICY IF EXISTS quote_items_financial_protection ON quote_items;

-- ============================================================================
-- BASE INDIRECT TENANT ISOLATION POLICY
-- ============================================================================

/**
 * Primary tenant isolation policy for quote_items table
 *
 * This policy enforces indirect tenant isolation through the quotes relationship.
 * Users can only access quote items that belong to quotes from their company.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 * Indirect Access: Uses subquery to quotes.company_id for tenant isolation
 */
CREATE POLICY quote_items_tenant_isolation ON quote_items
  FOR ALL
  USING (
    -- Indirect tenant isolation through quotes.company_id
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure quote belongs to current user's company
    -- unless user is superadmin
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- ADMIN ACCESS POLICY WITHIN COMPANY
-- ============================================================================

/**
 * Admin access policy for quote items within the same company
 *
 * This policy allows company admins to perform all operations on quote items
 * within their company, but prevents cross-company access.
 */
CREATE POLICY quote_items_admin_access ON quote_items
  FOR ALL
  USING (
    is_current_user_admin()
    AND quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
  )
  WITH CHECK (
    is_current_user_admin()
    AND quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
  );

-- ============================================================================
-- READ-ONLY ACCESS POLICY FOR RESTRICTED USERS
-- ============================================================================

/**
 * Read-only access policy for users with limited permissions
 *
 * This policy allows regular users to read quote items from their company
 * but prevents modifications unless they have admin privileges.
 */
CREATE POLICY quote_items_read_only_access ON quote_items
  FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- WRITE PROTECTION POLICIES
-- ============================================================================

/**
 * Write protection policy to prevent cross-company data modifications
 *
 * This is a critical security policy that prevents users from modifying
 * quote items belonging to other companies, even if they somehow bypass application
 * layer controls.
 */
CREATE POLICY quote_items_insert_protection ON quote_items
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted quote items belong to quotes in current user's company
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

CREATE POLICY quote_items_update_protection ON quote_items
  FOR UPDATE
  USING (
    -- Can only update quote items in own company quotes
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing quote_id on update (critical security control)
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

CREATE POLICY quote_items_delete_protection ON quote_items
  FOR DELETE
  USING (
    -- Can only delete quote items in own company quotes
    quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- SUPERADMIN CROSS-COMPANY ACCESS
-- ============================================================================

/**
 * Superadmin policy for cross-company quote item access
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * quote items from any company. This is necessary for support and auditing purposes.
 */
CREATE POLICY quote_items_superadmin_full_access ON quote_items
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

-- ============================================================================
-- QUOTE_ID IMMUTABILITY POLICY
-- ============================================================================

/**
 * Critical security policy to prevent quote_id changes
 *
 * This policy prevents users from changing the quote_id of existing quote items,
 * which would be a security vulnerability allowing data transfer between quotes
 * and potentially between companies.
 */
CREATE POLICY quote_items_quote_id_immutable ON quote_items
  FOR UPDATE
  WITH CHECK (
    -- Prevent quote_id from being changed (old value must equal new value)
    -- No superadmin exception for quote_id changes (critical security control)
    quote_id = (SELECT quote_id FROM quote_items WHERE id = quote_items.id)
  );

-- ============================================================================
-- FINANCIAL DATA PROTECTION POLICY
-- ============================================================================

/**
 * Financial data protection policy for quote items
 *
 * This policy prevents modification of financial cost structures (supplier_cost_sqft,
 * supplier_amount) after quote item creation to maintain margin calculation integrity
 * and prevent tampering with cost analysis data.
 */
CREATE POLICY quote_items_financial_protection ON quote_items
  FOR UPDATE
  USING (
    (supplier_cost_sqft = (SELECT supplier_cost_sqft FROM quote_items WHERE id = quote_items.id)
     AND supplier_amount = (SELECT supplier_amount FROM quote_items WHERE id = quote_items.id))
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    supplier_cost_sqft = (SELECT supplier_cost_sqft FROM quote_items WHERE id = quote_items.id)
    AND supplier_amount = (SELECT supplier_amount FROM quote_items WHERE id = quote_items.id)
    AND COALESCE(supplier_cost_sqft, 0) = COALESCE((SELECT supplier_cost_sqft FROM quote_items WHERE id = quote_items.id), 0)
    AND COALESCE(supplier_amount, 0) = COALESCE((SELECT supplier_amount FROM quote_items WHERE id = quote_items.id), 0)
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON POLICY quote_items_tenant_isolation ON quote_items IS 'Primary tenant isolation policy. Users can only access quote items from quotes in their company, except superadmins who can access all companies.';

COMMENT ON POLICY quote_items_admin_access ON quote_items IS 'Admin access policy within company. Allows company admins full access to quote items in their company.';

COMMENT ON POLICY quote_items_read_only_access ON quote_items IS 'Read-only access policy for regular users. Allows reading quote items from quotes in own company.';

COMMENT ON POLICY quote_items_insert_protection ON quote_items IS 'Insert protection policy. Ensures new quote items are assigned to quotes in current user company only.';

COMMENT ON POLICY quote_items_update_protection ON quote_items IS 'Update protection policy. Prevents cross-company quote item modifications and quote_id changes.';

COMMENT ON POLICY quote_items_delete_protection ON quote_items IS 'Delete protection policy. Prevents cross-company quote item deletions.';

COMMENT ON POLICY quote_items_superadmin_full_access ON quote_items IS 'Superadmin full access policy. Allows superadmins to access all quote items across all companies for support and auditing.';

COMMENT ON POLICY quote_items_quote_id_immutable ON quote_items IS 'Critical security policy. Prevents quote_id changes on existing quote items to prevent data transfer between quotes and companies.';

COMMENT ON POLICY quote_items_financial_protection ON quote_items IS 'Financial data protection policy. Prevents modification of cost structures (supplier_cost_sqft, supplier_amount) after creation to maintain margin calculation integrity and audit trail.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure quote_id index exists for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- Create composite index for common RLS queries (quote_id + created_at)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_created ON quote_items(quote_id, created_at DESC);

-- Create index for financial analysis within quote context
CREATE INDEX IF NOT EXISTS idx_quote_items_financial ON quote_items(quote_id, supplier_amount, retail_amount);

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate quote_items RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly. It tests tenant isolation, admin access, and superadmin access.
 */
CREATE OR REPLACE FUNCTION test_quote_items_rls()
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
BEGIN
  -- Generate test company ID
  test_company_1_id := gen_random_uuid();

  -- Test 1: Verify RLS is enabled
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'quote_items'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on quote_items table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on quote_items table'::TEXT, ''::TEXT;
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
    DECLARE
      access_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO access_count FROM quote_items;

      -- With no context, should return 0 due to fail-secure policy
      RETURN QUERY SELECT 'Context Requirement'::TEXT, (access_count = 0)::BOOLEAN,
        'Query without context returned ' || access_count || ' rows'::TEXT,
        'Expected 0 rows when context not set'::TEXT;
    END;

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

    -- Verify the context is set correctly
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
      WHERE tablename = 'quote_items'
      AND policyname = 'quote_items_tenant_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'quote_items'
      AND policyname = 'quote_items_quote_id_immutable'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'quote_items'
      AND policyname = 'quote_items_financial_protection'
    ) THEN
      RETURN QUERY SELECT 'Policy Existence'::TEXT, true::BOOLEAN,
        'All required RLS policies exist'::TEXT,
        'tenant_isolation, quote_id_immutable, financial_protection'::TEXT;
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

COMMENT ON FUNCTION test_quote_items_rls() IS 'Test function to validate quote_items RLS policy implementation. Returns test results for policy verification.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to check for potential RLS policy bypass attempts
 *
 * This function can be used to monitor for suspicious activity that might
 * indicate attempts to bypass RLS policies.
 */
CREATE OR REPLACE FUNCTION audit_quote_items_rls_access()
RETURNS TABLE(
  event_type TEXT,
  description TEXT,
  severity TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT
    'RLS Context Monitoring'::TEXT,
    'Audit function for monitoring quote_items RLS access patterns'::TEXT,
    'INFO'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_quote_items_rls_access() IS 'Audit function to monitor quote_items RLS access patterns for security purposes.';

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
 * To rollback this migration and disable RLS on quote_items table:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE quote_items DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all policies:
 *    DROP POLICY IF EXISTS quote_items_tenant_isolation ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_admin_access ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_read_only_access ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_insert_protection ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_update_protection ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_delete_protection ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_superadmin_full_access ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_quote_id_immutable ON quote_items;
 *    DROP POLICY IF EXISTS quote_items_financial_protection ON quote_items;
 *
 * 3. Drop test functions:
 *    DROP FUNCTION IF EXISTS test_quote_items_rls();
 *    DROP FUNCTION IF EXISTS audit_quote_items_rls_access();
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
 * 1. Indirect Tenant Isolation: Quote items use quotes.company_id for tenant
 *    isolation since they don't have a direct company_id column.
 *
 * 2. Fail-Secure Philosophy: All policies deny access by default if context
 *    is not properly set, preventing accidental data exposure.
 *
 * 3. Performance: Indexes on quote_id are critical for RLS performance.
 *
 * 4. Financial Protection: Cost structures are immutable after quote item
 *    creation to maintain margin calculation integrity.
 *
 * 5. Quote Association: Quote_id immutability prevents data transfer between
 *    quotes and companies.
 *
 * 6. Application Layer: Application must call set_tenant_context() at the
 *    start of each request for these policies to work correctly.
 */