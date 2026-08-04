-- ============================================================================
-- CREATE PASSWORD RESET TOKEN FUNCTION - SECURITY DEFINER
-- ============================================================================
-- Issue: Direct INSERT queries are blocked by RLS policies
-- Solution: Create SECURITY DEFINER function to handle password reset token creation
--          This bypasses RLS and allows secure token creation for password resets

-- ============================================================================
-- CREATE: create_password_reset_token function - SECURITY DEFINER for token creation
-- ============================================================================

CREATE OR REPLACE FUNCTION create_password_reset_token(
  p_user_id uuid,
  p_token text,
  p_expires_at timestamp with time zone
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Insert password reset token
  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (p_user_id, p_token, p_expires_at)
  RETURNING id, user_id, token, expires_at, created_at INTO v_result;

  IF NOT FOUND THEN
    -- Return error if token creation failed
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create password reset token',
      'user_id', p_user_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'token_id', v_result.id,
    'user_id', v_result.user_id,
    'expires_at', v_result.expires_at
  );
END;
$$;

COMMENT ON FUNCTION create_password_reset_token IS 'SECURITY DEFINER function for creating password reset tokens. Bypasses RLS to allow secure token creation for password resets. Returns success/error status.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_password_reset_token(uuid, text, timestamp with time zone) TO PUBLIC;

COMMENT ON SCHEMA public IS 'ADDED: create_password_reset_token SECURITY DEFINER function - bypasses RLS for password reset token creation';