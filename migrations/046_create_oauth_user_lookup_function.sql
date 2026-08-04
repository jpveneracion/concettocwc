-- Migration: Create SECURITY DEFINER function for OAuth user lookup
-- Purpose: Fix OAuth login by bypassing RLS for email_hash lookups during authentication
-- Issue: findUserByEmail() was blocked by RLS policies after RLS implementation

-- ============================================================================
-- DROP EXISTING FUNCTION (if exists with wrong return type)
-- ============================================================================

DROP FUNCTION IF EXISTS find_user_by_email_hash(text);
DROP FUNCTION IF EXISTS find_oauth_account_by_provider(text, text);
DROP FUNCTION IF EXISTS find_user_by_id(uuid);

-- ============================================================================
-- FIND USER BY EMAIL HASH FUNCTION (bypasses RLS for OAuth)
-- ============================================================================

CREATE FUNCTION find_user_by_email_hash(p_email_hash text)
RETURNS TABLE(
  user_id uuid,
  user_email text,
  user_email_hash text,
  user_company_id uuid,
  user_role character varying(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security: Validate role context
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for user lookup';
  END IF;

  -- Find user by email_hash with RLS bypass
  RETURN QUERY
  SELECT
    id as user_id,
    email as user_email,
    email_hash as user_email_hash,
    company_id as user_company_id,
    role as user_role
  FROM users
  WHERE email_hash = p_email_hash
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_user_by_email_hash IS 'SECURITY DEFINER function for OAuth user lookup. Bypasses RLS in controlled manner to allow email_hash lookups during authentication. Only callable from application layer with proper role context.';

-- ============================================================================
-- FIND OAUTH ACCOUNT BY PROVIDER FUNCTION (bypasses RLS for OAuth)
-- ============================================================================

CREATE FUNCTION find_oauth_account_by_provider(p_provider text, p_provider_user_id text)
RETURNS TABLE(
  oauth_account_id uuid,
  oauth_user_id uuid,
  oauth_provider text,
  oauth_provider_user_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security: Validate role context
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for OAuth account lookup';
  END IF;

  -- Find OAuth account by provider and provider_user_id with RLS bypass
  RETURN QUERY
  SELECT
    id as oauth_account_id,
    user_id as oauth_user_id,
    provider as oauth_provider,
    provider_user_id as oauth_provider_user_id
  FROM oauth_accounts
  WHERE provider = p_provider AND provider_user_id = p_provider_user_id
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_oauth_account_by_provider IS 'SECURITY DEFINER function for OAuth account lookup. Bypasses RLS in controlled manner to allow OAuth account lookups during authentication. Only callable from application layer with proper role context.';

-- ============================================================================
-- FIND USER BY ID FUNCTION (bypasses RLS for session/user lookups)
-- ============================================================================

CREATE FUNCTION find_user_by_id(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  user_email text,
  user_email_hash text,
  user_company_id uuid,
  user_role character varying(20),
  user_trial_expires_at timestamp with time zone,
  user_subscription_activated boolean,
  user_subscription_plan character varying(50),
  user_is_admin boolean,
  user_password_hash text,
  user_created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security: Validate role context
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for user lookup';
  END IF;

  -- Find user by ID with RLS bypass - include all fields needed for session/subscription logic
  RETURN QUERY
  SELECT
    id as user_id,
    email as user_email,
    email_hash as user_email_hash,
    company_id as user_company_id,
    role as user_role,
    trial_expires_at as user_trial_expires_at,
    subscription_activated as user_subscription_activated,
    subscription_plan as user_subscription_plan,
    is_admin as user_is_admin,
    password_hash as user_password_hash,
    created_at as user_created_at
  FROM users
  WHERE id = p_user_id
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_user_by_id IS 'SECURITY DEFINER function for user lookup by ID. Bypasses RLS in controlled manner to allow user session lookups. Only callable from application layer with proper role context.';

GRANT EXECUTE ON FUNCTION find_user_by_email_hash TO PUBLIC;
GRANT EXECUTE ON FUNCTION find_oauth_account_by_provider TO PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_id TO PUBLIC;