-- Migration 078: Fix subscription_plans RLS circular subquery bug
-- Table: subscription_plans
-- Risk: LOW (fixes broken superadmin UPDATE path)
--
-- BUG: The UPDATE policies (structure_protection, name_immutable, price_protection)
-- were written with `WHERE id = subscription_plans.id` inside the scalar subquery.
-- Because the unqualified `subscription_plans` name resolves to the INNER table
-- (the closest relation), the comparison became `inner.id = inner.id`
-- (e.g. `subscription_plans_1.id = subscription_plans_1.id`) which is ALWAYS true.
-- That makes the subquery return every row in the table.
--
--   * Whenever subscription_plans has >1 row, any superadmin UPDATE hits:
--       "more than one row returned by a subquery used as an expression"
--   * (The same textual bug exists in migration 024 for companies, but there
--     it is masked: the inner SELECT subquery is itself subject to RLS and
--     returns at most one row, so no multi-row error is raised.)
--
-- FIX: Alias the inner table and correlate against the OUTER row by primary key:
--   value = (SELECT sp.col FROM subscription_plans sp WHERE sp.id = subscription_plans.id)
--
-- Also fixes is_plan_in_use(plan_id), where the parameter name `plan_id` is
-- shadowed by the subscriptions.plan_id column, so it counts ALL subscriptions.

-- ============================================================================
-- Step 1: Fix helper function is_plan_in_use (parameter name shadowing)
-- ============================================================================

-- Drop dependent policy first (it references is_plan_in_use), recreated in Step 3
DROP POLICY IF EXISTS subscription_plans_active_delete_protection ON subscription_plans;

-- DROP first: CREATE OR REPLACE cannot rename the input parameter
DROP FUNCTION IF EXISTS is_plan_in_use(uuid);

CREATE OR REPLACE FUNCTION is_plan_in_use(p_plan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  -- Check if any active subscriptions use this plan
  SELECT COUNT(*) INTO usage_count
  FROM subscriptions
  WHERE plan_id = p_plan_id AND status IN ('active', 'trialing', 'past_due');

  RETURN usage_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 2: Recreate UPDATE policies with corrected correlated subqueries
-- ============================================================================

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
    id = (SELECT sp.id FROM subscription_plans sp WHERE sp.id = subscription_plans.id)
    AND
    -- Prevent modifying interval (fundamental plan property)
    interval = (SELECT sp.interval FROM subscription_plans sp WHERE sp.id = subscription_plans.id)
    AND
    -- Safety check: superadmin awareness for structural changes
    is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscription_plans_name_immutable ON subscription_plans;

CREATE POLICY subscription_plans_name_immutable ON subscription_plans
  FOR UPDATE
  TO concetto_boms
  WITH CHECK (
    -- Maintain name consistency unless a superadmin changes it
    name = (SELECT sp.name FROM subscription_plans sp WHERE sp.id = subscription_plans.id)
    OR is_current_user_superadmin()
  );

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
    price = (SELECT sp.price FROM subscription_plans sp WHERE sp.id = subscription_plans.id)
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- Step 3: Recreate active delete protection policy (depends on is_plan_in_use)
-- ============================================================================

CREATE POLICY subscription_plans_active_delete_protection ON subscription_plans
  FOR DELETE
  TO concetto_boms
  USING (
    -- Allow deletion only for superadmin and only if plan not in active use
    is_current_user_superadmin()
    AND NOT is_plan_in_use(id)
  );

-- ============================================================================
-- Step 4: Documentation update
-- ============================================================================

COMMENT ON POLICY subscription_plans_structure_protection ON subscription_plans IS
'Critical plan structure protection - prevents changing fundamental plan properties (ID, interval). Fixed correlated subquery (context: migration 078) so superadmin updates no longer fail with multi-row subquery errors.';

COMMENT ON POLICY subscription_plans_name_immutable ON subscription_plans IS
'Plan name protection - maintains plan name consistency (can be changed by superadmin if needed). Fixed correlated subquery (migration 078).';

COMMENT ON POLICY subscription_plans_price_protection ON subscription_plans IS
'Price change protection - allows superadmin price modifications with audit trail consideration. Fixed correlated subquery (migration 078).';

COMMENT ON FUNCTION is_plan_in_use IS
'Helper function to check if a subscription plan is currently in use by active subscriptions. Fixed parameter shadowing (migration 078).';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 078 completed: fixed subscription_plans RLS subquery bug';
  RAISE NOTICE '- Recreated structure/name/price UPDATE policies with correlated subqueries';
  RAISE NOTICE '- Recreated active delete protection policy';
  RAISE NOTICE '- Fixed is_plan_in_use parameter shadowing';
END $$;