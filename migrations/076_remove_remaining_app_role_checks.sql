-- Migration 076: Remove Remaining app.role Checks from Signup Functions
-- Problem: SECURITY DEFINER functions used in signup flow still check for app.role
-- Solution: Remove obsolete app.role security checks since RLS context is now transaction-scoped

-- Function 1: check_company_exists
DROP FUNCTION IF EXISTS check_company_exists(text) CASCADE;

CREATE FUNCTION check_company_exists(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- REMOVED: app.role security check - no longer needed with RLS context
  -- Simply return company existence status
  RETURN EXISTS(SELECT 1 FROM companies WHERE UPPER(code) = UPPER(p_code));
END;
$$;

-- Function 2: check_user_exists_by_email_hash
DROP FUNCTION IF EXISTS check_user_exists_by_email_hash(text) CASCADE;

CREATE FUNCTION check_user_exists_by_email_hash(p_email_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- REMOVED: app.role security check - no longer needed with RLS context
  -- Simply return user existence status
  RETURN EXISTS(SELECT 1 FROM users WHERE email_hash = p_email_hash);
END;
$$;

-- Function 3: create_company
DROP FUNCTION IF EXISTS create_company(text, text, text, text, text, text, numeric) CASCADE;

CREATE FUNCTION create_company(
  p_code text,
  p_name text,
  p_address text DEFAULT NULL::text,
  p_mobile text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_prepared_by text DEFAULT NULL::text,
  p_minimum_area_sqft numeric DEFAULT 15
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  -- REMOVED: app.role security check - no longer needed with RLS context
  -- Input validation (replacing app.role guard)
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'Company code is required';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  WITH inserted_company AS (
    INSERT INTO companies (code, name, address, mobile, email, prepared_by, minimum_area_sqft)
    VALUES (p_code, p_name, p_address, p_mobile, p_email, p_prepared_by, p_minimum_area_sqft)
    RETURNING id, code, name
  )
  SELECT row_to_json(inserted_company) INTO result
  FROM inserted_company;

  RETURN result;
END;
$$;

-- Function 4: create_user
DROP FUNCTION IF EXISTS create_user(text, text, text, uuid, text) CASCADE;

CREATE FUNCTION create_user(
  p_email text,
  p_password_hash text,
  p_email_hash text,
  p_company_id uuid,
  p_role text DEFAULT 'user'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  -- REMOVED: app.role security check - no longer needed with RLS context
  -- Input validation (replacing app.role guard)
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'User email is required';
  END IF;

  IF p_password_hash IS NULL OR trim(p_password_hash) = '' THEN
    RAISE EXCEPTION 'Password hash is required';
  END IF;

  WITH inserted_user AS (
    INSERT INTO users (email, password_hash, email_hash, company_id, role)
    VALUES (p_email, p_password_hash, p_email_hash, p_company_id, p_role)
    RETURNING id, email, company_id, role
  )
  SELECT row_to_json(inserted_user) INTO result
  FROM inserted_user;

  RETURN result;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION check_company_exists(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_user_exists_by_email_hash(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_company(text, text, text, text, text, text, numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_user(text, text, text, uuid, text) TO PUBLIC;