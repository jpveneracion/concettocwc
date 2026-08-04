-- migrations/001_enable_rls_foundation.sql
-- RLS Foundation Infrastructure for Multi-Tenant Application
-- This migration creates the core RLS functions that will be used by all tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- RLS CONTEXT MANAGEMENT FUNCTIONS
-- ============================================================================

/**
 * Set tenant context for the current database session
 * This function must be called at the start of each request to establish
 * which company and user role should be used for RLS policy evaluation
 *
 * @param company_id UUID - The company identifier for the current session
 * @param user_role TEXT - The user role ('user', 'admin', 'superadmin')
 *
 * SECURITY DEFINER is required to allow session context manipulation
 */
CREATE OR REPLACE FUNCTION set_tenant_context(company_id UUID, user_role TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate inputs
  IF company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID cannot be NULL';
  END IF;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User role cannot be NULL';
  END IF;

  IF user_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid user role: %', user_role;
  END IF;

  -- Set session context using PostgreSQL's built-in session variables
  PERFORM set_config('rls.current_company_id', company_id::TEXT, false);
  PERFORM set_config('rls.current_user_role', user_role, false);

  -- Log the context set (for debugging and audit purposes)
  RAISE LOG 'RLS context set: company_id=%, user_role=%', company_id, user_role;
END;
$$;

/**
 * Get the current company ID from session context
 * Returns NULL if no context has been set
 *
 * @returns UUID or NULL
 */
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS UUID
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  company_id_str TEXT;
  company_id UUID;
BEGIN
  -- Retrieve context from session variable
  company_id_str := current_setting('rls.current_company_id', true);

  IF company_id_str IS NULL THEN
    RETURN NULL;
  END IF;

  -- Convert to UUID
  company_id := company_id_str::UUID;
  RETURN company_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error getting current company ID: %', SQLERRM;
    RETURN NULL;
END;
$$;

/**
 * Get the current user role from session context
 * Returns NULL if no context has been set
 *
 * @returns TEXT or NULL
 */
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Retrieve context from session variable
  user_role := current_setting('rls.current_user_role', true);

  RETURN user_role;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error getting current user role: %', SQLERRM;
    RETURN NULL;
END;
$$;

/**
 * Reset tenant context for the current database session
 * This should be called at the end of each request to ensure
 * context isolation between different operations
 *
 * SECURITY DEFINER is required for session context manipulation
 */
CREATE OR REPLACE FUNCTION reset_tenant_context()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clear session context variables
  PERFORM set_config('rls.current_company_id', NULL, false);
  PERFORM set_config('rls.current_user_role', NULL, false);

  -- Log the context reset (for debugging and audit purposes)
  RAISE LOG 'RLS context reset';
END;
$$;

/**
 * Validate that tenant context is set and return company_id
 * This is a helper function that should be used in RLS policies
 * to ensure context is properly set before evaluating access
 *
 * @returns UUID - The current company ID
 * @throws EXCEPTION if context is not set
 */
CREATE OR REPLACE FUNCTION require_tenant_context()
RETURNS UUID
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  company_id UUID;
BEGIN
  company_id := get_current_company_id();

  IF company_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context not set. Call set_tenant_context() first.';
  END IF;

  RETURN company_id;
END;
$$;

/**
 * Check if current user has admin privileges
 * Helper function for RLS policies to simplify admin checks
 *
 * @returns BOOLEAN - True if user has admin or superadmin role
 */
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := get_current_user_role();

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN user_role IN ('admin', 'superadmin');
END;
$$;

/**
 * Check if current user has superadmin privileges
 * Helper function for RLS policies to simplify superadmin checks
 *
 * @returns BOOLEAN - True if user has superadmin role
 */
CREATE OR REPLACE FUNCTION is_current_user_superadmin()
RETURNS BOOLEAN
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := get_current_user_role();

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN user_role = 'superadmin';
END;
$$;

-- ============================================================================
-- UTILITY FUNCTIONS FOR RLS POLICY DEVELOPMENT
-- ============================================================================

/**
 * Check if a row belongs to the current tenant's company
 * This is the core isolation function that should be used in most RLS policies
 *
 * @param row_company_id UUID - The company_id column from the row being checked
 * @returns BOOLEAN - True if the row belongs to the current tenant
 */
CREATE OR REPLACE FUNCTION is_current_tenant_company(row_company_id UUID)
RETURNS BOOLEAN
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_company_id UUID;
BEGIN
  current_company_id := get_current_company_id();

  -- If no context set, deny access (fail secure)
  IF current_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if row belongs to current tenant
  RETURN current_company_id = row_company_id;
END;
$$;

/**
 * Check if current user can access a specific company's data
 * Superadmins can access all data, regular users can only access their own company
 *
 * @param row_company_id UUID - The company_id column from the row being checked
 * @returns BOOLEAN - True if user has access to this company's data
 */
CREATE OR REPLACE FUNCTION can_access_company_data(row_company_id UUID)
RETURNS BOOLEAN
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Superadmins can access all data
  IF is_current_user_superadmin() THEN
    RETURN true;
  END IF;

  -- Regular users can only access their own company data
  RETURN is_current_tenant_company(row_company_id);
END;
$$;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION set_tenant_context(UUID, TEXT) IS 'Sets the tenant context (company_id and user_role) for the current database session. Must be called at the start of each request.';

COMMENT ON FUNCTION get_current_company_id() IS 'Returns the current company ID from session context, or NULL if not set.';

COMMENT ON FUNCTION get_current_user_role() IS 'Returns the current user role from session context, or NULL if not set.';

COMMENT ON FUNCTION reset_tenant_context() IS 'Clears the tenant context for the current database session. Should be called at the end of each request.';

COMMENT ON FUNCTION require_tenant_context() IS 'Validates that tenant context is set and returns the company ID. Throws exception if context not set.';

COMMENT ON FUNCTION is_current_user_admin() IS 'Returns true if current user has admin or superadmin role.';

COMMENT ON FUNCTION is_current_user_superadmin() IS 'Returns true if current user has superadmin role.';

COMMENT ON FUNCTION is_current_tenant_company(UUID) IS 'Core isolation function. Returns true if the given company_id matches the current tenant context.';

COMMENT ON FUNCTION can_access_company_data(UUID) IS 'Access control function. Returns true if current user can access data for the given company. Superadmins can access all data.';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant execute permissions on RLS functions to the database user
-- These permissions will be inherited by the application

GRANT EXECUTE ON FUNCTION set_tenant_context(UUID, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_company_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION reset_tenant_context() TO PUBLIC;
GRANT EXECUTE ON FUNCTION require_tenant_context() TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_current_user_superadmin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_current_tenant_company(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_access_company_data(UUID) TO PUBLIC;

-- ============================================================================
-- TESTING AND VALIDATION
-- ============================================================================

-- Test functions to validate RLS foundation (can be removed in production)
CREATE OR REPLACE FUNCTION test_rls_foundation()
RETURNS TABLE(function_name TEXT, success BOOLEAN, message TEXT)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  test_company_id UUID;
  test_result RECORD;
BEGIN
  -- Generate test company ID
  test_company_id := gen_random_uuid();

  -- Test 1: Set tenant context
  BEGIN
    PERFORM set_tenant_context(test_company_id, 'user');
    RETURN QUERY SELECT 'set_tenant_context'::TEXT, true::BOOLEAN, 'Successfully set context'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'set_tenant_context'::TEXT, false::BOOLEAN, SQLERRM::TEXT;
  END;

  -- Test 2: Get current company ID
  BEGIN
    SELECT get_current_company_id() INTO test_result;
    IF test_result.get_current_company_id = test_company_id THEN
      RETURN QUERY SELECT 'get_current_company_id'::TEXT, true::BOOLEAN, 'Retrieved correct company ID'::TEXT;
    ELSE
      RETURN QUERY SELECT 'get_current_company_id'::TEXT, false::BOOLEAN, 'Company ID mismatch'::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'get_current_company_id'::TEXT, false::BOOLEAN, SQLERRM::TEXT;
  END;

  -- Test 3: Get current user role
  BEGIN
    SELECT get_current_user_role() INTO test_result;
    IF test_result.get_current_user_role = 'user' THEN
      RETURN QUERY SELECT 'get_current_user_role'::TEXT, true::BOOLEAN, 'Retrieved correct user role'::TEXT;
    ELSE
      RETURN QUERY SELECT 'get_current_user_role'::TEXT, false::BOOLEAN, 'User role mismatch'::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'get_current_user_role'::TEXT, false::BOOLEAN, SQLERRM::TEXT;
  END;

  -- Test 4: Reset tenant context
  BEGIN
    PERFORM reset_tenant_context();
    IF get_current_company_id() IS NULL THEN
      RETURN QUERY SELECT 'reset_tenant_context'::TEXT, true::BOOLEAN, 'Successfully reset context'::TEXT;
    ELSE
      RETURN QUERY SELECT 'reset_tenant_context'::TEXT, false::BOOLEAN, 'Context not properly reset'::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'reset_tenant_context'::TEXT, false::BOOLEAN, SQLERRM::TEXT;
  END;

  -- Test 5: Admin check
  BEGIN
    PERFORM set_tenant_context(test_company_id, 'admin');
    IF is_current_user_admin() THEN
      RETURN QUERY SELECT 'is_current_user_admin'::TEXT, true::BOOLEAN, 'Admin check working'::TEXT;
    ELSE
      RETURN QUERY SELECT 'is_current_user_admin'::TEXT, false::BOOLEAN, 'Admin check failed'::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'is_current_user_admin'::TEXT, false::BOOLEAN, SQLERRM::TEXT;
  END;

  -- Reset context after tests
  PERFORM reset_tenant_context();

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_rls_foundation() IS 'Test function to validate RLS foundation installation. Returns test results for all core functions.';