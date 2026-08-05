-- Migration 084: Add SECURITY DEFINER function for promo code validation during payment
-- Bypasses RLS for public payment flow promo code validation

BEGIN;

-- Function to validate promo code for payment (bypasses RLS via SECURITY DEFINER)
DROP FUNCTION IF EXISTS validate_promo_code_for_payment(text, numeric, text) CASCADE;
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
  v_resolved_plan text;
  v_final_amount numeric;
  v_discount_amount numeric;
BEGIN
  -- Resolve plan identifier
  IF p_plan IN ('basic', 'pro', 'premium', 'trial', 'enterprise', 'BASIC', 'PRO', 'PREMIUM', 'TRIAL', 'ENTERPRISE') THEN
    v_resolved_plan := upper(p_plan);
  ELSE
    -- Resolve from price (same logic as application)
    IF p_plan_price < 600 THEN
      v_resolved_plan := 'BASIC';
    ELSIF p_plan_price < 1500 THEN
      v_resolved_plan := 'PRO';
    ELSIF p_plan_price < 3000 THEN
      v_resolved_plan := 'PREMIUM';
    ELSE
      v_resolved_plan := 'ENTERPRISE';
    END IF;
  END IF;

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

  -- Check if code applies to requested plan
  IF NOT (v_activation_code.applicable_plans @> (v_resolved_plan)::text[]) THEN
    RETURN json_build_object('valid', false, 'error', 'Promo code not applicable to ' || v_resolved_plan || ' plan');
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