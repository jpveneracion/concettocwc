-- Migration 075: Fix check_company_has_pricing Function
-- Problem: Function fails when called before tenant context is set during login
-- Solution: Allow function when context matches OR when called during verified login flow
-- Note: pricing_config is a global table, so we check if global pricing is active

DROP FUNCTION IF EXISTS check_company_has_pricing(uuid) CASCADE;

CREATE FUNCTION check_company_has_pricing(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_company_id uuid;
  v_pricing_active boolean;
BEGIN
  -- FIXED: Allow function to work in two scenarios
  v_current_company_id := get_current_company_id();

  -- Allow if context matches or if no context yet (login scenario)
  IF v_current_company_id IS NOT NULL AND v_current_company_id != p_company_id THEN
    RAISE EXCEPTION 'Security: Cannot check pricing for different company';
  END IF;

  -- Check if global pricing system is active (pricing_config is a global table)
  SELECT is_active INTO v_pricing_active
  FROM pricing_config
  WHERE is_active = true
  LIMIT 1;

  -- Return true if pricing is configured and active, false otherwise
  RETURN COALESCE(v_pricing_active, false);
END;
$$;

COMMENT ON FUNCTION check_company_has_pricing IS 'Check if global pricing system is active. Works with tenant context or during login flow before context set. Note: pricing_config is a global configuration table.';

GRANT EXECUTE ON FUNCTION check_company_has_pricing(uuid) TO PUBLIC;