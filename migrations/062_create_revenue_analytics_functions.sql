-- ============================================================================
-- CREATE REVENUE ANALYTICS FUNCTIONS - SECURITY DEFINER
-- ============================================================================
-- Issue: Analytics queries joining with users table are blocked by RLS policies
-- Solution: Create SECURITY DEFINER functions to handle revenue analytics
--          This bypasses RLS for admin analytics while maintaining security

-- ============================================================================
-- CREATE: get_revenue_by_subscription_plan function - SECURITY DEFINER for analytics
-- ============================================================================

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
      COUNT(*) as subscription_count,
      COALESCE(SUM(ac.payment_amount), 0) as total_revenue,
      AVG(ac.payment_amount) as avg_revenue_per_subscription
    FROM users u
    INNER JOIN activation_codes ac ON u.activation_code = ac.code
    WHERE u.subscription_activated = true
    AND u.subscription_plan IS NOT NULL
    AND ac.used_at IS NOT NULL
    AND ac.created_at >= p_start_date
    GROUP BY u.subscription_plan
    ORDER BY total_revenue DESC
  ) t
$$;

COMMENT ON FUNCTION get_revenue_by_subscription_plan IS 'SECURITY DEFINER function for revenue analytics by subscription plan. Bypasses RLS for admin analytics purposes.';

-- ============================================================================
-- CREATE: get_revenue_by_payment_method function - SECURITY DEFINER for analytics
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
      COALESCE(SUM(payment_amount), 0) as total_amount,
      COUNT(*) as transaction_count,
      AVG(payment_amount) as avg_transaction_value
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY payment_method
    ORDER BY total_amount DESC
  ) t
$$;

COMMENT ON FUNCTION get_revenue_by_payment_method IS 'SECURITY DEFINER function for revenue analytics by payment method. Bypasses RLS for admin analytics purposes.';

-- ============================================================================
-- CREATE: get_revenue_over_time function - SECURITY DEFINER for analytics
-- ============================================================================

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
      COALESCE(SUM(CASE WHEN payment_method = 'gcash' THEN payment_amount ELSE 0 END), 0) as gcash,
      COALESCE(SUM(CASE WHEN payment_method = 'crypto' THEN payment_amount ELSE 0 END), 0) as crypto,
      COALESCE(SUM(CASE WHEN payment_method = 'usd_bank' THEN payment_amount ELSE 0 END), 0) as usd_bank,
      COALESCE(SUM(CASE WHEN payment_method = 'other' THEN payment_amount ELSE 0 END), 0) as other,
      COALESCE(SUM(payment_amount), 0) as total
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  ) t
$$;

COMMENT ON FUNCTION get_revenue_over_time IS 'SECURITY DEFINER function for revenue analytics over time. Bypasses RLS for admin analytics purposes.';

-- ============================================================================
-- CREATE: get_revenue_by_discount function - SECURITY DEFINER for analytics
-- ============================================================================

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
      COUNT(*) as code_count,
      COALESCE(SUM(payment_amount), 0) as total_revenue,
      AVG(payment_amount) as avg_revenue_per_code
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
    GROUP BY discount_percent
    ORDER BY discount_percent ASC
  ) t
$$;

COMMENT ON FUNCTION get_revenue_by_discount IS 'SECURITY DEFINER function for revenue analytics by discount tier. Bypasses RLS for admin analytics purposes.';

-- ============================================================================
-- CREATE: get_revenue_summary function - SECURITY DEFINER for analytics
-- ============================================================================

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
      AVG(payment_amount) as avg_transaction_value
    FROM activation_codes
    WHERE used_at IS NOT NULL
    AND created_at >= p_start_date
  ) t
$$;

COMMENT ON FUNCTION get_revenue_summary IS 'SECURITY DEFINER function for revenue summary statistics. Bypasses RLS for admin analytics purposes.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_revenue_by_subscription_plan(timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_revenue_by_payment_method(timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_revenue_over_time(timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_revenue_by_discount(timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_revenue_summary(timestamp with time zone) TO PUBLIC;

COMMENT ON SCHEMA public IS 'ADDED: revenue analytics SECURITY DEFINER functions - bypasses RLS for admin analytics';