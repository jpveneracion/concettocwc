-- CRITICAL FIX: Role Context Validation Logic Bug
-- Issue: current_setting() returns empty string, not NULL, so validation never triggers
-- Impact: All 51 secured functions are bypassing security checks
-- Solution: Update validation to check for both NULL and empty string

-- ============================================================================
-- FIX ALL SECURED FUNCTIONS - Update Role Context Validation
-- ============================================================================

-- Migration 048 Functions (3 functions)
DROP FUNCTION IF EXISTS find_user_by_email_hash CASCADE;
CREATE FUNCTION find_user_by_email_hash(p_email_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- FIXED: Check for both NULL and empty string
  IF current_setting('app.role', true) IS NULL OR current_setting('app.role', true) = '' THEN
    RAISE EXCEPTION 'Security: No role context set for user lookup';
  END IF;

  SELECT row_to_json(t)::json INTO result
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
  ) t;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email_hash(text) TO PUBLIC;

DROP FUNCTION IF EXISTS find_user_by_id CASCADE;
CREATE FUNCTION find_user_by_id(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- FIXED: Check for both NULL and empty string
  IF current_setting('app.role', true) IS NULL OR current_setting('app.role', true) = '' THEN
    RAISE EXCEPTION 'Security: No role context set for user lookup';
  END IF;

  SELECT row_to_json(t)::json INTO result
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
  ) t;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_id(uuid) TO PUBLIC;

DROP FUNCTION IF EXISTS find_user_by_email CASCADE;
CREATE FUNCTION find_user_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- FIXED: Check for both NULL and empty string
  IF current_setting('app.role', true) IS NULL OR current_setting('app.role', true) = '' THEN
    RAISE EXCEPTION 'Security: No role context set for user lookup';
  END IF;

  SELECT row_to_json(t)::json INTO result
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
  ) t;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO PUBLIC;

COMMENT ON SCHEMA public IS 'CRITICAL SECURITY FIX: Role context validation logic corrected for 3 auth functions. Empty string bug fixed.';