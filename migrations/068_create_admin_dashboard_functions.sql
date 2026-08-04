-- Migration: Create SECURITY DEFINER functions for admin dashboard operations
-- Purpose: Provide controlled RLS bypass for dashboard analytics and COUNT queries
-- Pattern: Following SECURITY DEFINER approach with admin role validation

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- ============================================================================

DROP FUNCTION IF EXISTS get_dashboard_payment_method_stats CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_active_subscriptions_count CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_pending_codes_count CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_signups_count CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_payment_method_distribution CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_discount_distribution CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_plan_distribution CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_revenue_over_time CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_usage_over_time CASCADE;

-- ============================================================================
-- DASHBOARD ANALYTICS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_payment_method_stats(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      payment_method,
      COALESCE(SUM(payment_amount), 0) as total_amount,
      COUNT(*) as count
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY payment_method
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_payment_method_stats IS 'SECURITY DEFINER function for payment method analytics. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_payment_method_stats(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_active_subscriptions_count()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT COUNT(*) as count
    FROM users
    WHERE subscription_activated = true
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_active_subscriptions_count IS 'SECURITY DEFINER function to count active subscriptions. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_active_subscriptions_count() TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_pending_codes_count()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT COUNT(*) as count
    FROM activation_codes
    WHERE is_active = true AND used_by IS NULL
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_pending_codes_count IS 'SECURITY DEFINER function to count pending activation codes. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_pending_codes_count() TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_signups_count(p_start_date timestamp with time zone)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT COUNT(*) as count
    FROM users
    WHERE created_at >= p_start_date
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_signups_count IS 'SECURITY DEFINER function to count user signups since date. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_signups_count(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_payment_method_distribution(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      payment_method,
      COALESCE(SUM(payment_amount), 0) as amount,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY payment_method
    ORDER BY amount DESC
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_payment_method_distribution IS 'SECURITY DEFINER function for payment method distribution. Bypasses RLS for admin dashboard analytics.';

GRANT EXECUTE ON FUNCTION get_dashboard_payment_method_distribution(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_discount_distribution(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      discount_percent,
      COUNT(*) as count,
      COALESCE(SUM(payment_amount), 0) as total_amount
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY discount_percent
    ORDER BY discount_percent
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_discount_distribution IS 'SECURITY DEFINER function for discount distribution analytics. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_discount_distribution(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_plan_distribution(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      u.subscription_plan,
      COUNT(*) as count,
      COALESCE(SUM(ac.payment_amount_usd), 0) as revenue,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM users u
    LEFT JOIN activation_codes ac ON u.activation_code = ac.code
    WHERE u.subscription_activated = true
    AND u.subscription_plan IS NOT NULL
    AND u.created_at >= p_start_date
    GROUP BY u.subscription_plan
    ORDER BY revenue DESC
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_plan_distribution IS 'SECURITY DEFINER function for subscription plan distribution. Bypasses RLS for admin dashboard analytics.';

GRANT EXECUTE ON FUNCTION get_dashboard_plan_distribution(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_revenue_over_time(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(CASE WHEN payment_method = 'gcash' THEN payment_amount ELSE 0 END), 0) as gcash,
      COALESCE(SUM(CASE WHEN payment_method = 'crypto' THEN payment_amount ELSE 0 END), 0) as crypto,
      COALESCE(SUM(CASE WHEN payment_method = 'usd_bank' THEN payment_amount ELSE 0 END), 0) as usd,
      COALESCE(SUM(payment_amount), 0) as total
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_revenue_over_time IS 'SECURITY DEFINER function for revenue over time analytics. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_revenue_over_time(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_dashboard_usage_over_time(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      DATE(created_at) as date,
      COUNT(*) FILTER (WHERE used_by IS NULL) as generated,
      COUNT(*) FILTER (WHERE used_by IS NOT NULL) as used,
      COUNT(*) FILTER (WHERE used_by IS NULL) as pending
    FROM activation_codes
    WHERE created_at >= p_start_date
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  ) t
$$;

COMMENT ON FUNCTION get_dashboard_usage_over_time IS 'SECURITY DEFINER function for activation code usage over time. Bypasses RLS for admin dashboard.';

GRANT EXECUTE ON FUNCTION get_dashboard_usage_over_time(timestamp with time zone) TO PUBLIC;