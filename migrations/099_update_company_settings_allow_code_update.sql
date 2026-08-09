-- Migration 099: Allow Company Code Update via update_company_settings
-- Purpose: Let a company change its code from the Settings page. The code is a
-- business identifier used for account joining, so it must stay unique,
-- non-empty, and uppercased consistently with check_company_exists().

DROP FUNCTION IF EXISTS update_company_settings(uuid, text, text, text, text, text, text, text, text, text, numeric) CASCADE;

CREATE OR REPLACE FUNCTION update_company_settings(
  p_company_id uuid,
  p_code text,
  p_name text,
  p_address text,
  p_mobile text,
  p_email text,
  p_currency text,
  p_prepared_by text,
  p_terms text,
  p_del_note text,
  p_closing_note text,
  p_minimum_area_sqft numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_company RECORD;
BEGIN
  IF p_company_id != get_current_company_id() AND NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Cannot modify settings from different company';
  END IF;

  v_code := UPPER(BTRIM(COALESCE(p_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Company code is required';
  END IF;

  IF EXISTS (SELECT 1 FROM companies WHERE UPPER(code) = v_code AND id != p_company_id) THEN
    RAISE EXCEPTION 'Company code already exists';
  END IF;

  UPDATE companies SET
    code             = v_code,
    name             = p_name,
    address          = p_address,
    mobile           = p_mobile,
    email            = p_email,
    currency         = p_currency,
    prepared_by      = p_prepared_by,
    terms            = p_terms,
    del_note         = p_del_note,
    closing_note     = p_closing_note,
    minimum_area_sqft = p_minimum_area_sqft,
    updated_at       = now()
  WHERE id = p_company_id
  RETURNING id, code, name as company, address, mobile, email, currency,
            prepared_by, terms, del_note, closing_note, updated_at, subscription_status,
            minimum_area_sqft::float
  INTO v_company;

  RETURN row_to_json(v_company)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION update_company_settings(uuid, text, text, text, text, text, text, text, text, text, text, numeric) TO PUBLIC;
