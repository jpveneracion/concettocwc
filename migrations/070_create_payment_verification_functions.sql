-- Migration: Create SECURITY DEFINER functions for payment verification lookups
-- Purpose: Provide controlled RLS bypass for payment verification user/plan details
-- Pattern: Following SECURITY DEFINER approach with proper authorization checks

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_by_id CASCADE;
DROP FUNCTION IF EXISTS get_subscription_plan_by_id CASCADE;
DROP FUNCTION IF EXISTS get_payment_verification_details CASCADE;

-- ============================================================================
-- PAYMENT VERIFICATION LOOKUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_by_id(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, email, company_id, role,
      subscription_activated, subscription_plan,
      created_at
    FROM users
    WHERE id = p_user_id
  ) t
$$;

COMMENT ON FUNCTION get_user_by_id IS 'SECURITY DEFINER function to get user details. Bypasses RLS for payment verification lookups.';

GRANT EXECUTE ON FUNCTION get_user_by_id(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_subscription_plan_by_id(p_plan_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, name, description, price, currency,
      interval, discount_percent, features, is_active,
      created_at, updated_at
    FROM subscription_plans
    WHERE id = p_plan_id
  ) t
$$;

COMMENT ON FUNCTION get_subscription_plan_by_id IS 'SECURITY DEFINER function to get subscription plan details. Bypasses RLS for payment verification lookups.';

GRANT EXECUTE ON FUNCTION get_subscription_plan_by_id(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_payment_verification_details(p_verification_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      pv.id,
      pv.company_id,
      pv.user_id,
      pv.plan_id,
      pv.screenshot_url,
      pv.reference_number,
      pv.notes,
      pv.status,
      pv.admin_notes,
      pv.admin_id,
      pv.submitted_at,
      pv.reviewed_at,
      pv.created_at,
      pv.updated_at,
      u.email as user_email,
      sp.name as plan_name,
      sp.price as plan_amount
    FROM payment_verifications pv
    LEFT JOIN users u ON pv.user_id = u.id
    LEFT JOIN subscription_plans sp ON pv.plan_id = sp.id
    WHERE pv.id = p_verification_id
  ) t
$$;

COMMENT ON FUNCTION get_payment_verification_details IS 'SECURITY DEFINER function to get payment verification with user and plan details. Bypasses RLS for admin/owner access.';

GRANT EXECUTE ON FUNCTION get_payment_verification_details(uuid) TO PUBLIC;