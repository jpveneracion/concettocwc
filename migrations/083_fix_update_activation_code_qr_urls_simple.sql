-- Migration 083: Rewrite update_activation_code_qr_urls without dynamic SQL

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
  v_gcash_qr_url text;
  v_gotyme_qr_url text;
  v_usage_limit int;
BEGIN
  -- Update only provided fields, keep existing values for others
  UPDATE activation_codes
  SET
    gcash_qr_url = COALESCE(p_gcash_qr_url, gcash_qr_url),
    gotyme_qr_url = COALESCE(p_gotyme_qr_url, gotyme_qr_url),
    usage_limit = COALESCE(p_usage_limit, usage_limit)
  WHERE id = p_promo_code_id
  RETURNING gcash_qr_url, gotyme_qr_url, usage_limit
  INTO v_gcash_qr_url, v_gotyme_qr_url, v_usage_limit;

  RETURN json_build_object(
    'success', true,
    'promo_code_id', p_promo_code_id,
    'gcash_qr_url', COALESCE(v_gcash_qr_url, p_gcash_qr_url),
    'gotyme_qr_url', COALESCE(v_gotyme_qr_url, p_gotyme_qr_url),
    'usage_limit', COALESCE(v_usage_limit, p_usage_limit)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_activation_code_qr_urls(int, text, text, int) TO PUBLIC;

COMMIT;