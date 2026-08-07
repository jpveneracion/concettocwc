-- Fix: linkOAuthAccount's follow-up `SELECT * FROM oauth_accounts WHERE id = $1`
-- returns zero rows during OAuth sign-in because oauth_accounts has RLS
-- (user isolation) and no tenant context exists yet at that point in the flow.
-- Fix: SECURITY DEFINER lookup returning the full composite row type (exact
-- type match - no coercion issues).

CREATE OR REPLACE FUNCTION get_oauth_account_by_id(p_oauth_account_id uuid)
RETURNS SETOF oauth_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_oauth_account_id IS NULL THEN
    RAISE EXCEPTION 'OAuth account ID is required';
  END IF;

  RETURN QUERY
  SELECT * FROM oauth_accounts WHERE id = p_oauth_account_id LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_oauth_account_by_id IS 'SECURITY DEFINER function for OAuth account lookup by ID. Bypasses RLS in controlled manner to allow account retrieval during OAuth sign-in before a tenant context exists.';

GRANT EXECUTE ON FUNCTION get_oauth_account_by_id(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_oauth_account_by_id(uuid) TO concetto_boms;
