-- Migration 080: Add SECURITY DEFINER function for deactivating activation codes
-- This bypasses the RLS infinite recursion issue on activation_codes table

BEGIN;

-- Function to deactivate an activation code (bypasses RLS via SECURITY DEFINER)
DROP FUNCTION IF EXISTS deactivate_activation_code(int, text, text, text) CASCADE;
CREATE OR REPLACE FUNCTION deactivate_activation_code(
  p_code_id int,
  p_company_id text,
  p_user_role text,
  p_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_superadmin boolean;
  v_can_deactivate boolean := false;
BEGIN
  -- Check if user is superadmin
  IF p_user_role = 'superadmin' THEN
    v_can_deactivate := true;
  ELSE
    -- Check if the activation code belongs to the user's company
    SELECT EXISTS (
      SELECT 1 FROM activation_codes ac
      JOIN users u ON u.id = ac.created_by
      WHERE ac.id = p_code_id
        AND u.company_id = p_company_id::uuid
    ) INTO v_can_deactivate;
  END IF;

  IF NOT v_can_deactivate THEN
    RAISE EXCEPTION 'Access denied: Cannot deactivate activation code from another company';
  END IF;

  -- Deactivate the code
  UPDATE activation_codes
  SET is_active = false
  WHERE id = p_code_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_activation_code(int, text, text, text) TO PUBLIC;

COMMIT;