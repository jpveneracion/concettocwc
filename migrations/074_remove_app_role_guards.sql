-- Migration 074: Remove app.role Guards and Add Input Validation
-- Problem: app.role guards in SECURITY DEFINER functions are obsolete with transaction-scoped RLS context
-- Solution: Strip app.role checks, add comprehensive input validation, fix permissions

-- First, revoke existing permissions from the functions that will be replaced
DO $$
BEGIN
  -- Revoke permissions from existing functions using function names only
  REVOKE EXECUTE ON FUNCTION create_company_with_context FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION create_user_with_oauth FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION create_oauth_account FROM PUBLIC;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error revoking permissions (functions may not exist yet): %', SQLERRM;
END $$;

-- Function 1: create_company_with_context (replaces app.role guard with input validation)
CREATE OR REPLACE FUNCTION create_company_with_context(
  p_code text,
  p_name text,
  p_address text DEFAULT NULL::text,
  p_mobile text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_minimum_area_sqft numeric DEFAULT 15
)
RETURNS TABLE(company_id uuid, company_code text, company_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Input validation (replacing app.role guard)
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'Company code is required';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  RETURN QUERY
  INSERT INTO companies (code, name, address, mobile, email, minimum_area_sqft)
  VALUES (p_code, p_name, p_address, p_mobile, p_email, p_minimum_area_sqft)
  RETURNING id as company_id, code as company_code, name as company_name;
END;
$$;

-- Function 2: create_user_with_oauth (replaces app.role guard with input validation)
CREATE OR REPLACE FUNCTION create_user_with_oauth(
  p_company_id uuid,
  p_email text,
  p_email_hash text
)
RETURNS TABLE(user_id uuid, user_email text, user_company_id uuid, user_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Input validation (replacing app.role guard)
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'User email is required';
  END IF;

  IF p_email_hash IS NULL OR trim(p_email_hash) = '' THEN
    RAISE EXCEPTION 'Email hash is required';
  END IF;

  RETURN QUERY
  INSERT INTO users (company_id, email, email_hash)
  VALUES (p_company_id, p_email, p_email_hash)
  RETURNING id as user_id, email as user_email, company_id as user_company_id, role as user_role;
END;
$$;

-- Function 3: create_oauth_account (replaces app.role guard with input validation)
CREATE OR REPLACE FUNCTION create_oauth_account(
  p_user_id uuid,
  p_provider text,
  p_provider_user_id text,
  p_email text,
  p_username text DEFAULT NULL::text,
  p_access_token text DEFAULT NULL::text,
  p_refresh_token text DEFAULT NULL::text,
  p_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(oauth_account_id uuid, oauth_user_id uuid, oauth_provider text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Input validation (replacing app.role guard)
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_provider IS NULL OR trim(p_provider) = '' THEN
    RAISE EXCEPTION 'OAuth provider is required';
  END IF;

  RETURN QUERY
  INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, username, access_token, refresh_token, expires_at)
  VALUES (p_user_id, p_provider, p_provider_user_id, p_email, p_username, p_access_token, p_refresh_token, p_expires_at)
  RETURNING id as oauth_account_id, user_id as oauth_user_id, provider as oauth_provider;
END;
$$;

-- CRITICAL: These grants MUST be active for OAuth signup to work
-- Grant to application role - OAuth signup will fail with 42501 without these
DO $$
BEGIN
  -- Grant permissions using function name only (PostgreSQL will apply to all overloads)
  GRANT EXECUTE ON FUNCTION create_company_with_context TO concetto_boms;
  GRANT EXECUTE ON FUNCTION create_user_with_oauth TO concetto_boms;
  GRANT EXECUTE ON FUNCTION create_oauth_account TO concetto_boms;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END $$;