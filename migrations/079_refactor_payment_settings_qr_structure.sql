-- Migration 079: Refactor payment_settings into payment_qr_codes + pricing_config
--
-- payment_settings  -> per-method account info only (drops 6 period QR columns + 2 discount columns)
-- payment_qr_codes  -> NEW: one row per (payment_method, billing_period), same shape the admin UI already uses
-- discounts         -> single source of truth is pricing_config (already managed at /admin/pricing)

BEGIN;

-- ============================================================================
-- 1. Create payment_qr_codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_qr_codes (
  payment_method VARCHAR(20) NOT NULL,
  billing_period VARCHAR(20) NOT NULL,
  qr_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (payment_method, billing_period),
  CONSTRAINT valid_payment_qr_method CHECK (payment_method IN ('gcash', 'gotyme')),
  CONSTRAINT valid_payment_qr_period CHECK (billing_period IN ('monthly', 'quarterly', 'annual'))
);

CREATE INDEX IF NOT EXISTS idx_payment_qr_codes_method ON payment_qr_codes(payment_method);

COMMENT ON TABLE payment_qr_codes IS 'Plan/billing-period specific QR codes, one row per (payment method, billing period)';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payment_qr_codes TO concetto_boms;

-- ============================================================================
-- 2. Migrate existing period QR data from payment_settings columns
-- ============================================================================

INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url, created_at, updated_at)
SELECT 'gcash', 'monthly', gcash_monthly_qr_url, NOW(), NOW()
FROM payment_settings WHERE gcash_monthly_qr_url IS NOT NULL AND gcash_monthly_qr_url <> '';

INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url, created_at, updated_at)
SELECT 'gcash', 'quarterly', gcash_quarterly_qr_url, NOW(), NOW()
FROM payment_settings WHERE gcash_quarterly_qr_url IS NOT NULL AND gcash_quarterly_qr_url <> '';

INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url, created_at, updated_at)
SELECT 'gcash', 'annual', gcash_annual_qr_url, NOW(), NOW()
FROM payment_settings WHERE gcash_annual_qr_url IS NOT NULL AND gcash_annual_qr_url <> '';

INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url, created_at, updated_at)
SELECT 'gotyme', 'monthly', gotyme_monthly_qr_url, NOW(), NOW()
FROM payment_settings WHERE gotyme_monthly_qr_url IS NOT NULL AND gotyme_monthly_qr_url <> '';

INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url, created_at, updated_at)
SELECT 'gotyme', 'quarterly', gotyme_quarterly_qr_url, NOW(), NOW()
FROM payment_settings WHERE gotyme_quarterly_qr_url IS NOT NULL AND gotyme_quarterly_qr_url <> '';

INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url, created_at, updated_at)
SELECT 'gotyme', 'annual', gotyme_annual_qr_url, NOW(), NOW()
FROM payment_settings WHERE gotyme_annual_qr_url IS NOT NULL AND gotyme_annual_qr_url <> '';

-- ============================================================================
-- 3. Drop obsolete payment_settings columns
-- ============================================================================

ALTER TABLE payment_settings
  DROP COLUMN IF EXISTS gcash_monthly_qr_url,
  DROP COLUMN IF EXISTS gcash_quarterly_qr_url,
  DROP COLUMN IF EXISTS gcash_annual_qr_url,
  DROP COLUMN IF EXISTS gotyme_monthly_qr_url,
  DROP COLUMN IF EXISTS gotyme_quarterly_qr_url,
  DROP COLUMN IF EXISTS gotyme_annual_qr_url,
  DROP COLUMN IF EXISTS quarterly_discount_percent,
  DROP COLUMN IF EXISTS annual_discount_percent;

-- Generic fallback QR is now optional (nullable)
ALTER TABLE payment_settings ALTER COLUMN qr_code_url DROP NOT NULL;

COMMENT ON TABLE payment_settings IS 'Stores per-payment-method account configuration (account name/number, fallback QR, active flag)';

-- ============================================================================
-- 4. RLS on payment_qr_codes (mirror payment_settings policies)
-- ============================================================================

ALTER TABLE payment_qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_qr_codes_read_all ON payment_qr_codes;
DROP POLICY IF EXISTS payment_qr_codes_superadmin_write ON payment_qr_codes;
DROP POLICY IF EXISTS payment_qr_codes_critical_protection ON payment_qr_codes;

CREATE POLICY payment_qr_codes_read_all ON payment_qr_codes
  FOR SELECT
  TO concetto_boms
  USING (true);

CREATE POLICY payment_qr_codes_superadmin_write ON payment_qr_codes
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

CREATE POLICY payment_qr_codes_critical_protection ON payment_qr_codes
  FOR UPDATE
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- ============================================================================
-- 5. Replace SQL functions (discounts removed from payment settings)
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_payment_settings CASCADE;
CREATE OR REPLACE FUNCTION upsert_payment_settings(
  p_payment_method text,
  p_account_number text,
  p_account_name text,
  p_qr_code_url text,
  p_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Admin access required for payment settings modification';
  END IF;

  INSERT INTO payment_settings (payment_method, account_number, account_name, qr_code_url, active)
  VALUES (p_payment_method, p_account_number, p_account_name, p_qr_code_url, p_active)
  ON CONFLICT (payment_method) DO UPDATE SET
    account_number = EXCLUDED.account_number,
    account_name = EXCLUDED.account_name,
    qr_code_url = EXCLUDED.qr_code_url,
    active = EXCLUDED.active,
    updated_at = CURRENT_TIMESTAMP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_payment_settings(text, text, text, text, boolean) TO PUBLIC;

DROP FUNCTION IF EXISTS upsert_payment_qr_code CASCADE;
CREATE OR REPLACE FUNCTION upsert_payment_qr_code(
  p_payment_method text,
  p_billing_period text,
  p_qr_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Admin access required for QR code modification';
  END IF;

  INSERT INTO payment_qr_codes (payment_method, billing_period, qr_url)
  VALUES (p_payment_method, p_billing_period, p_qr_url)
  ON CONFLICT (payment_method, billing_period) DO UPDATE SET
    qr_url = EXCLUDED.qr_url,
    updated_at = CURRENT_TIMESTAMP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_payment_qr_code(text, text, text) TO PUBLIC;

DROP FUNCTION IF EXISTS clear_payment_qr_code CASCADE;
CREATE OR REPLACE FUNCTION clear_payment_qr_code(
  p_payment_method text,
  p_billing_period text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Admin access required for QR code modification';
  END IF;

  DELETE FROM payment_qr_codes
  WHERE payment_method = p_payment_method AND billing_period = p_billing_period;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION clear_payment_qr_code(text, text) TO PUBLIC;

COMMIT;