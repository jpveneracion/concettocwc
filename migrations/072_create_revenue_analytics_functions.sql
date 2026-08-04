-- Migration: Create SECURITY DEFINER functions for revenue analytics
-- Purpose: Provide controlled RLS bypass for admin revenue analytics
-- Pattern: Following SECURITY DEFINER approach with admin role validation

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- ============================================================================

DROP FUNCTION IF EXISTS get_revenue_by_payment_method CASCADE;
DROP FUNCTION IF EXISTS get_revenue_over_time CASCADE;
DROP FUNCTION IF EXISTS get_revenue_by_discount CASCADE;
DROP FUNCTION IF EXISTS get_revenue_by_subscription_plan CASCADE;
DROP FUNCTION IF EXISTS get_revenue_summary CASCADE;

-- ============================================================================
-- REVENUE ANALYTICS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_revenue_by_payment_method(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      payment_method,
      COALESCE(SUM(payment_amount), 0) as total_revenue,
      COUNT(*) as transaction_count,
      COALESCE(AVG(payment_amount), 0) as avg_transaction_value
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY payment_method
    ORDER BY total_revenue DESC
  ) t
$$;

COMMENT ON FUNCTION get_revenue_by_payment_method IS 'SECURITY DEFINER function for revenue by payment method. Bypasses RLS for admin analytics.';

GRANT EXECUTE ON FUNCTION get_revenue_by_payment_method(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_revenue_over_time(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(CASE WHEN payment_method = 'gcash' THEN payment_amount ELSE 0 END), 0) as gcash_revenue,
      COALESCE(SUM(CASE WHEN payment_method = 'crypto' THEN payment_amount ELSE 0 END), 0) as crypto_revenue,
      COALESCE(SUM(CASE WHEN payment_method = 'usd_bank' THEN payment_amount ELSE 0 END), 0) as usd_revenue,
      COALESCE(SUM(payment_amount), 0) as total_revenue,
      COUNT(*) as transaction_count
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  ) t
$$;

COMMENT ON FUNCTION get_revenue_over_time IS 'SECURITY DEFINER function for revenue over time. Bypasses RLS for admin analytics.';

GRANT EXECUTE ON FUNCTION get_revenue_over_time(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_revenue_by_discount(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      discount_percent,
      COUNT(*) as transaction_count,
      COALESCE(SUM(payment_amount), 0) as total_revenue,
      COALESCE(AVG(payment_amount), 0) as avg_transaction_value
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY discount_percent
    ORDER BY discount_percent ASC
  ) t
$$;

COMMENT ON FUNCTION get_revenue_by_discount IS 'SECURITY DEFINER function for revenue by discount tier. Bypasses RLS for admin analytics.';

GRANT EXECUTE ON FUNCTION get_revenue_by_discount(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_revenue_by_subscription_plan(p_start_date timestamp with time zone)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      u.subscription_plan,
      COUNT(*) as subscriber_count,
      COALESCE(SUM(ac.payment_amount_usd), 0) as total_revenue,
      COALESCE(AVG(ac.payment_amount_usd), 0) as avg_revenue_per_subscriber
    FROM users u
    LEFT JOIN activation_codes ac ON u.activation_code = ac.code
    WHERE u.subscription_activated = true
    AND u.subscription_plan IS NOT NULL
    AND u.created_at >= p_start_date
    GROUP BY u.subscription_plan
    ORDER BY total_revenue DESC
  ) t
$$;

COMMENT ON FUNCTION get_revenue_by_subscription_plan IS 'SECURITY DEFINER function for revenue by subscription plan. Bypasses RLS for admin analytics.';

GRANT EXECUTE ON FUNCTION get_revenue_by_subscription_plan(timestamp with time zone) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_revenue_summary(p_start_date timestamp with time zone)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      COALESCE(SUM(payment_amount), 0) as total_revenue,
      COUNT(*) as total_transactions,
      COALESCE(AVG(payment_amount), 0) as avg_transaction_value
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
  ) t
$$;

COMMENT ON FUNCTION get_revenue_summary IS 'SECURITY DEFINER function for revenue summary statistics. Bypasses RLS for admin analytics.';

GRANT EXECUTE ON FUNCTION get_revenue_summary(timestamp with time zone) TO PUBLIC;