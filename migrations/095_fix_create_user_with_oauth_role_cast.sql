-- Fix: create_user_with_oauth returns users.role (varchar) where RETURNS TABLE
-- declares user_role text. PL/pgSQL RETURN QUERY rejects the varchar->text
-- coercion at runtime with "structure of query does not match function result
-- type", breaking every new OAuth signup (Google/GitHub).
-- Fix: explicit ::text cast in the RETURNING clause.

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
  RETURNING id as user_id, email as user_email, company_id as user_company_id, role::text as user_role;
END;
$$;

-- Keep the same grants as migration 074
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION create_user_with_oauth TO concetto_boms;
  GRANT EXECUTE ON FUNCTION create_user_with_oauth TO PUBLIC;
END;
$$;
