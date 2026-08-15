-- ============================================================================
-- 103: Status writes must go through SECURITY DEFINER functions
--
-- The PATCH /api/quotes/[id]/status route used a direct UPDATE on quotes,
-- which is subject to RLS/session context and silently affected 0 rows in
-- production. All other quote writes go through SECURITY DEFINER functions.
--
-- Also, create_quote() never accepted a status, so the create-order form's
-- status select (e.g. "Delivered") was silently dropped and every quote was
-- created as 'draft'.
--
-- Fix:
--   1. Add update_quote_status() SECURITY DEFINER function (with the
--      delivered-lock guard) and use it from the status PATCH route.
--   2. Add an optional p_status param to create_quote() (default 'draft')
--      and pass it from the POST route.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- update_quote_status: guarded, tenant-safe status change
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS update_quote_status CASCADE;
CREATE OR REPLACE FUNCTION update_quote_status(p_quote_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('draft', 'sent', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status. Must be one of: draft, sent, delivered, cancelled';
  END IF;

  SELECT company_id INTO v_company_id FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_company_id != get_current_company_id() AND NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Cannot update quotes from different company';
  END IF;

  IF (SELECT status FROM quotes WHERE id = p_quote_id) = 'delivered' AND p_status <> 'delivered' THEN
    RAISE EXCEPTION 'Cannot change status from delivered.';
  END IF;

  UPDATE quotes
  SET status = p_status,
      updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION update_quote_status(uuid, text) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- create_quote: accept status (default 'draft')
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS create_quote CASCADE;
CREATE OR REPLACE FUNCTION create_quote(
  p_company_id uuid, p_quote_number text, p_customer_name text, p_customer_address text,
  p_customer_name_encrypted bytea, p_customer_address_encrypted bytea,
  p_quote_date date, p_our_ref text, p_installation_fee numeric, p_delivery_fee numeric,
  p_subtotal numeric, p_total numeric, p_total_area numeric, p_panel_count int,
  p_status text DEFAULT 'draft'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  IF p_company_id != get_current_company_id() AND NOT is_current_user_superadmin() THEN
    RAISE EXCEPTION 'Security: Cannot create quotes for different company';
  END IF;

  INSERT INTO quotes (
    company_id, quote_number, customer_name, customer_address,
    customer_name_encrypted, customer_address_encrypted,
    quote_date, our_ref, installation_fee, delivery_fee,
    subtotal, total, total_area, panel_count, status
  ) VALUES (
    p_company_id, p_quote_number, p_customer_name, p_customer_address,
    p_customer_name_encrypted, p_customer_address_encrypted,
    p_quote_date, p_our_ref, p_installation_fee, p_delivery_fee,
    p_subtotal, p_total, p_total_area, p_panel_count, p_status
  )
  RETURNING id, quote_number, customer_name, customer_address, created_at INTO v_quote;

  RETURN row_to_json(v_quote)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION create_quote(
  uuid, text, text, text, bytea, bytea, date, text,
  numeric, numeric, numeric, numeric, numeric, int, text
) TO PUBLIC;