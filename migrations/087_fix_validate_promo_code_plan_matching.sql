-- Migration 087: Fix validate_promo_code_for_payment - case-insensitive plan matching
-- Resolves billing period from plan name and tier from price, then checks
-- applicable_plans (jsonb array of strings) against both candidates,
-- matching case-insensitively. Supersedes the ?| case-sensitive check in 086.

BEGIN;

CREATE OR REPLACE FUNCTION validate_promo_code_for_payment(
  p_code text,
  p_plan_price numeric,
  p_plan text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation_code RECORD;
  v_period text;
  v_tier text;
  v_candidates text[];
  v_final_amount numeric;
  v_discount_amount numeric;
BEGIN
  -- Derive billing period from plan name if present (e.g. "Monthly Plan", "Annual Plan")
  IF p_plan ILIKE '%month%' THEN
    v_period := 'monthly';
  ELSIF p_plan ILIKE '%quarter%' THEN
    v_period := 'quarterly';
  ELSIF p_plan ILIKE '%annual%' OR p_plan ILIKE '%year%' THEN
    v_period := 'annual';
  END IF;

  -- Derive tier from price
  IF p_plan_price < 600 THEN
    v_tier := 'basic';
  ELSIF p_plan_price < 1500 THEN
    v_tier := 'pro';
  ELSIF p_plan_price < 3000 THEN
    v_tier := 'premium';
  ELSE
    v_tier := 'enterprise';
  END IF;

  v_candidates := ARRAY[v_period, v_tier]::text[];

  -- Find the activation code
  SELECT * INTO v_activation_code
  FROM activation_codes
  WHERE code = p_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Promo code not found');
  END IF;

  -- Check if active
  IF NOT v_activation_code.is_active THEN
    RETURN json_build_object('valid', false, 'error', 'Promo code is inactive');
  END IF;

  -- Check expiration
  IF v_activation_code.expires_at IS NOT NULL AND v_activation_code.expires_at < NOW() THEN
    RETURN json_build_object('valid', false, 'error', 'Promo code has expired');
  END IF;

  -- Check if code applies to requested plan - case-insensitive match against
  -- both the billing period and the tier derived from price
  IF v_activation_code.applicable_plans IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_activation_code.applicable_plans) AS elem
      WHERE lower(elem) = ANY (v_candidates)
    ) THEN
      RETURN json_build_object('valid', false, 'error', 'Promo code not applicable to this plan');
    END IF;
  END IF;

  -- Check usage limits
  IF v_activation_code.usage_limit IS NOT NULL THEN
    IF COALESCE(v_activation_code.current_usage, 0) >= v_activation_code.usage_limit THEN
      RETURN json_build_object('valid', false, 'error', 'Promo code has reached maximum usage');
    END IF;
  ELSE
    -- One-time use codes (existing system)
    IF v_activation_code.used_by IS NOT NULL THEN
      RETURN json_build_object('valid', false, 'error', 'Promo code has already been used');
    END IF;
  END IF;

  -- Calculate final amount
  v_discount_amount := p_plan_price * (v_activation_code.discount_percent / 100);
  v_final_amount := p_plan_price - v_discount_amount;

  RETURN json_build_object(
    'valid', true,
    'discount_percent', v_activation_code.discount_percent,
    'discount_amount', v_discount_amount,
    'gcash_qr_url', v_activation_code.gcash_qr_url,
    'gotyme_qr_url', v_activation_code.gotyme_qr_url,
    'final_amount', GREATEST(0, v_final_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_promo_code_for_payment(text, numeric, text) TO PUBLIC;

COMMIT;
