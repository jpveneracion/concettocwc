-- 090: Fix broken subscriptions RLS UPDATE policies
--
-- Same bug as migration 089 (users): the deployed policies use a
-- non-correlated subquery (WHERE subscriptions_1.id = subscriptions_1.id)
-- that returns ALL subscription rows. Any UPDATE to subscriptions once the
-- table has more than one row fails with
-- "more than one row returned by a subquery used as an expression".
-- These recreate the original policies from migration 030 with the correct
-- correlated subquery (WHERE id = subscriptions.id).

DROP POLICY IF EXISTS subscriptions_update_protection ON subscriptions;
CREATE POLICY subscriptions_update_protection ON subscriptions
  FOR UPDATE
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_company_id_immutable ON subscriptions;
CREATE POLICY subscriptions_company_id_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    company_id = (SELECT company_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_plan_id_immutable ON subscriptions;
CREATE POLICY subscriptions_plan_id_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    plan_id = (SELECT plan_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_status_protection ON subscriptions;
CREATE POLICY subscriptions_status_protection ON subscriptions
  FOR UPDATE
  USING (
    status = (SELECT status FROM subscriptions WHERE id = subscriptions.id)
    OR (
      (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'trialing')
      OR (status = 'past_due' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'active')
      OR (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'past_due')
      OR (status IN ('cancelled', 'suspended'))
    )
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    status = (SELECT status FROM subscriptions WHERE id = subscriptions.id)
    OR (
      (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'trialing')
      OR (status = 'past_due' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'active')
      OR (status = 'active' AND (SELECT status FROM subscriptions WHERE id = subscriptions.id) = 'past_due')
      OR (status IN ('cancelled', 'suspended'))
    )
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_trial_end_immutable ON subscriptions;
CREATE POLICY subscriptions_trial_end_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    trial_end = (SELECT trial_end FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_current_period_end_protection ON subscriptions;
CREATE POLICY subscriptions_current_period_end_protection ON subscriptions
  FOR UPDATE
  WITH CHECK (
    current_period_end >= (SELECT current_period_end FROM subscriptions WHERE id = subscriptions.id)
    OR current_period_end IS NULL
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_cancellation_scheduling_protection ON subscriptions;
CREATE POLICY subscriptions_cancellation_scheduling_protection ON subscriptions
  FOR UPDATE
  USING (
    cancel_at_period_end = (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id)
    OR (cancel_at_period_end = true AND (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id) = false)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    cancel_at_period_end = (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id)
    OR (cancel_at_period_end = true AND (SELECT cancel_at_period_end FROM subscriptions WHERE id = subscriptions.id) = false)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_paymongo_subscription_id_protection ON subscriptions;
CREATE POLICY subscriptions_paymongo_subscription_id_protection ON subscriptions
  FOR UPDATE
  USING (
    paymongo_subscription_id = (SELECT paymongo_subscription_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    paymongo_subscription_id = (SELECT paymongo_subscription_id FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS subscriptions_created_at_immutable ON subscriptions;
CREATE POLICY subscriptions_created_at_immutable ON subscriptions
  FOR UPDATE
  WITH CHECK (
    created_at = (SELECT created_at FROM subscriptions WHERE id = subscriptions.id)
    OR is_current_user_superadmin()
  );
