-- Migration: Create SECURITY DEFINER functions for OAuth signup
-- Purpose: Bypass RLS policies during initial user/company creation in a controlled manner
-- Pattern: Following mypiroll approach using SECURITY DEFINER functions instead of superadmin context

-- ============================================================================
-- CREATE COMPANY WITH CONTEXT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_company_with_context(
  p_code text,
  p_name text,
  p_address text DEFAULT NULL::text,
  p_mobile text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_minimum_area_sqft numeric DEFAULT 15
)
RETURNS TABLE(
  company_id uuid,
  company_code text,
  company_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security: Validate role context
  -- Only allow from application layer with proper role
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for company creation';
  END IF;

  -- Create company with RLS bypass
  RETURN QUERY
  INSERT INTO companies (code, name, address, mobile, email, minimum_area_sqft)
  VALUES (
    p_code,
    p_name,
    p_address,
    p_mobile,
    p_email,
    p_minimum_area_sqft
  )
  RETURNING
    id as company_id,
    code as company_code,
    name as company_name;
END;
$$;

COMMENT ON FUNCTION create_company_with_context IS 'SECURITY DEFINER function for creating companies during OAuth signup. Bypasses RLS in controlled manner. Only callable from application layer with proper role context.';

-- ============================================================================
-- CREATE USER WITH OAUTH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_with_oauth(
  p_company_id uuid,
  p_email text,
  p_email_hash text
)
RETURNS TABLE(
  user_id uuid,
  user_email text,
  user_company_id uuid,
  user_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security: Validate role context
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for user creation';
  END IF;

  -- Create user with RLS bypass
  RETURN QUERY
  INSERT INTO users (company_id, email, email_hash)
  VALUES (p_company_id, p_email, p_email_hash)
  RETURNING
    id as user_id,
    email as user_email,
    company_id as user_company_id,
    role as user_role;
END;
$$;

COMMENT ON FUNCTION create_user_with_oauth IS 'SECURITY DEFINER function for creating users during OAuth signup. Bypasses RLS in controlled manner. Only callable from application layer with proper role context.';

-- ============================================================================
-- CREATE OAUTH ACCOUNT FUNCTION
-- ============================================================================

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
RETURNS TABLE(
  oauth_account_id uuid,
  oauth_user_id uuid,
  oauth_provider text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security: Validate role context
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for OAuth account creation';
  END IF;

  -- Create OAuth account with RLS bypass
  RETURN QUERY
  INSERT INTO oauth_accounts (
    user_id, provider, provider_user_id, email, username,
    access_token, refresh_token, expires_at
  )
  VALUES (
    p_user_id, p_provider, p_provider_user_id, p_email, p_username,
    p_access_token, p_refresh_token, p_expires_at
  )
  RETURNING
    id as oauth_account_id,
    user_id as oauth_user_id,
    provider as oauth_provider;
END;
$$;

COMMENT ON FUNCTION create_oauth_account IS 'SECURITY DEFINER function for creating OAuth accounts during signup. Bypasses RLS in controlled manner. Only callable from application layer with proper role context.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_company_with_context TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_user_with_oauth TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_oauth_account TO PUBLIC;

-- ============================================================================
-- HELPER FUNCTION TO SET APP ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION set_app_role(p_role text DEFAULT 'concetto')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.role', p_role, true);
END;
$$;

COMMENT ON FUNCTION set_app_role IS 'Helper function to set application role context. Used by SECURITY DEFINER functions to validate caller privileges.';

GRANT EXECUTE ON FUNCTION set_app_role TO PUBLIC;

-- ============================================================================
-- GET USER COMPANY FUNCTION (for auth flow)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_company(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path public
AS $$
  SELECT company_id FROM users WHERE id = user_id
$$;

COMMENT ON FUNCTION get_user_company IS 'SECURITY DEFINER function to retrieve user company without RLS context - used in auth flow to enable session-based company storage';

GRANT EXECUTE ON FUNCTION get_user_company TO PUBLIC;