-- Migration 081: Fix empty array type inference in update_activation_code_qr_urls

BEGIN;

DROP FUNCTION IF EXISTS update_activation_code_qr_urls(int, text, text, int) CASCADE;
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
  update_fields text[] := ARRAY[]::text[];
  update_values text[] := ARRAY[]::text[];
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

GRANT EXECUTE ON FUNCTION update_activation_code_qr_urls(int, text, text, int) TO PUBLIC;

COMMIT;