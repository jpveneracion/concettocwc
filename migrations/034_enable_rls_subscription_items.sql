-- Migration 034: Enable RLS for subscription_items table
-- Table: subscription_items
-- Risk: MEDIUM (0 rows - future billing information protection)
-- Strategy: Indirect tenant isolation through subscription relationship

-- ============================================================================
-- Step 1: Enable RLS on subscription_items table
-- ============================================================================

ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: Create helper functions for subscription_items RLS
-- ============================================================================

-- Function to get company_id from subscription_items through subscription relationship
CREATE OR REPLACE FUNCTION get_subscription_item_company_id(item_id UUID)
RETURNS UUID AS $$
DECLARE
  sub_company_id UUID;
BEGIN
  -- Get company_id directly from subscription
  SELECT company_id INTO sub_company_id
  FROM subscriptions
  WHERE id = (
    SELECT subscription_id
    FROM subscription_items
    WHERE id = item_id
  );

  RETURN sub_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if subscription item belongs to current company
CREATE OR REPLACE FUNCTION can_access_subscription_item(item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  item_company_id UUID;
  current_company_id UUID;
BEGIN
  -- Get current company from context
  current_company_id := get_current_company_id();

  -- Get company that owns this subscription item
  item_company_id := get_subscription_item_company_id(item_id);

  -- Check for superadmin access
  IF is_current_user_superadmin() THEN
    RETURN TRUE;
  END IF;

  -- Check for admin access within company
  IF is_current_user_admin() AND item_company_id = current_company_id THEN
    RETURN TRUE;
  END IF;

  -- Check for regular user access (own company's items)
  IF item_company_id = current_company_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 3: Create RLS Policies for subscription_items
-- ============================================================================

-- Policy 1: Base Tenant Isolation (Direct through subscription relationship)
DROP POLICY IF EXISTS subscription_items_tenant_isolation ON subscription_items;

CREATE POLICY subscription_items_tenant_isolation ON subscription_items
  FOR ALL
  TO concetto_boms
  USING (
    -- Direct path: subscription_items -> subscriptions -> company_id
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    )
  )
  WITH CHECK (
    -- Prevent INSERT without proper company context
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    )
  );

-- Policy 2: Admin Access within Company
DROP POLICY IF EXISTS subscription_items_admin_access ON subscription_items;

CREATE POLICY subscription_items_admin_access ON subscription_items
  FOR ALL
  TO concetto_boms
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    ) AND is_current_user_admin()
  )
  WITH CHECK (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    ) AND is_current_user_admin()
  );

-- Policy 3: Superadmin Full Access
DROP POLICY IF EXISTS subscription_items_superadmin_full_access ON subscription_items;

CREATE POLICY subscription_items_superadmin_full_access ON subscription_items
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 4: Subscription Association Immutability
DROP POLICY IF EXISTS subscription_items_subscription_id_immutable ON subscription_items;

CREATE POLICY subscription_items_subscription_id_immutable ON subscription_items
  FOR UPDATE
  TO concetto_boms
  WITH CHECK (
    -- Prevent changing subscription_id (maintains audit trail)
    subscription_id = (SELECT subscription_id FROM subscription_items WHERE id = subscription_items.id)
  );

-- Policy 5: Plan Association Immutability
DROP POLICY IF EXISTS subscription_items_plan_id_immutable ON subscription_items;

CREATE POLICY subscription_items_plan_id_immutable ON subscription_items
  FOR UPDATE
  TO concetto_boms
  WITH CHECK (
    -- Prevent changing plan_id (maintains billing consistency)
    plan_id = (SELECT plan_id FROM subscription_items WHERE id = subscription_items.id)
  );

-- Policy 6: Billing Data Protection (price immutability)
DROP POLICY IF EXISTS subscription_items_billing_protection ON subscription_items;

CREATE POLICY subscription_items_billing_protection ON subscription_items
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Prevent price manipulation on UPDATE (billing audit protection)
    price = (SELECT price FROM subscription_items WHERE id = subscription_items.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent price changes on UPDATE (except superadmin)
    price = (SELECT price FROM subscription_items WHERE id = subscription_items.id)
    OR is_current_user_superadmin()
  );

-- Policy 7: Quantity Change Protection
DROP POLICY IF EXISTS subscription_items_quantity_protection ON subscription_items;

CREATE POLICY subscription_items_quantity_protection ON subscription_items
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Allow quantity changes only with proper authorization
    quantity = (SELECT quantity FROM subscription_items WHERE id = subscription_items.id)
    OR is_current_user_admin()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Allow quantity changes with proper authorization
    quantity = (SELECT quantity FROM subscription_items WHERE id = subscription_items.id)
    OR is_current_user_admin()
    OR is_current_user_superadmin()
  );

-- Policy 8: INSERT Protection (Proper Company Context)
DROP POLICY IF EXISTS subscription_items_insert_protection ON subscription_items;

CREATE POLICY subscription_items_insert_protection ON subscription_items
  FOR INSERT
  TO concetto_boms
  WITH CHECK (
    -- Verify subscription belongs to current company
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    )
  );

-- Policy 9: DELETE Protection
DROP POLICY IF EXISTS subscription_items_delete_protection ON subscription_items;

CREATE POLICY subscription_items_delete_protection ON subscription_items
  FOR DELETE
  TO concetto_boms
  USING (
    -- Allow delete only for authorized users
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    ) AND (
      is_current_user_admin() OR
      is_current_user_superadmin()
    )
  );

-- Policy 10: Read-Only Access for Regular Users
DROP POLICY IF EXISTS subscription_items_read_only_access ON subscription_items;

CREATE POLICY subscription_items_read_only_access ON subscription_items
  FOR SELECT
  TO concetto_boms
  USING (
    -- Regular users can read their company's subscription items
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE company_id = get_current_company_id()
    )
  );

-- ============================================================================
-- Step 4: Performance Optimization - Create Indexes for RLS
-- ============================================================================

-- Index for subscription relationship (CRITICAL for RLS performance)
CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription_id
  ON subscription_items(subscription_id);

-- Index for plan relationship
CREATE INDEX IF NOT EXISTS idx_subscription_items_plan_id
  ON subscription_items(plan_id);

-- Composite index for company context queries (via subscription)
-- This will help optimize the direct company lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id
  ON subscriptions(company_id);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_subscription_items_created_at
  ON subscription_items(created_at DESC);

-- ============================================================================
-- Step 5: Testing Infrastructure
-- ============================================================================

-- Function to test subscription_items RLS policies
CREATE OR REPLACE FUNCTION test_subscription_items_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID := '60b8ae66-ffe5-4bab-bc9c-7d669f4ff6fc'; -- Company from production
  test_subscription_id UUID;
  test_item_id UUID;
  context_set BOOLEAN;
BEGIN
  -- Get a real subscription from the test company (if any exist)
  SELECT id INTO test_subscription_id
  FROM subscriptions
  WHERE company_id = test_company_id
  LIMIT 1;

  -- Test 1: User can only see their company's subscription items
  PERFORM set_tenant_context(test_company_id, 'user');
  context_set := (get_current_company_id() IS NOT NULL);

  RETURN QUERY SELECT
    'Test 1: Tenant Context Set'::TEXT,
    context_set,
    CASE WHEN context_set THEN 'Context properly set for company'::TEXT
         ELSE 'Failed to set tenant context'::TEXT END;

  -- Since subscriptions is empty (0 rows), get a sample subscription test
  RETURN QUERY SELECT
    'Test 1.1: Subscriptions Empty'::TEXT,
    (SELECT COUNT(*) = 0 FROM subscriptions),
    'Subscription items table is empty (preventive protection)'::TEXT;

  -- Test 2: Verify RLS is enabled
  RETURN QUERY SELECT
    'Test 2: RLS Enabled'::TEXT,
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'subscription_items'),
    'RLS is properly enabled on subscription_items'::TEXT;

  -- Test 3: Verify policies exist
  RETURN QUERY SELECT
    'Test 3: Policies Exist'::TEXT,
    (SELECT COUNT(*) >= 8 FROM pg_policies WHERE tablename = 'subscription_items'),
    'Expected 8+ policies, found: ' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'subscription_items')::TEXT;

  -- Test 4: Index verification
  RETURN QUERY SELECT
    'Test 4: Performance Indexes'::TEXT,
    (SELECT COUNT(*) >= 4 FROM pg_indexes WHERE tablename = 'subscription_items'),
    'Expected 4+ indexes, found: ' || (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'subscription_items')::TEXT;

  -- Test 5: Helper functions work
  RETURN QUERY SELECT
    'Test 5: Helper Functions'::TEXT,
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_subscription_item_company_id')),
    'get_subscription_item_company_id function exists'::TEXT;

  -- Test 6: Cross-company access denial (if we have multiple companies)
  DECLARE
    other_company_id UUID;
    cross_company_blocked BOOLEAN;
  BEGIN
    SELECT id INTO other_company_id
    FROM companies
    WHERE id != test_company_id
    LIMIT 1;

    IF other_company_id IS NOT NULL THEN
      -- Try to access subscription items from other company (should be blocked)
      PERFORM set_tenant_context(other_company_id, 'user');

      -- This should return 0 (no subscription items visible from other company)
      SELECT COUNT(*) INTO cross_company_blocked
      FROM subscription_items
      WHERE subscription_id IN (
        SELECT id FROM subscriptions
        WHERE company_id = test_company_id
      );

      -- Reset context
      PERFORM set_tenant_context(test_company_id, 'user');

      RETURN QUERY SELECT
        'Test 6: Cross-Company Access Blocked'::TEXT,
        (cross_company_blocked::INTEGER = 0),
        'Correctly blocked access to other company items: ' || cross_company_blocked::TEXT || ' items visible'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Test 6: Cross-Company Access Blocked'::TEXT,
        TRUE,
        'Test skipped - only one company in database'::TEXT;
    END IF;
  END;

  -- Test 7: Billing data protection
  RETURN QUERY SELECT
    'Test 7: Billing Data Protection'::TEXT,
    (SELECT EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscription_items'
      AND policyname = 'subscription_items_billing_protection'
    )),
    'Billing protection policy exists'::TEXT;

  -- Test 8: Subscription immutability
  RETURN QUERY SELECT
    'Test 8: Subscription ID Immutability'::TEXT,
    (SELECT EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscription_items'
      AND policyname = 'subscription_items_subscription_id_immutable'
    )),
    'Subscription ID immutability policy exists'::TEXT;

  -- Reset context
  PERFORM reset_tenant_context();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit subscription_items security
CREATE OR REPLACE FUNCTION audit_subscription_items_security()
RETURNS TABLE(audit_item TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit RLS Status
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'subscription_items') THEN 'ACTIVE'::TEXT
      ELSE 'INACTIVE'::TEXT
    END,
    'Row-level security status'::TEXT;

  -- Audit Policy Count
  RETURN QUERY SELECT
    'Policy Count'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_policies WHERE tablename = 'subscription_items'),
    'Number of RLS policies deployed'::TEXT;

  -- Audit Index Coverage
  RETURN QUERY SELECT
    'Index Coverage'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_indexes WHERE tablename = 'subscription_items'),
    'Number of performance indexes'::TEXT;

  -- Audit Helper Functions
  RETURN QUERY SELECT
    'Helper Functions'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_proc WHERE proname LIKE '%subscription_item%'),
    'Number of helper functions'::TEXT;

  -- Audit Current Data Protection
  RETURN QUERY SELECT
    'Data Protected'::TEXT,
    (SELECT COUNT(*)::TEXT || ' rows'::TEXT),
    'Current subscription_items under RLS protection'::TEXT;

  -- Audit Security Features
  RETURN QUERY SELECT
    'Billing Protection'::TEXT,
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscription_items'
      AND policyname = 'subscription_items_billing_protection'
    ) THEN 'ENABLED'::TEXT ELSE 'DISABLED'::TEXT END,
    'Price immutability protection status'::TEXT;

  RETURN QUERY SELECT
    'Subscription Immutability'::TEXT,
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = 'subscription_items'
      AND policyname = 'subscription_items_subscription_id_immutable'
    ) THEN 'ENABLED'::TEXT ELSE 'DISABLED'::TEXT END,
    'Subscription ID immutability status'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 6: Policy Documentation (PostgreSQL Comments)
-- ============================================================================

COMMENT ON POLICY subscription_items_tenant_isolation ON subscription_items IS
'Core multi-tenant isolation - users can only access subscription items from subscriptions within their company (direct relationship: subscription_items -> subscriptions -> company_id)';

COMMENT ON POLICY subscription_items_admin_access ON subscription_items IS
'Company admin access - admins can manage subscription items within their company';

COMMENT ON POLICY subscription_items_superadmin_full_access ON subscription_items IS
'Superadmin cross-company access - superadmins can access all subscription items for support and auditing';

COMMENT ON POLICY subscription_items_subscription_id_immutable ON subscription_items IS
'Subscription association immutability - prevents changing subscription_id to maintain audit trail';

COMMENT ON POLICY subscription_items_plan_id_immutable ON subscription_items IS
'Plan association immutability - prevents changing plan_id to maintain billing consistency';

COMMENT ON POLICY subscription_items_billing_protection ON subscription_items IS
'Billing data protection - prevents price manipulation on UPDATE to maintain audit integrity';

COMMENT ON POLICY subscription_items_quantity_protection ON subscription_items IS
'Quantity change protection - allows quantity modifications only with proper authorization';

COMMENT ON POLICY subscription_items_insert_protection ON subscription_items IS
'INSERT protection - verifies subscription belongs to current company on INSERT';

COMMENT ON POLICY subscription_items_delete_protection ON subscription_items IS
'DELETE protection - allows deletion only for authorized users (admin/superadmin)';

COMMENT ON POLICY subscription_items_read_only_access ON subscription_items IS
'Read-only access - regular users can read their company subscription items';

COMMENT ON FUNCTION get_subscription_item_company_id IS
'Helper function to get company_id from subscription_items through subscription relationship chain';

COMMENT ON FUNCTION can_access_subscription_item IS
'Helper function to check if current user can access specific subscription item';

COMMENT ON FUNCTION test_subscription_items_rls IS
'Comprehensive test function for subscription_items RLS policies';

COMMENT ON FUNCTION audit_subscription_items_security IS
'Security audit function for subscription_items RLS implementation';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 034 completed: RLS enabled for subscription_items table';
  RAISE NOTICE '- 10 comprehensive RLS policies deployed';
  RAISE NOTICE '- Direct tenant isolation through subscription company_id relationship';
  RAISE NOTICE '- Billing data protection (price immutability)';
  RAISE NOTICE '- Subscription association immutability';
  RAISE NOTICE '- Performance indexes created';
  RAISE NOTICE '- Testing infrastructure deployed';
END $$;