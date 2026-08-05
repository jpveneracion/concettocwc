-- Migration 092: Fix promo code usage increment (RLS recursion + backfill)
--
-- Problem 1 (root cause): Six UPDATE policies on activation_codes contain
-- self-referencing subqueries, e.g.
--     current_usage >= (SELECT current_usage FROM activation_codes WHERE id = activation_codes.id)
-- Every direct UPDATE to activation_codes therefore fails with
-- "infinite recursion detected in policy for relation activation_codes",
-- so promo redemption NEVER incremented current_usage (and admin promo edits
-- failed too). These policies are recreated/dropped without self-reference,
-- matching the fixes done for users (089) and subscriptions (090).
--
-- Problem 2: redeemActivationCode() incremented usage with a direct UPDATE
-- bound to the acting user's tenant context, which RLS blocked for promos
-- created by another company. The increment now goes through a SECURITY
-- DEFINER function (owner role, RLS bypass).
--
-- Problem 3: ADMIN99 was used once (payments.promo_code = 'ADMIN99', amount 51,
-- discount 5049 = 99% of the 5100 annual plan) but current_usage stayed 0.
-- Backfill below syncs current_usage to the actual payments ledger.

-- ============================================================================
-- 1. Fix the self-referencing UPDATE policies (infinite recursion)
-- ============================================================================

-- Field immutability checks require the OLD row, which RLS cannot express
-- without a self-referencing subquery. Dropped; writes remain governed by
-- tenant_isolation / update_protection / admin_access and the SECURITY
-- DEFINER increment function.
DROP POLICY IF EXISTS activation_codes_code_immutable ON activation_codes;
DROP POLICY IF EXISTS activation_codes_usage_tracking_protection ON activation_codes;
DROP POLICY IF EXISTS activation_codes_payment_amount_protection ON activation_codes;
DROP POLICY IF EXISTS activation_codes_discount_percent_protection ON activation_codes;
DROP POLICY IF EXISTS activation_codes_payment_method_protection ON activation_codes;

-- Kept without the self-referencing WITH CHECK: used codes stay immutable
-- (except superadmin); redemption sets used_at via SECURITY DEFINER (owner).
DROP POLICY IF EXISTS activation_codes_used_code_protection ON activation_codes;
CREATE POLICY activation_codes_used_code_protection ON activation_codes
  FOR UPDATE
  USING (
    used_at IS NULL
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    used_at IS NULL
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- 2. SECURITY DEFINER increment function (replaces migration 005's version)
-- ============================================================================
DROP FUNCTION IF EXISTS increment_promo_usage(text) CASCADE;

CREATE FUNCTION increment_promo_usage(
  p_code text,
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_status_history jsonb DEFAULT NULL
)
RETURNS SETOF activation_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE activation_codes
  SET
    -- Usage-limited codes: bump the counter; one-time codes: mark used
    current_usage = CASE WHEN usage_limit IS NULL THEN current_usage ELSE current_usage + 1 END,
    used_by = CASE WHEN usage_limit IS NULL THEN COALESCE(p_user_id, used_by) ELSE used_by END,
    used_at = CASE WHEN usage_limit IS NULL THEN COALESCE(NOW(), used_at) ELSE used_at END,
    used_ip_address = CASE WHEN usage_limit IS NULL THEN COALESCE(p_ip_address, used_ip_address) ELSE used_ip_address END,
    status_history = COALESCE(status_history, '[]'::jsonb) || COALESCE(p_status_history, '[]'::jsonb)
  WHERE code = p_code
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION increment_promo_usage(text, uuid, text, jsonb) IS 'SECURITY DEFINER function to increment promo code usage. Bypasses RLS so a promo created by one company can be redeemed by another (payment approval flow). One-time codes (usage_limit IS NULL) are marked with used_by instead.';

GRANT EXECUTE ON FUNCTION increment_promo_usage(text, uuid, text, jsonb) TO PUBLIC;

-- ============================================================================
-- 3. Backfill: current_usage = actual redemptions from the payments ledger
-- ============================================================================
UPDATE activation_codes ac
SET current_usage = (
  SELECT COUNT(*)::int FROM payments p WHERE p.promo_code = ac.code
)
WHERE EXISTS (SELECT 1 FROM payments p WHERE p.promo_code = ac.code);
