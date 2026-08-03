-- Migration 073: Fix RLS Context Transaction Scope
-- Problem: Session-scoped context (is_local=false) leaks across connection pool reuse
-- Solution: Switch to transaction-scoped context (is_local=true) for proper isolation

DROP FUNCTION IF EXISTS set_tenant_context(uuid, text) CASCADE;

CREATE FUNCTION set_tenant_context(company_id UUID, user_role TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID cannot be NULL';
  END IF;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User role cannot be NULL';
  END IF;

  IF user_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid user role: %', user_role;
  END IF;

  -- FIXED: Changed from is_local=false to is_local=true
  PERFORM set_config('rls.current_company_id', company_id::TEXT, true);
  PERFORM set_config('rls.current_user_role', user_role, true);

  RAISE LOG 'RLS context set (transaction-scoped): company_id=%, user_role=%', company_id, user_role;
END;
$$;

DROP FUNCTION IF EXISTS reset_tenant_context() CASCADE;

CREATE FUNCTION reset_tenant_context()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- FIXED: Added rls.current_user_id cleanup (was missing)
  PERFORM set_config('rls.current_company_id', NULL, true);
  PERFORM set_config('rls.current_user_role', NULL, true);
  PERFORM set_config('rls.current_user_id', NULL, true);

  RAISE LOG 'RLS context reset (transaction-scoped)';
END;
$$;

-- Update policy to superadmin only
DROP POLICY IF EXISTS companies_insert_protection ON companies;

CREATE POLICY companies_insert_protection ON companies
FOR INSERT
WITH CHECK (is_current_user_superadmin());

-- Grants
GRANT EXECUTE ON FUNCTION set_tenant_context(uuid, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION reset_tenant_context() TO PUBLIC;