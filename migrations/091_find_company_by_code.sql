-- Migration 091: Find Company by Code (RLS bypass for pre-auth flows)
-- Purpose: SECURITY DEFINER lookup used by OAuth sign-in (src/auth.ts) and
-- account-choice "join" flows. These run BEFORE a session/RLS tenant context
-- exists, so a direct SELECT on companies is blocked by the tenant
-- self-isolation policy (id = get_current_company_id() returns NULL).
-- Consequence: validateCompanyCode() always returned null, so OAuth sign-in
-- treated existing companies as new and failed with companies_code_key
-- duplicate violations (e.g. email-derived code BERMUDEZEL).
-- Also returns the current user count so callers can decide whether the
-- company is an orphan (0 users) and safe to re-associate with a new user.

CREATE OR REPLACE FUNCTION find_company_by_code(p_code text)
RETURNS TABLE(
  company_id uuid,
  company_code text,
  company_name text,
  company_user_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.code,
    c.name,
    (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id)::bigint AS company_user_count
  FROM companies c
  WHERE UPPER(c.code) = UPPER(p_code)
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_company_by_code(text) IS 'SECURITY DEFINER function to look up a company by business code without an RLS context. Used by OAuth sign-in and account-choice flows before tenant context exists. Returns user count for orphan detection.';

GRANT EXECUTE ON FUNCTION find_company_by_code(text) TO PUBLIC;
