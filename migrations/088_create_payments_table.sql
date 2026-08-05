-- 088: Payments ledger table + verification amount/method columns
--
-- Creates a dedicated `payments` table as the source of truth for revenue
-- analytics. Approved payment verifications are moved (inserted then deleted)
-- into this table so the verification queue only holds unreviewed submissions.
--
-- Also rewrites the 5 revenue analytics SECURITY DEFINER functions to read
-- from `payments` instead of `activation_codes` (promo redemptions).

-- ============================================================================
-- 1. Payment verification columns (captured at submission time)
-- ============================================================================
ALTER TABLE payment_verifications
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- ============================================================================
-- 2. Payments ledger table
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL REFERENCES users(id),
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  reference_number text,
  promo_code text,
  discount_amount numeric NOT NULL DEFAULT 0,
  admin_notes text,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_company_created ON payments (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments (payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments (plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at);

-- ============================================================================
-- 3. RLS policies (mirrors payment_verifications tenant isolation model)
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

DROP POLICY IF EXISTS payments_admin_access ON payments;
CREATE POLICY payments_admin_access ON payments
  FOR ALL
  USING (
    is_current_user_admin()
    AND company_id = get_current_company_id()
  )
  WITH CHECK (
    is_current_user_admin()
    AND company_id = get_current_company_id()
  );

DROP POLICY IF EXISTS payments_read_only ON payments;
CREATE POLICY payments_read_only ON payments
  FOR SELECT
  USING (
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- 4. Revenue analytics functions (rewritten to query `payments`)
-- ============================================================================
DROP FUNCTION IF EXISTS get_revenue_by_payment_method(timestamp with time zone);
DROP FUNCTION IF EXISTS get_revenue_over_time(timestamp with time zone);
DROP FUNCTION IF EXISTS get_revenue_by_discount(timestamp with time zone);
DROP FUNCTION IF EXISTS get_revenue_by_subscription_plan(timestamp with time zone);
DROP FUNCTION IF EXISTS get_revenue_summary(timestamp with time zone);

CREATE OR REPLACE FUNCTION get_revenue_by_payment_method(p_start_date timestamp with time zone)
RETURNS json AS $$
  SELECT COALESCE(json_agg(t ORDER BY total_revenue DESC), '[]'::json)
  FROM (
    SELECT
      payment_method,
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) as transaction_count,
      COALESCE(AVG(amount), 0) as avg_transaction_value
    FROM payments
    WHERE created_at >= p_start_date
    GROUP BY payment_method
  ) t;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_revenue_over_time(p_start_date timestamp with time zone)
RETURNS json AS $$
  SELECT COALESCE(json_agg(t ORDER BY date DESC), '[]'::json)
  FROM (
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(CASE WHEN payment_method = 'gcash' THEN amount ELSE 0 END), 0) as gcash_revenue,
      COALESCE(SUM(CASE WHEN payment_method = 'gotyme' THEN amount ELSE 0 END), 0) as gotyme_revenue,
      COALESCE(SUM(CASE WHEN payment_method IN ('usdc', 'crypto') THEN amount ELSE 0 END), 0) as crypto_revenue,
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) as transaction_count
    FROM payments
    WHERE created_at >= p_start_date
    GROUP BY DATE(created_at)
    LIMIT 30
  ) t;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_revenue_by_discount(p_start_date timestamp with time zone)
RETURNS json AS $$
  SELECT COALESCE(json_agg(t ORDER BY discount_percent ASC), '[]'::json)
  FROM (
    SELECT
      COALESCE(ac.discount_percent, 0) as discount_percent,
      COUNT(*) as transaction_count,
      COALESCE(SUM(p.amount), 0) as total_revenue,
      COALESCE(AVG(p.amount), 0) as avg_transaction_value
    FROM payments p
    LEFT JOIN activation_codes ac ON ac.code = p.promo_code
    WHERE p.created_at >= p_start_date
    GROUP BY discount_percent
  ) t;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_revenue_by_subscription_plan(p_start_date timestamp with time zone)
RETURNS json AS $$
  SELECT COALESCE(json_agg(t ORDER BY total_revenue DESC), '[]'::json)
  FROM (
    SELECT
      COALESCE(sp.name, p.plan_id::text) as subscription_plan,
      COUNT(DISTINCT p.user_id) as subscriber_count,
      COUNT(*) as transaction_count,
      COALESCE(SUM(p.amount), 0) as total_revenue,
      COALESCE(AVG(p.amount), 0) as avg_revenue_per_subscriber
    FROM payments p
    LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
    WHERE p.created_at >= p_start_date
    GROUP BY sp.name, p.plan_id
  ) t;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_revenue_summary(p_start_date timestamp with time zone)
RETURNS json AS $$
  SELECT COALESCE(json_agg(t), '[]'::json)
  FROM (
    SELECT
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) as total_transactions,
      COALESCE(AVG(amount), 0) as avg_transaction_value
    FROM payments
    WHERE created_at >= p_start_date
  ) t;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;
