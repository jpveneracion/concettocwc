-- 089: Fix broken users RLS UPDATE policies
--
-- The original policies used a non-correlated subquery
-- (WHERE users_1.id = users_1.id) that returns ALL user rows, causing
-- "more than one row returned by a subquery" on every UPDATE to users.
-- This made the approval flow's users update fail silently under RLS.
-- These policies replace the broken expressions with correct ones.

DROP POLICY IF EXISTS users_update_protection ON users;
CREATE POLICY users_update_protection ON users
  FOR UPDATE
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS users_company_id_immutable ON users;
CREATE POLICY users_company_id_immutable ON users
  FOR UPDATE
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS users_user_id_immutable ON users;
CREATE POLICY users_user_id_immutable ON users
  FOR UPDATE
  USING (
    id = get_current_user_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    id = get_current_user_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS users_role_protection ON users;
CREATE POLICY users_role_protection ON users
  FOR UPDATE
  USING (
    id = get_current_user_id()
    OR (is_current_user_admin() AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    id = get_current_user_id()
    OR (is_current_user_admin() AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

-- Backfill: the previously approved payment (ADMIN99, Annual plan) never set
-- users.subscription_plan because the broken policies blocked the UPDATE.
UPDATE users
SET subscription_plan = 'annual'
WHERE id = 'e9aa274c-ab10-40e0-8f99-318fa1d16041'
  AND subscription_plan IS NULL;

