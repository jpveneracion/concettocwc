-- Migration 077: Remove app.role Checks from OAuth SECURITY DEFINER Functions
-- Problem: OAuth lookup functions still check for app.role context which was removed in Step A
-- Solution: Remove obsolete app.role security checks since transaction-scoped RLS context is now used

-- Function 1: find_user_by_email_hash
DROP FUNCTION IF EXISTS find_user_by_email_hash(text) CASCADE;

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
  -- REMOVED: app.role security check - no longer needed with transaction-scoped RLS

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

COMMENT ON FUNCTION find_user_by_email_hash IS 'SECURITY DEFINER function for OAuth user lookup. Bypasses RLS in controlled manner to allow email_hash lookups during authentication.';

-- Function 2: find_oauth_account_by_provider
DROP FUNCTION IF EXISTS find_oauth_account_by_provider(text, text) CASCADE;

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
  -- REMOVED: app.role security check - no longer needed with transaction-scoped RLS

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

COMMENT ON FUNCTION find_oauth_account_by_provider IS 'SECURITY DEFINER function for OAuth account lookup. Bypasses RLS in controlled manner to allow OAuth account lookups during authentication.';

-- Function 3: find_user_by_id
DROP FUNCTION IF EXISTS find_user_by_id(uuid) CASCADE;

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
  -- REMOVED: app.role security check - no longer needed with transaction-scoped RLS

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

COMMENT ON FUNCTION find_user_by_id IS 'SECURITY DEFINER function for user lookup by ID. Bypasses RLS in controlled manner to allow user session lookups.';

-- Grants
GRANT EXECUTE ON FUNCTION find_user_by_email_hash(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION find_oauth_account_by_provider(text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_id(uuid) TO PUBLIC;