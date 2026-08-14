-- ============================================================================
-- 102: Add supplier information for Purchase Orders
--
-- The PO printout's "To:" block currently reuses the quote customer, and
-- shows "[Protected Data]" when customer decryption fails. A PO should be
-- addressed to the supplier. Add supplier contact fields to the companies
-- table (plaintext, consistent with other company contact fields),
-- surfaced through get_company_settings() and update_company_settings().
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_address text,
  ADD COLUMN IF NOT EXISTS supplier_phone text,
  ADD COLUMN IF NOT EXISTS supplier_email text;

-- ---------------------------------------------------------------------------
-- get_company_settings: expose supplier fields
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_company_settings CASCADE;
CREATE OR REPLACE FUNCTION get_company_settings(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF p_company_id != get_current_company_id() AND NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Cannot access settings from different company';
  END IF;

  SELECT row_to_json(t)::json INTO result
  FROM (
    SELECT
      id, code, name as company, address, mobile, email, currency,
      prepared_by, terms, del_note, closing_note, updated_at, subscription_status,
      minimum_area_sqft::float,
      supplier_name, supplier_address, supplier_phone, supplier_email
    FROM companies
    WHERE id = p_company_id
  ) t;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- update_company_settings: accept + persist supplier fields
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS update_company_settings CASCADE;
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
  p_minimum_area_sqft numeric,
  p_supplier_name text,
  p_supplier_address text,
  p_supplier_phone text,
  p_supplier_email text
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
    code              = v_code,
    name              = p_name,
    address           = p_address,
    mobile            = p_mobile,
    email             = p_email,
    currency          = p_currency,
    prepared_by       = p_prepared_by,
    terms             = p_terms,
    del_note          = p_del_note,
    closing_note      = p_closing_note,
    minimum_area_sqft = p_minimum_area_sqft,
    supplier_name     = p_supplier_name,
    supplier_address  = p_supplier_address,
    supplier_phone    = p_supplier_phone,
    supplier_email    = p_supplier_email,
    updated_at        = now()
  WHERE id = p_company_id
  RETURNING id, code, name as company, address, mobile, email, currency,
            prepared_by, terms, del_note, closing_note, updated_at, subscription_status,
            minimum_area_sqft::float,
            supplier_name, supplier_address, supplier_phone, supplier_email
  INTO v_company;

  RETURN row_to_json(v_company)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_settings(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION update_company_settings(uuid, text, text, text, text, text, text, text, text, text, text, numeric, text, text, text, text) TO PUBLIC;