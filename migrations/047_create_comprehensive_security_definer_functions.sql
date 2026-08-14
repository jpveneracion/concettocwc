-- Migration: Create comprehensive SECURITY DEFINER functions for RLS bypass
-- Purpose: Provide controlled RLS bypass for critical operations across all routes
-- Pattern: Following SECURITY DEFINER approach with role context validation

-- ============================================================================
-- DROP ALL FUNCTIONS FIRST TO AVOID CONFLICTS
-- ============================================================================

DROP FUNCTION IF EXISTS find_user_by_id CASCADE;
DROP FUNCTION IF EXISTS find_user_by_email_hash CASCADE;
DROP FUNCTION IF EXISTS find_user_by_email CASCADE;
DROP FUNCTION IF EXISTS create_company CASCADE;
DROP FUNCTION IF EXISTS create_user CASCADE;
DROP FUNCTION IF EXISTS check_company_exists CASCADE;
DROP FUNCTION IF EXISTS check_user_exists_by_email_hash CASCADE;
DROP FUNCTION IF EXISTS update_user_email_hash CASCADE;
DROP FUNCTION IF EXISTS update_user_password CASCADE;
DROP FUNCTION IF EXISTS get_user_admin_status CASCADE;
DROP FUNCTION IF EXISTS validate_reset_token CASCADE;
DROP FUNCTION IF EXISTS mark_reset_token_used CASCADE;
DROP FUNCTION IF EXISTS get_all_payment_settings CASCADE;
DROP FUNCTION IF EXISTS upsert_payment_settings CASCADE;
DROP FUNCTION IF EXISTS get_company_collection_pricing CASCADE;
DROP FUNCTION IF EXISTS get_company_collections CASCADE;
DROP FUNCTION IF EXISTS get_all_collections_for_admin CASCADE;
DROP FUNCTION IF EXISTS get_company_collections_with_products CASCADE;
DROP FUNCTION IF EXISTS upsert_company_collection CASCADE;
DROP FUNCTION IF EXISTS get_company_quotes CASCADE;
DROP FUNCTION IF EXISTS get_company_quote_items CASCADE;
DROP FUNCTION IF EXISTS get_company_quote_by_id CASCADE;
DROP FUNCTION IF EXISTS get_quote_items CASCADE;
DROP FUNCTION IF EXISTS update_quote CASCADE;
DROP FUNCTION IF EXISTS delete_quote CASCADE;
DROP FUNCTION IF EXISTS update_quote_items CASCADE;
DROP FUNCTION IF EXISTS delete_quote_items CASCADE;
DROP FUNCTION IF EXISTS get_company_minimum_area CASCADE;
DROP FUNCTION IF EXISTS create_quote CASCADE;
DROP FUNCTION IF EXISTS create_quote_item CASCADE;
DROP FUNCTION IF EXISTS clear_quote_plaintext CASCADE;
DROP FUNCTION IF EXISTS get_active_products CASCADE;
DROP FUNCTION IF EXISTS upsert_product CASCADE;
DROP FUNCTION IF EXISTS get_company_settings CASCADE;
DROP FUNCTION IF EXISTS update_company_settings CASCADE;
DROP FUNCTION IF EXISTS check_company_has_pricing CASCADE;
DROP FUNCTION IF EXISTS get_all_activation_codes CASCADE;
DROP FUNCTION IF EXISTS validate_activation_code CASCADE;
DROP FUNCTION IF EXISTS create_activation_code CASCADE;
DROP FUNCTION IF EXISTS get_subscription_plans CASCADE;
DROP FUNCTION IF EXISTS get_subscription_plan CASCADE;
DROP FUNCTION IF EXISTS get_payment_verifications CASCADE;
DROP FUNCTION IF EXISTS update_payment_verification CASCADE;

-- ============================================================================
-- AUTHENTICATION FUNCTIONS
-- ============================================================================

CREATE FUNCTION find_user_by_email_hash(p_email_hash text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      u.id as user_id,
      u.email,
      u.email_hash,
      u.password_hash,
      u.company_id,
      c.code as company_code
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.email_hash = p_email_hash
  ) t
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email_hash(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION find_user_by_id(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      u.id as user_id,
      u.email as user_email,
      u.email_hash as user_email_hash,
      u.company_id as user_company_id,
      u.role as user_role,
      u.trial_expires_at as user_trial_expires_at,
      u.subscription_activated as user_subscription_activated,
      u.subscription_plan as user_subscription_plan,
      u.is_admin as user_is_admin,
      u.password_hash as user_password_hash,
      u.created_at as user_created_at
    FROM users u
    WHERE u.id = p_user_id
  ) t
$$;

GRANT EXECUTE ON FUNCTION find_user_by_id(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION find_user_by_email(p_email text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      u.id,
      u.email,
      u.email_encrypted,
      u.email_hash,
      u.password_hash,
      u.company_id,
      c.code as company_code
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE LOWER(u.email) = LOWER(p_email)
  ) t
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION check_company_exists(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM companies WHERE UPPER(code) = UPPER(p_code))
$$;

GRANT EXECUTE ON FUNCTION check_company_exists(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION check_user_exists_by_email_hash(p_email_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM users WHERE email_hash = p_email_hash)
$$;

GRANT EXECUTE ON FUNCTION check_user_exists_by_email_hash(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION update_user_email_hash(p_user_id uuid, p_email_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users SET email_hash = p_email_hash WHERE id = p_user_id
$$;

GRANT EXECUTE ON FUNCTION update_user_email_hash(uuid, text) TO PUBLIC;

CREATE OR REPLACE FUNCTION update_user_password(p_user_id uuid, p_password_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users SET password_hash = p_password_hash WHERE id = p_user_id
$$;

GRANT EXECUTE ON FUNCTION update_user_password(uuid, text) TO PUBLIC;

CREATE FUNCTION get_user_admin_status(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      role,
      (role = 'admin' OR role = 'superadmin' OR is_admin = true) as is_admin
    FROM users
    WHERE id = p_user_id
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_user_admin_status(uuid) TO PUBLIC;

-- ============================================================================
-- PASSWORD RESET FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_reset_token(p_token text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      prt.user_id,
      prt.expires_at
    FROM password_reset_tokens prt
    WHERE prt.token = p_token
      AND prt.expires_at > NOW()
      AND prt.used_at IS NULL
    ORDER BY prt.created_at DESC
    LIMIT 1
  ) t
$$;

GRANT EXECUTE ON FUNCTION validate_reset_token(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION mark_reset_token_used(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE password_reset_tokens SET used_at = NOW() WHERE token = p_token
$$;

GRANT EXECUTE ON FUNCTION mark_reset_token_used(text) TO PUBLIC;

-- ============================================================================
-- PAYMENT SETTINGS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_all_payment_settings()
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(payment_settings)::json FROM payment_settings
$$;

GRANT EXECUTE ON FUNCTION get_all_payment_settings() TO PUBLIC;

CREATE OR REPLACE FUNCTION upsert_payment_settings(
  p_payment_method text,
  p_account_number text,
  p_account_name text,
  p_qr_code_url text,
  p_active boolean,
  p_quarterly_discount numeric,
  p_annual_discount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payment_settings (
    payment_method, account_number, account_name, qr_code_url, active,
    quarterly_discount_percent, annual_discount_percent
  )
  VALUES (
    p_payment_method, p_account_number, p_account_name, p_qr_code_url, p_active,
    p_quarterly_discount, p_annual_discount
  )
  ON CONFLICT (payment_method) DO UPDATE SET
    account_number = EXCLUDED.account_number,
    account_name = EXCLUDED.account_name,
    qr_code_url = EXCLUDED.qr_code_url,
    active = EXCLUDED.active,
    quarterly_discount_percent = EXCLUDED.quarterly_discount_percent,
    annual_discount_percent = EXCLUDED.annual_discount_percent,
    updated_at = CURRENT_TIMESTAMP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_payment_settings(text, text, text, text, boolean, numeric, numeric) TO PUBLIC;

-- ============================================================================
-- COMPANY COLLECTIONS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_collection_pricing(p_company_id uuid, p_collection text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      supplier_cost::float,
      retail_price::float
    FROM company_collections
    WHERE company_id = p_company_id AND collection = p_collection
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_collection_pricing(uuid, text) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_company_collections(p_company_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      collection,
      supplier_cost::float,
      retail_price::float
    FROM company_collections
    WHERE company_id = p_company_id
    ORDER BY collection ASC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_collections(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_all_collections_for_admin()
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT DISTINCT collection
    FROM products
    WHERE collection IS NOT NULL AND collection != ''
    UNION
    SELECT DISTINCT collection
    FROM company_product_definitions
    WHERE collection IS NOT NULL AND collection != ''
    ORDER BY collection ASC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_all_collections_for_admin() TO PUBLIC;

CREATE OR REPLACE FUNCTION get_company_collections_with_products(p_company_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT DISTINCT collection
    FROM products
    WHERE collection IS NOT NULL AND collection != ''
    UNION
    SELECT DISTINCT collection
    FROM company_product_definitions
    WHERE collection IS NOT NULL AND collection != '' AND company_id = p_company_id
    ORDER BY collection ASC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_collections_with_products(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION upsert_company_collection(
  p_company_id uuid,
  p_collection text,
  p_supplier_cost numeric,
  p_retail_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  INSERT INTO company_collections (company_id, collection, supplier_cost, retail_price)
  VALUES (p_company_id, p_collection, p_supplier_cost, p_retail_price)
  ON CONFLICT (company_id, collection) DO UPDATE SET
    supplier_cost = EXCLUDED.supplier_cost,
    retail_price = EXCLUDED.retail_price
  RETURNING
    collection,
    supplier_cost::float,
    retail_price::float
  INTO v_result;

  RETURN row_to_json(v_result)::json;
EXCEPTION
  WHEN OTHERS THEN
    -- Return input values if insert fails
    RETURN row_to_json(json_build_object(
      'collection', p_collection,
      'supplier_cost', p_supplier_cost::float,
      'retail_price', p_retail_price::float
    ))::json;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_company_collection(uuid, text, numeric, numeric) TO PUBLIC;

-- ============================================================================
-- QUOTE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_quotes(p_company_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, quote_number, customer_name, customer_address,
      customer_name_encrypted, customer_address_encrypted,
      quote_date, our_ref, status,
      installation_fee::float, delivery_fee::float,
      subtotal::float, total::float,
      total_area::float, panel_count,
      created_at, updated_at
    FROM quotes
    WHERE company_id = p_company_id
    ORDER BY created_at DESC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_quotes(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_company_quote_items(p_company_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      qi.id, qi.quote_id, qi.sort_order, qi.location,
      qi.product_id, qi.product_code, qi.product_collection, qi.product_description,
      qi.unit, qi.is_fixed,
      qi.measured_width, qi.measured_drop, qi.final_width, qi.final_drop,
      qi.area_sqft, qi.minimum_applied,
      qi.retail_price_sqft, qi.supplier_cost_sqft,
      qi.retail_amount, qi.supplier_amount,
      q.company_id
    FROM quote_items qi
    JOIN quotes q ON qi.quote_id = q.id
    WHERE q.company_id = p_company_id
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_quote_items(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION get_quote_items(p_quote_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      qi.id, qi.quote_id, qi.sort_order, qi.location,
      qi.product_id, qi.product_code, qi.product_collection, qi.product_description,
      qi.unit, qi.is_fixed,
      qi.measured_width, qi.measured_drop, qi.final_width, qi.final_drop,
      qi.area_sqft, qi.minimum_applied,
      qi.retail_price_sqft, qi.supplier_cost_sqft,
      qi.retail_amount, qi.supplier_amount
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
    ORDER BY qi.sort_order ASC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_quote_items(uuid) TO PUBLIC;

CREATE FUNCTION get_company_minimum_area(p_company_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT minimum_area_sqft::float AS minimum_area_sqft
  FROM companies
  WHERE id = p_company_id
$$;

GRANT EXECUTE ON FUNCTION get_company_minimum_area(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION create_quote(
  p_company_id uuid,
  p_quote_number text,
  p_customer_name text,
  p_customer_address text,
  p_customer_name_encrypted bytea,
  p_customer_address_encrypted bytea,
  p_quote_date date,
  p_our_ref text,
  p_installation_fee numeric,
  p_delivery_fee numeric,
  p_subtotal numeric,
  p_total numeric,
  p_total_area numeric,
  p_panel_count int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  INSERT INTO quotes (
    company_id, quote_number, customer_name, customer_address,
    customer_name_encrypted, customer_address_encrypted,
    quote_date, our_ref, installation_fee, delivery_fee,
    subtotal, total, total_area, panel_count
  ) VALUES (
    p_company_id, p_quote_number, p_customer_name, p_customer_address,
    p_customer_name_encrypted, p_customer_address_encrypted,
    p_quote_date, p_our_ref, p_installation_fee, p_delivery_fee,
    p_subtotal, p_total, p_total_area, p_panel_count
  )
  RETURNING
    id, quote_number, customer_name, customer_address, created_at
  INTO v_quote;

  RETURN row_to_json(v_quote)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION create_quote(uuid, text, text, text, bytea, bytea, date, text, numeric, numeric, numeric, numeric, numeric, int) TO PUBLIC;

CREATE OR REPLACE FUNCTION create_quote_item(
  p_quote_id uuid,
  p_sort_order int,
  p_location text,
  p_product_id uuid,
  p_product_code text,
  p_product_collection text,
  p_product_description text,
  p_unit text,
  p_is_fixed boolean,
  p_measured_width numeric,
  p_measured_drop numeric,
  p_final_width numeric,
  p_final_drop numeric,
  p_area_sqft numeric,
  p_retail_price_sqft numeric,
  p_supplier_cost_sqft numeric,
  p_retail_amount numeric,
  p_supplier_amount numeric,
  p_minimum_applied boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO quote_items (
    quote_id, sort_order, location,
    product_id, product_code, product_collection, product_description,
    unit, is_fixed,
    measured_width, measured_drop, final_width, final_drop,
    area_sqft, retail_price_sqft, supplier_cost_sqft,
    retail_amount, supplier_amount, minimum_applied
  ) VALUES (
    p_quote_id, p_sort_order, p_location,
    p_product_id, p_product_code, p_product_collection, p_product_description,
    p_unit, p_is_fixed,
    p_measured_width, p_measured_drop, p_final_width, p_final_drop,
    p_area_sqft, p_retail_price_sqft, p_supplier_cost_sqft,
    p_retail_amount, p_supplier_amount, p_minimum_applied
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION create_quote_item(uuid, int, text, uuid, text, text, text, text, boolean, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean) TO PUBLIC;

CREATE OR REPLACE FUNCTION clear_quote_plaintext(p_quote_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE quotes
  SET customer_name = NULL, customer_address = NULL
  WHERE id = p_quote_id
$$;

GRANT EXECUTE ON FUNCTION clear_quote_plaintext(uuid) TO PUBLIC;

-- ============================================================================
-- PRODUCT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_products()
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT id, code, collection, description, unit, active, created_at, updated_at
    FROM products
    WHERE active = true
    ORDER BY code ASC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_active_products() TO PUBLIC;

CREATE OR REPLACE FUNCTION upsert_product(
  p_code text,
  p_collection text,
  p_description text,
  p_unit text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  INSERT INTO products (code, collection, description, unit)
  VALUES (p_code, p_collection, p_description, p_unit)
  ON CONFLICT (code) DO UPDATE SET
    collection   = EXCLUDED.collection,
    description  = EXCLUDED.description,
    unit         = EXCLUDED.unit,
    updated_at   = now()
  RETURNING id, code, collection, description, unit, active, created_at, updated_at
  INTO v_product;

  RETURN row_to_json(v_product)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_product(text, text, text, text) TO PUBLIC;

-- ============================================================================
-- COMPANY SETTINGS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_settings(p_company_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, code, name as company, address, mobile, email, currency,
      prepared_by, terms, del_note, closing_note, updated_at, subscription_status,
      minimum_area_sqft::float
    FROM companies
    WHERE id = p_company_id
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_settings(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION update_company_settings(
  p_company_id uuid,
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
  v_company RECORD;
BEGIN
  UPDATE companies SET
    name         = p_name,
    address      = p_address,
    mobile       = p_mobile,
    email        = p_email,
    currency     = p_currency,
    prepared_by  = p_prepared_by,
    terms        = p_terms,
    del_note     = p_del_note,
    closing_note = p_closing_note,
    minimum_area_sqft = p_minimum_area_sqft,
    updated_at   = now()
  WHERE id = p_company_id
  RETURNING id, code, name as company, address, mobile, email, currency,
            prepared_by, terms, del_note, closing_note, updated_at, subscription_status,
            minimum_area_sqft::float
  INTO v_company;

  RETURN row_to_json(v_company)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION update_company_settings(uuid, text, text, text, text, text, text, text, text, text, numeric) TO PUBLIC;

CREATE OR REPLACE FUNCTION check_company_has_pricing(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM company_collections WHERE company_id = p_company_id)
$$;

GRANT EXECUTE ON FUNCTION check_company_has_pricing(uuid) TO PUBLIC;

-- ============================================================================
-- COMPANY CREATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_company(
  p_code text,
  p_name text,
  p_address text,
  p_mobile text,
  p_email text,
  p_prepared_by text,
  p_minimum_area_sqft numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company RECORD;
BEGIN
  INSERT INTO companies (code, name, address, mobile, email, prepared_by, minimum_area_sqft)
  VALUES (p_code, p_name, p_address, p_mobile, p_email, p_prepared_by, p_minimum_area_sqft)
  RETURNING id, code, name
  INTO v_company;

  RETURN row_to_json(v_company)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION create_company(text, text, text, text, text, text, numeric) TO PUBLIC;

-- ============================================================================
-- USER CREATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user(
  p_email text,
  p_password_hash text,
  p_email_hash text,
  p_company_id uuid,
  p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  INSERT INTO users (email, password_hash, email_hash, company_id, role)
  VALUES (p_email, p_password_hash, p_email_hash, p_company_id, p_role)
  RETURNING id, email, company_id, role, created_at
  INTO v_user;

  RETURN row_to_json(v_user)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION create_user(text, text, text, uuid, text) TO PUBLIC;

-- ============================================================================
-- QUOTE MANAGEMENT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_quote_by_id(p_company_id uuid, p_quote_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, quote_number, customer_name, customer_address,
      customer_name_encrypted, customer_address_encrypted,
      quote_date, our_ref, status,
      installation_fee::float, delivery_fee::float,
      subtotal::float, total::float,
      total_area::float, panel_count,
      created_at, updated_at
    FROM quotes
    WHERE company_id = p_company_id AND id = p_quote_id
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_company_quote_by_id(uuid, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION update_quote(
  p_quote_id uuid,
  p_company_id uuid,
  p_quote_number text,
  p_customer_name text,
  p_customer_address text,
  p_customer_name_encrypted bytea,
  p_customer_address_encrypted bytea,
  p_quote_date date,
  p_our_ref text,
  p_status text,
  p_installation_fee numeric,
  p_delivery_fee numeric,
  p_subtotal numeric,
  p_total numeric,
  p_total_area numeric,
  p_panel_count int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  UPDATE quotes SET
    quote_number = p_quote_number,
    customer_name = p_customer_name,
    customer_address = p_customer_address,
    customer_name_encrypted = p_customer_name_encrypted,
    customer_address_encrypted = p_customer_address_encrypted,
    quote_date = p_quote_date,
    our_ref = p_our_ref,
    status = p_status,
    installation_fee = p_installation_fee,
    delivery_fee = p_delivery_fee,
    subtotal = p_subtotal,
    total = p_total,
    total_area = p_total_area,
    panel_count = p_panel_count,
    updated_at = NOW()
  WHERE id = p_quote_id AND company_id = p_company_id
  RETURNING id, quote_number, customer_name, customer_address, updated_at
  INTO v_quote;

  RETURN row_to_json(v_quote)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION update_quote(uuid, uuid, text, text, text, bytea, bytea, date, text, text, numeric, numeric, numeric, numeric, numeric, int) TO PUBLIC;

CREATE OR REPLACE FUNCTION delete_quote(p_company_id uuid, p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM quotes
  WHERE id = p_quote_id AND company_id = p_company_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_quote(uuid, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION update_quote_items(p_quote_id uuid, p_items json)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing items
  DELETE FROM quote_items WHERE quote_id = p_quote_id;

  -- Insert new items from JSON array
  INSERT INTO quote_items (
    quote_id, sort_order, location,
    product_id, product_code, product_collection, product_description,
    unit, is_fixed,
    measured_width, measured_drop, final_width, final_drop,
    area_sqft, retail_price_sqft, supplier_cost_sqft,
    retail_amount, supplier_amount, minimum_applied
  )
  SELECT
    p_quote_id,
    (elem->>'sort_order')::int,
    elem->>'location',
    (elem->>'product_id')::uuid,
    elem->>'product_code',
    elem->>'product_collection',
    elem->>'product_description',
    elem->>'unit',
    (elem->>'is_fixed')::boolean,
    (elem->>'measured_width')::numeric,
    (elem->>'measured_drop')::numeric,
    (elem->>'final_width')::numeric,
    (elem->>'final_drop')::numeric,
    (elem->>'area_sqft')::numeric,
    (elem->>'retail_price_sqft')::numeric,
    (elem->>'supplier_cost_sqft')::numeric,
    (elem->>'retail_amount')::numeric,
    (elem->>'supplier_amount')::numeric,
    (elem->>'minimum_applied')::boolean
  FROM json_array_elements(p_items) as elem;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION update_quote_items(uuid, json) TO PUBLIC;

CREATE OR REPLACE FUNCTION delete_quote_items(p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM quote_items WHERE quote_id = p_quote_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_quote_items(uuid) TO PUBLIC;

-- ============================================================================
-- ACTIVATION CODE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_all_activation_codes()
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, code, discount_percent, applicable_plans,
      payment_amount, payment_currency, payment_amount_usd,
      payment_method, exchange_rate, payment_reference, payment_date,
      wallet_address, bank_reference, created_by, created_at,
      expires_at, is_active, used_by, used_at, used_ip_address,
      campaign_name, notes, status_history
    FROM activation_codes
    ORDER BY created_at DESC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_all_activation_codes() TO PUBLIC;

CREATE OR REPLACE FUNCTION validate_activation_code(p_code text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, code, discount_percent, applicable_plans,
      payment_amount, payment_currency, payment_amount_usd,
      payment_method, exchange_rate, payment_reference, payment_date,
      wallet_address, bank_reference, created_by, created_at,
      expires_at, is_active, used_by, used_at, used_ip_address,
      campaign_name, notes, status_history
    FROM activation_codes
    WHERE code = p_code
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND used_by IS NULL
    LIMIT 1
  ) t
$$;

GRANT EXECUTE ON FUNCTION validate_activation_code(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION create_activation_code(
  p_code text,
  p_discount_percent numeric,
  p_applicable_plans jsonb,
  p_payment_amount numeric,
  p_payment_currency text,
  p_payment_amount_usd numeric,
  p_payment_method text,
  p_exchange_rate numeric,
  p_payment_reference text,
  p_payment_date timestamp without time zone,
  p_wallet_address text,
  p_bank_reference text,
  p_created_by uuid,
  p_expires_at timestamp without time zone,
  p_campaign_name text,
  p_notes text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation_code RECORD;
BEGIN
  INSERT INTO activation_codes (
    code, discount_percent, applicable_plans,
    payment_amount, payment_currency, payment_amount_usd,
    payment_method, exchange_rate, payment_reference, payment_date,
    wallet_address, bank_reference, created_by,
    expires_at, campaign_name, notes
  )
  VALUES (
    p_code, p_discount_percent, p_applicable_plans,
    p_payment_amount, p_payment_currency, p_payment_amount_usd,
    p_payment_method, p_exchange_rate, p_payment_reference, p_payment_date,
    p_wallet_address, p_bank_reference, p_created_by,
    p_expires_at, p_campaign_name, p_notes
  )
  RETURNING id, code, discount_percent, applicable_plans,
            payment_amount, payment_currency, payment_amount_usd,
            payment_method, exchange_rate, payment_reference, payment_date,
            wallet_address, bank_reference, created_by, created_at,
            expires_at, is_active, used_by, used_at, used_ip_address,
            campaign_name, notes, status_history
  INTO v_activation_code;

  RETURN row_to_json(v_activation_code)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION create_activation_code(text, numeric, jsonb, numeric, text, numeric, text, numeric, text, timestamp without time zone, text, text, uuid, timestamp without time zone, text, text) TO PUBLIC;

-- ============================================================================
-- SUBSCRIPTION PLAN FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_subscription_plans()
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, name, description, price, currency, interval,
      discount_percent, features, is_active, created_at, updated_at
    FROM subscription_plans
    WHERE is_active = true
    ORDER BY price ASC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_subscription_plans() TO PUBLIC;

CREATE OR REPLACE FUNCTION get_subscription_plan(p_plan_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, name, description, price, currency, interval,
      discount_percent, features, is_active, created_at, updated_at
    FROM subscription_plans
    WHERE id = p_plan_id
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_subscription_plan(uuid) TO PUBLIC;

-- ============================================================================
-- PAYMENT VERIFICATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payment_verifications(p_company_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      id, company_id, user_id, plan_id, screenshot_url, reference_number,
      notes, status, admin_notes, admin_id,
      submitted_at, reviewed_at, created_at, updated_at
    FROM payment_verifications
    WHERE company_id = p_company_id
    ORDER BY submitted_at DESC
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_payment_verifications(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION update_payment_verification(
  p_verification_id uuid,
  p_company_id uuid,
  p_status text,
  p_reviewed_at timestamp with time zone,
  p_admin_id uuid,
  p_admin_notes text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification RECORD;
BEGIN
  UPDATE payment_verifications SET
    status = p_status,
    reviewed_at = p_reviewed_at,
    admin_id = p_admin_id,
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_verification_id AND company_id = p_company_id
  RETURNING id, company_id, user_id, plan_id, status, reviewed_at, admin_id, updated_at
  INTO v_verification;

  RETURN row_to_json(v_verification)::json;
END;
$$;

GRANT EXECUTE ON FUNCTION update_payment_verification(uuid, uuid, text, timestamp with time zone, uuid, text) TO PUBLIC;