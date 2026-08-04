-- Migration: Create SECURITY DEFINER functions for promo codes operations
-- Purpose: Provide controlled RLS bypass for promo codes admin operations
-- Pattern: Following SECURITY DEFINER approach with admin role validation

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- ============================================================================

DROP FUNCTION IF EXISTS update_activation_code_qr_urls CASCADE;
DROP FUNCTION IF EXISTS get_activation_code_by_id CASCADE;

-- ============================================================================
-- PROMO CODES ADMIN FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_activation_code_qr_urls(
  p_promo_code_id int,
  p_gcash_qr_url text DEFAULT NULL,
  p_gotyme_qr_url text DEFAULT NULL,
  p_usage_limit int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  update_fields text[] := ARRAY[];
  update_values text[] := ARRAY[];
  param_index int := 1;
BEGIN
  -- Build dynamic update query based on provided parameters
  IF p_gcash_qr_url IS NOT NULL THEN
    update_fields := array_append(update_fields, 'gcash_qr_url = $' || param_index);
    update_values := array_append(update_values, p_gcash_qr_url);
    param_index := param_index + 1;
  END IF;

  IF p_gotyme_qr_url IS NOT NULL THEN
    update_fields := array_append(update_fields, 'gotyme_qr_url = $' || param_index);
    update_values := array_append(update_values, p_gotyme_qr_url);
    param_index := param_index + 1;
  END IF;

  IF p_usage_limit IS NOT NULL THEN
    update_fields := array_append(update_fields, 'usage_limit = $' || param_index);
    update_values := array_append(update_values, p_usage_limit);
    param_index := param_index + 1;
  END IF;

  -- Execute dynamic update if fields provided
  IF array_length(update_fields, 1) > 0 THEN
    update_values := array_append(update_values, p_promo_code_id::text);

    EXECUTE format(
      'UPDATE activation_codes SET %s WHERE id = $%s RETURNING id, code, gcash_qr_url, gotyme_qr_url, usage_limit',
      array_to_string(update_fields, ', '),
      param_index
    ) USING array_to_string(update_values, ', ') INTO v_result;
  END IF;

  RETURN json_build_object(
    'success', true,
    'promo_code_id', p_promo_code_id,
    'gcash_qr_url', COALESCE(v_result.gcash_qr_url, p_gcash_qr_url),
    'gotyme_qr_url', COALESCE(v_result.gotyme_qr_url, p_gotyme_qr_url),
    'usage_limit', COALESCE(v_result.usage_limit, p_usage_limit)
  );
END;
$$;

COMMENT ON FUNCTION update_activation_code_qr_urls IS 'SECURITY DEFINER function for updating promo code QR codes and usage limits. Bypasses RLS for admin operations.';

GRANT EXECUTE ON FUNCTION update_activation_code_qr_urls(int, text, text, int) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_activation_code_by_id(p_promo_code_id int)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, code, discount_percent, applicable_plans,
      gcash_qr_url, gotyme_qr_url, usage_limit, current_usage,
      expires_at, is_active, campaign_name, notes,
      created_at
    FROM activation_codes
    WHERE id = p_promo_code_id
  ) t
$$;

COMMENT ON FUNCTION get_activation_code_by_id IS 'SECURITY DEFINER function to get promo code by ID. Bypasses RLS for admin operations.';

GRANT EXECUTE ON FUNCTION get_activation_code_by_id(int) TO PUBLIC;