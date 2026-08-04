-- CRITICAL FIX: set_app_role() Persistence Issue
-- Problem: set_config(..., true) only sets for transaction, not session
-- Impact: Role context doesn't persist between set_app_role() and function calls
-- Solution: Change third parameter to false for session persistence

-- ============================================================================
-- FIX set_app_role() - Make Role Context Persist for Session
-- ============================================================================

DROP FUNCTION IF EXISTS set_app_role CASCADE;

CREATE FUNCTION set_app_role(p_role text DEFAULT 'concetto')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- FIXED: Changed third parameter from true to false for session persistence
  PERFORM set_config('app.role', p_role, false);
END;
$$;

COMMENT ON FUNCTION set_app_role IS 'Helper function to set application role context. FIXED: Now persists for entire session instead of just transaction. Required for SECURITY DEFINER function validation.';

GRANT EXECUTE ON FUNCTION set_app_role(text) TO PUBLIC;

COMMENT ON SCHEMA public IS 'CRITICAL FIX: set_app_role() now properly persists role context for session duration. Security functions can now validate authorization correctly.';