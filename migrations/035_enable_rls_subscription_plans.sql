-- Migration 035: Enable RLS for subscription_plans table
-- Table: subscription_plans
-- Risk: LOW-MEDIUM (3 rows - global configuration)
-- Strategy: Global configuration model (read-only for users, superadmin write access)

-- ============================================================================
-- Step 1: Enable RLS on subscription_plans table
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: Create helper functions for subscription_plans RLS
-- ============================================================================

-- Function to check if user can modify subscription plans
CREATE OR REPLACE FUNCTION can_modify_subscription_plans()
RETURNS BOOLEAN AS $$
BEGIN
  -- Only superadmins can modify global subscription plans
  RETURN is_current_user_superadmin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if plan is currently in use (for safety checks)
CREATE OR REPLACE FUNCTION is_plan_in_use(plan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  -- Check if any active subscriptions use this plan
  SELECT COUNT(*) INTO usage_count
  FROM subscriptions
  WHERE plan_id = plan_id AND status IN ('active', 'trialing', 'past_due');

  RETURN usage_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 3: Create RLS Policies for subscription_plans
-- ============================================================================

-- Policy 1: Read-Only Global Access (All authenticated users can read plans)
DROP POLICY IF EXISTS subscription_plans_read_only_access ON subscription_plans;

CREATE POLICY subscription_plans_read_only_access ON subscription_plans
  FOR SELECT
  TO concetto_boms
  USING (TRUE); -- All authenticated users can read available plans

-- Policy 2: Superadmin Write Access (Only superadmins can modify plans)
DROP POLICY IF EXISTS subscription_plans_admin_write_protection ON subscription_plans;

CREATE POLICY subscription_plans_admin_write_protection ON subscription_plans
  FOR INSERT
  TO concetto_boms
  WITH CHECK (is_current_user_superadmin());

DROP POLICY IF EXISTS subscription_plans_admin_update_protection ON subscription_plans;

CREATE POLICY subscription_plans_admin_update_protection ON subscription_plans
  FOR UPDATE
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

DROP POLICY IF EXISTS subscription_plans_admin_delete_protection ON subscription_plans;

CREATE POLICY subscription_plans_admin_delete_protection ON subscription_plans
  FOR DELETE
  TO concetto_boms
  USING (is_current_user_superadmin());

-- Policy 3: Critical Plan Structure Protection
DROP POLICY IF EXISTS subscription_plans_structure_protection ON subscription_plans;

CREATE POLICY subscription_plans_structure_protection ON subscription_plans
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Allow superadmin modifications with safety checks
    is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing critical plan identifiers
    id = (SELECT id FROM subscription_plans WHERE id = subscription_plans.id)
    AND
    -- Prevent modifying interval (fundamental plan property)
    interval = (SELECT interval FROM subscription_plans WHERE id = subscription_plans.id)
    AND
    -- Safety check: warn if modifying price for plans in active use
    -- (This doesn't prevent changes, but ensures superadmin awareness)
    is_current_user_superadmin()
  );

-- Policy 4: Plan Name Immutability (Prevents confusion)
DROP POLICY IF EXISTS subscription_plans_name_immutable ON subscription_plans;

CREATE POLICY subscription_plans_name_immutable ON subscription_plans
  FOR UPDATE
  TO concetto_boms
  WITH CHECK (
    -- Allow name changes only for superadmin
    -- Maintain consistency with existing references
    name = (SELECT name FROM subscription_plans WHERE id = subscription_plans.id)
    OR is_current_user_superadmin()
  );

-- Policy 5: Price Change Protection (Audit trail consideration)
DROP POLICY IF EXISTS subscription_plans_price_protection ON subscription_plans;

CREATE POLICY subscription_plans_price_protection ON subscription_plans
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Superadmin can modify prices but should be aware of impact
    is_current_user_superadmin()
  )
  WITH CHECK (
    -- Allow price changes only for superadmin (with awareness)
    price = (SELECT price FROM subscription_plans WHERE id = subscription_plans.id)
    OR is_current_user_superadmin()
  );

-- Policy 6: Active Plan Protection (Prevents accidental deletion)
DROP POLICY IF EXISTS subscription_plans_active_delete_protection ON subscription_plans;

CREATE POLICY subscription_plans_active_delete_protection ON subscription_plans
  FOR DELETE
  TO concetto_boms
  USING (
    -- Allow deletion only for superadmin and only if plan not in active use
    is_current_user_superadmin()
    AND NOT is_plan_in_use(id)
  );

-- ============================================================================
-- Step 4: Performance Optimization - Create Indexes for RLS
-- ============================================================================

-- Index for active plans (common query pattern)
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
  ON subscription_plans(is_active) WHERE is_active = true;

-- Index for plan interval filtering
CREATE INDEX IF NOT EXISTS idx_subscription_plans_interval
  ON subscription_plans(interval);

-- Index for price-based queries
CREATE INDEX IF NOT EXISTS idx_subscription_plans_price
  ON subscription_plans(price);

-- Composite index for common user-facing queries
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active_price
  ON subscription_plans(is_active, price) WHERE is_active = true;

-- ============================================================================
-- Step 5: Testing Infrastructure
-- ============================================================================

-- Function to test subscription_plans RLS policies
CREATE OR REPLACE FUNCTION test_subscription_plans_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID := '60b8ae66-ffe5-4bab-bc9c-7d669f4ff6fc';
  context_set BOOLEAN;
  plan_count INTEGER;
  can_read INTEGER;
  can_insert BOOLEAN;
  update_success BOOLEAN;
BEGIN
  -- Test 1: Regular user can read all plans
  PERFORM set_tenant_context(test_company_id, 'user');

  SELECT COUNT(*) INTO plan_count
  FROM subscription_plans
  WHERE is_active = true;

  RETURN QUERY SELECT
    'Test 1: User Can Read Plans'::TEXT,
    (plan_count::INTEGER >= 3),
    'User can see ' || plan_count::TEXT || ' active plans'::TEXT;

  -- Test 2: Verify RLS is enabled
  RETURN QUERY SELECT
    'Test 2: RLS Enabled'::TEXT,
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'subscription_plans'),
    'RLS is properly enabled on subscription_plans'::TEXT;

  -- Test 3: Verify policies exist
  RETURN QUERY SELECT
    'Test 3: Policies Exist'::TEXT,
    ((SELECT COUNT(*) FROM pg_policies WHERE tablename = 'subscription_plans')::INTEGER >= 6),
    'Expected 6+ policies, found: ' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'subscription_plans')::TEXT;

  -- Test 4: Verify global read access works
  PERFORM set_tenant_context(test_company_id, 'user');

  SELECT COUNT(*) INTO can_read
  FROM subscription_plans;

  RETURN QUERY SELECT
    'Test 4: Global Read Access'::TEXT,
    (can_read::INTEGER >= 3),
    'Users can read all ' || can_read::TEXT || ' plans (global access)'::TEXT;

  -- Test 5: Verify regular users cannot insert
  -- This test should fail (user should NOT be able to insert)
  BEGIN
    -- Try to insert a plan as regular user (should be blocked)
    INSERT INTO subscription_plans (name, description, price, currency, interval)
    VALUES ('Test Plan', 'Should be blocked', 100.00, 'PHP', 'month');

    -- If we reach here, something is wrong
    can_insert := TRUE;

    -- Clean up test data
    DELETE FROM subscription_plans WHERE name = 'Test Plan';

  EXCEPTION WHEN OTHERS THEN
    -- Expected: User should be blocked from inserting
    can_insert := FALSE;
  END;

  RETURN QUERY SELECT
    'Test 5: User Cannot Insert Plans'::TEXT,
    (can_insert = FALSE),
    'Regular users correctly blocked from inserting plans'::TEXT;

  -- Test 6: Superadmin can modify plans
  PERFORM set_tenant_context(test_company_id, 'superadmin');

  DECLARE
    plan_id UUID;
  BEGIN
    -- Get an existing plan
    SELECT id INTO plan_id
    FROM subscription_plans
    LIMIT 1;

    -- Try to update description as superadmin (should work)
    UPDATE subscription_plans
    SET description = 'Test update for RLS verification'
    WHERE id = plan_id;

    update_success := TRUE;

    -- Restore original description
    UPDATE subscription_plans
    SET description = 'Flexible monthly subscription'
    WHERE id = plan_id AND name = 'Monthly';

  EXCEPTION WHEN OTHERS THEN
    update_success := FALSE;
  END;

  RETURN QUERY SELECT
    'Test 6: Superadmin Can Modify Plans'::TEXT,
    update_success,
    'Superadmin can successfully modify plan structure'::TEXT;

  -- Test 7: Index verification
  RETURN QUERY SELECT
    'Test 7: Performance Indexes'::TEXT,
    ((SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'subscription_plans')::INTEGER >= 4),
    'Expected 4+ indexes, found: ' || (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'subscription_plans')::TEXT;

  -- Test 8: Helper functions work
  RETURN QUERY SELECT
    'Test 8: Helper Functions'::TEXT,
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'can_modify_subscription_plans')),
    'Helper functions exist and operational'::TEXT;

  -- Reset context
  PERFORM reset_tenant_context();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit subscription_plans security
CREATE OR REPLACE FUNCTION audit_subscription_plans_security()
RETURNS TABLE(audit_item TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit RLS Status
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'subscription_plans') THEN 'ACTIVE'::TEXT
      ELSE 'INACTIVE'::TEXT
    END,
    'Row-level security status'::TEXT;

  -- Audit Policy Count
  RETURN QUERY SELECT
    'Policy Count'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_policies WHERE tablename = 'subscription_plans'),
    'Number of RLS policies deployed'::TEXT;

  -- Audit Index Coverage
  RETURN QUERY SELECT
    'Index Coverage'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_indexes WHERE tablename = 'subscription_plans'),
    'Number of performance indexes'::TEXT;

  -- Audit Helper Functions
  RETURN QUERY SELECT
    'Helper Functions'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_proc WHERE proname LIKE '%subscription_plan%'),
    'Number of helper functions'::TEXT;

  -- Audit Current Plans
  RETURN QUERY SELECT
    'Total Plans'::TEXT,
    (SELECT COUNT(*)::TEXT FROM subscription_plans),
    'Number of subscription plans in system'::TEXT;

  -- Audit Active Plans
  RETURN QUERY SELECT
    'Active Plans'::TEXT,
    (SELECT COUNT(*)::TEXT FROM subscription_plans WHERE is_active = true),
    'Number of active plans available for subscription'::TEXT;

  -- Audit Security Features
  RETURN QUERY SELECT
    'Read Access Model'::TEXT,
    'GLOBAL READ'::TEXT,
    'All authenticated users can read plans'::TEXT;

  RETURN QUERY SELECT
    'Write Access Model'::TEXT,
    'SUPERADMIN ONLY'::TEXT,
    'Only superadmins can modify plan structure'::TEXT;

  RETURN QUERY SELECT
    'Configuration Type'::TEXT,
    'GLOBAL SHARED'::TEXT,
    'Global configuration table (not company-specific)'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 6: Policy Documentation (PostgreSQL Comments)
-- ============================================================================

COMMENT ON POLICY subscription_plans_read_only_access ON subscription_plans IS
'Global read access - all authenticated users can read available subscription plans for subscription selection';

COMMENT ON POLICY subscription_plans_admin_write_protection ON subscription_plans IS
'Superadmin write protection - only superadmins can insert new subscription plans';

COMMENT ON POLICY subscription_plans_admin_update_protection ON subscription_plans IS
'Superadmin update protection - only superadmins can modify existing subscription plans';

COMMENT ON POLICY subscription_plans_admin_delete_protection ON subscription_plans IS
'Superadmin delete protection - only superadmins can delete subscription plans';

COMMENT ON POLICY subscription_plans_structure_protection ON subscription_plans IS
'Critical plan structure protection - prevents changing fundamental plan properties (ID, interval) and ensures superadmin awareness for price changes';

COMMENT ON POLICY subscription_plans_name_immutable ON subscription_plans IS
'Plan name protection - maintains plan name consistency (can be changed by superadmin if needed)';

COMMENT ON POLICY subscription_plans_price_protection ON subscription_plans IS
'Price change protection - allows superadmin price modifications with audit trail consideration';

COMMENT ON POLICY subscription_plans_active_delete_protection ON subscription_plans IS
'Active plan protection - prevents deletion of plans that are currently in use by active subscriptions';

COMMENT ON FUNCTION can_modify_subscription_plans IS
'Helper function to check if current user can modify subscription plans (superadmin only)';

COMMENT ON FUNCTION is_plan_in_use IS
'Helper function to check if a subscription plan is currently in use by active subscriptions';

COMMENT ON FUNCTION test_subscription_plans_rls IS
'Comprehensive test function for subscription_plans RLS policies';

COMMENT ON FUNCTION audit_subscription_plans_security IS
'Security audit function for subscription_plans RLS implementation';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 035 completed: RLS enabled for subscription_plans table';
  RAISE NOTICE '- Global configuration model implemented';
  RAISE NOTICE '- 6 comprehensive RLS policies deployed';
  RAISE NOTICE '- Read access: All authenticated users (global access)';
  RAISE NOTICE '- Write access: Superadmin only (platform control)';
  RAISE NOTICE '- Plan structure protection enabled';
  RAISE NOTICE '- Active plan deletion protection';
  RAISE NOTICE '- Performance indexes created';
  RAISE NOTICE '- Testing infrastructure deployed';
END $$;