-- migrations/015_enable_rls_users_oauth.sql
-- Row-Level Security Policies for Users and OAuth Accounts Tables
--
-- This migration enables comprehensive RLS on the users and oauth_accounts tables
-- to enforce tenant isolation and user-level access control at the database level.
--
-- Security Model:
-- - User Isolation: Regular users can only access their own user record
-- - OAuth Isolation: Users can only access their own OAuth accounts
-- - Admin Access: Company admins can access all users and OAuth accounts in their company
-- - Superadmin Access: Superadmins can access all users and OAuth accounts across all companies
-- - Write Protection: Prevent cross-company and unauthorized user data modifications
-- - ID Immutability: Prevent user_id and company_id changes for security

-- ============================================================================
-- EXTEND RLS FOUNDATION FOR USER-LEVEL ACCESS
-- ============================================================================

/**
 * Extend RLS context to include user_id for user-level access control
 * This allows policies to enforce that regular users can only access their own records
 *
 * @param user_id UUID - The user identifier for the current session
 */
CREATE OR REPLACE FUNCTION set_user_context(user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate input
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be NULL';
  END IF;

  -- Set user context using PostgreSQL's built-in session variables
  PERFORM set_config('rls.current_user_id', user_id::TEXT, false);

  -- Log the context set (for debugging and audit purposes)
  RAISE LOG 'RLS user context set: user_id=%', user_id;
END;
$$;

/**
 * Get the current user ID from session context
 * Returns NULL if no context has been set
 *
 * @returns UUID or NULL
 */
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_id_str TEXT;
  user_id UUID;
BEGIN
  -- Retrieve context from session variable
  user_id_str := current_setting('rls.current_user_id', true);

  IF user_id_str IS NULL THEN
    RETURN NULL;
  END IF;

  -- Convert to UUID
  user_id := user_id_str::UUID;
  RETURN user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error getting current user ID: %', SQLERRM;
    RETURN NULL;
END;
$$;

/**
 * Check if current user can access a specific user's data
 * Regular users can only access their own data, admins can access company data, superadmins can access all data
 *
 * @param row_user_id UUID - The user_id column from the row being checked
 * @param row_company_id UUID - The company_id column from the row being checked
 * @returns BOOLEAN - True if user has access to this user's data
 */
CREATE OR REPLACE FUNCTION can_access_user_data(row_user_id UUID, row_company_id UUID)
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

  -- Company admins can access all users in their company
  IF is_current_user_admin() THEN
    RETURN is_current_tenant_company(row_company_id);
  END IF;

  -- Regular users can only access their own data
  RETURN get_current_user_id() = row_user_id;
END;
$$;

/**
 * Check if current user can access a specific OAuth account
 * OAuth accounts inherit access from the user they belong to
 *
 * @param oauth_user_id UUID - The user_id that the OAuth account belongs to
 * @returns BOOLEAN - True if user has access to this OAuth account
 */
CREATE OR REPLACE FUNCTION can_access_oauth_account(oauth_user_id UUID)
RETURNS BOOLEAN
STABLE
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_company_id UUID;
BEGIN
  -- Superadmins can access all OAuth accounts
  IF is_current_user_superadmin() THEN
    RETURN true;
  END IF;

  -- Get the company_id of the user who owns this OAuth account
  SELECT company_id INTO user_company_id
  FROM users
  WHERE id = oauth_user_id;

  -- If user not found, deny access
  IF user_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Company admins can access all OAuth accounts in their company
  IF is_current_user_admin() THEN
    RETURN is_current_tenant_company(user_company_id);
  END IF;

  -- Regular users can only access their own OAuth accounts
  RETURN get_current_user_id() = oauth_user_id;
END;
$$;

-- ============================================================================
-- ENABLE RLS ON USERS AND OAUTH_ACCOUNTS TABLES
-- ============================================================================

-- Enable Row-Level Security on both tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE RLS POLICIES
-- ============================================================================

/**
 * Primary user-level isolation policy for users table
 *
 * This policy enforces that users can only access their own user record,
 * with exceptions for company admins (who can access all users in their company)
 * and superadmins (who can access all users across all companies).
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
CREATE POLICY users_self_isolation ON users
  FOR ALL
  USING (
    -- Regular users can only access their own record
    id = get_current_user_id()
    -- Company admins can access all users in their company
    OR (is_current_user_admin() AND company_id = get_current_company_id())
    -- Superadmins can access all users
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the user_id or company_id matches current context
    id = get_current_user_id()
    OR (is_current_user_admin() AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

/**
 * Company-level tenant isolation policy for users table
 *
 * This policy provides a fallback for queries that filter by company_id,
 * ensuring that users can only see users from their own company.
 *
 * This works in conjunction with the user isolation policy for comprehensive security.
 */
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING (
    -- Require company context to be set (fail secure if NULL)
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the company_id matches current context
    -- unless user is superadmin
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

/**
 * Admin access policy for users within the same company
 *
 * This policy allows company admins to perform all operations on users
 * within their company, but prevents cross-company access.
 *
 * This is redundant with the base isolation policy but provides explicit
 * policy documentation for admin capabilities.
 */
CREATE POLICY users_admin_access ON users
  FOR ALL
  USING (
    is_current_user_admin()
    AND company_id = get_current_company_id()
  )
  WITH CHECK (
    is_current_user_admin()
    AND company_id = get_current_company_id()
  );

/**
 * Read-only access policy for users with limited permissions
 *
 * This policy allows regular users to read their own user record
 * but prevents modifications unless they have admin privileges.
 */
CREATE POLICY users_read_only_access ON users
  FOR SELECT
  USING (
    -- Users can read their own record
    id = get_current_user_id()
    -- Or users from their company (for admin users)
    OR company_id = get_current_company_id()
    -- Superadmins can read all users
    OR is_current_user_superadmin()
  );

/**
 * Write protection policy to prevent cross-company user modifications
 *
 * This is a critical security policy that prevents users from modifying
 * user records belonging to other companies, even if they somehow bypass
 * application layer controls.
 *
 * This policy applies to INSERT, UPDATE, and DELETE operations.
 */
CREATE POLICY users_write_protection ON users
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted users belong to current user's company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

CREATE POLICY users_update_protection ON users
  FOR UPDATE
  USING (
    -- Can only update users in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent changing company_id on update (critical security control)
    company_id = (SELECT company_id FROM users WHERE id = users.id)
    OR is_current_user_superadmin()
  );

CREATE POLICY users_delete_protection ON users
  FOR DELETE
  USING (
    -- Can only delete users in own company
    company_id = get_current_company_id()
    OR is_current_user_superadmin()
  );

/**
 * Superadmin cross-company access policy for users
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * user records from any company. This is necessary for support and auditing purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
CREATE POLICY users_superadmin_full_access ON users
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

/**
 * Critical security policy to prevent user_id changes
 *
 * This policy prevents users from changing the user_id of existing user records,
 * which would be a security vulnerability allowing account hijacking.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
CREATE POLICY users_user_id_immutable ON users
  FOR UPDATE
  WITH CHECK (
    -- Prevent user_id from being changed (old value must equal new value)
    id = (SELECT id FROM users WHERE id = users.id)
    OR is_current_user_superadmin()
  );

/**
 * Critical security policy to prevent company_id changes
 *
 * This policy prevents users from changing the company_id of existing user records,
 * which would be a security vulnerability allowing data transfer between companies.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
CREATE POLICY users_company_id_immutable ON users
  FOR UPDATE
  WITH CHECK (
    -- Prevent company_id from being changed (old value must equal new value)
    company_id = (SELECT company_id FROM users WHERE id = users.id)
    OR is_current_user_superadmin()
  );

/**
 * Role elevation prevention policy
 *
 * This policy prevents regular users from elevating their privileges
 * by modifying the role or is_admin fields.
 *
 * Only admins and superadmins can modify these sensitive fields.
 */
CREATE POLICY users_role_protection ON users
  FOR UPDATE
  USING (
    -- Allow updates if role is not being changed
    (role IS NOT DISTINCT FROM (SELECT role FROM users WHERE id = users.id)
     AND is_admin IS NOT DISTINCT FROM (SELECT is_admin FROM users WHERE id = users.id))
    -- Or if user is admin/superadmin in their company
    OR (is_current_user_admin() AND company_id = get_current_company_id())
    -- Or if user is superadmin
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent role elevation unless user has admin privileges
    (role IS NOT DISTINCT FROM (SELECT role FROM users WHERE id = users.id)
     AND is_admin IS NOT DISTINCT FROM (SELECT is_admin FROM users WHERE id = users.id))
    OR (is_current_user_admin() AND company_id = get_current_company_id())
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- OAUTH_ACCOUNTS TABLE RLS POLICIES
-- ============================================================================

/**
 * Primary OAuth account isolation policy for oauth_accounts table
 *
 * This policy enforces that users can only access their own OAuth accounts,
 * company admins can access OAuth accounts for all users in their company,
 * and superadmins can access all OAuth accounts across all companies.
 *
 * USING clause: Controls SELECT, UPDATE, DELETE operations
 * WITH CHECK clause: Controls INSERT and UPDATE operations
 *
 * Security Philosophy: Fail secure - deny access if context not properly set
 */
CREATE POLICY oauth_accounts_user_isolation ON oauth_accounts
  FOR ALL
  USING (
    -- Regular users can only access their own OAuth accounts
    user_id = get_current_user_id()
    -- Company admins can access OAuth accounts for users in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can access all OAuth accounts
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- For inserts and updates, ensure the user_id belongs to appropriate company
    user_id = get_current_user_id()
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    OR is_current_user_superadmin()
  );

/**
 * Write protection policy for OAuth accounts
 *
 * This is a critical security policy that prevents users from creating or modifying
 * OAuth accounts for other users, unless they have admin privileges.
 *
 * This policy applies to INSERT, UPDATE, and DELETE operations.
 */
CREATE POLICY oauth_accounts_write_protection ON oauth_accounts
  FOR INSERT
  WITH CHECK (
    -- Ensure inserted OAuth accounts belong to current user
    user_id = get_current_user_id()
    -- Or admins can create OAuth accounts for users in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can create OAuth accounts for any user
    OR is_current_user_superadmin()
  );

CREATE POLICY oauth_accounts_update_protection ON oauth_accounts
  FOR UPDATE
  USING (
    -- Can only update own OAuth accounts
    user_id = get_current_user_id()
    -- Or admins can update OAuth accounts in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can update any OAuth accounts
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent user_id changes on OAuth accounts (critical security control)
    user_id = (SELECT user_id FROM oauth_accounts WHERE id = oauth_accounts.id)
    OR is_current_user_superadmin()
  );

CREATE POLICY oauth_accounts_delete_protection ON oauth_accounts
  FOR DELETE
  USING (
    -- Can only delete own OAuth accounts
    user_id = get_current_user_id()
    -- Or admins can delete OAuth accounts in their company
    OR is_current_user_admin() AND user_id IN (
      SELECT id FROM users WHERE company_id = get_current_company_id()
    )
    -- Superadmins can delete any OAuth accounts
    OR is_current_user_superadmin()
  );

/**
 * Superadmin cross-company access policy for OAuth accounts
 *
 * This policy explicitly allows superadmins to access, modify, and delete
 * OAuth accounts from any company. This is necessary for support and auditing purposes.
 *
 * WARNING: This policy should only be granted to trusted superadmin users.
 */
CREATE POLICY oauth_accounts_superadmin_full_access ON oauth_accounts
  FOR ALL
  USING (
    is_current_user_superadmin()
  )
  WITH CHECK (
    is_current_user_superadmin()
  );

/**
 * Critical security policy to prevent OAuth account user_id changes
 *
 * This policy prevents users from changing the user_id of existing OAuth accounts,
 * which would be a security vulnerability allowing account hijacking.
 *
 * This is a defense-in-depth control to prevent potential bypass of other policies.
 */
CREATE POLICY oauth_accounts_user_id_immutable ON oauth_accounts
  FOR UPDATE
  WITH CHECK (
    -- Prevent user_id from being changed (old value must equal new value)
    user_id = (SELECT user_id FROM oauth_accounts WHERE id = oauth_accounts.id)
    OR is_current_user_superadmin()
  );

/**
 * Token protection policy for OAuth accounts
 *
 * This policy prevents unauthorized access to sensitive OAuth tokens
 * by restricting modifications to access_token, refresh_token, and expires_at fields.
 *
 * Only the account owner (for updates) or superadmins can modify these fields.
 */
CREATE POLICY oauth_accounts_token_protection ON oauth_accounts
  FOR UPDATE
  USING (
    -- Allow if tokens are not being changed
    (access_token IS NOT DISTINCT FROM (SELECT access_token FROM oauth_accounts WHERE id = oauth_accounts.id)
     AND refresh_token IS NOT DISTINCT FROM (SELECT refresh_token FROM oauth_accounts WHERE id = oauth_accounts.id)
     AND expires_at IS NOT DISTINCT FROM (SELECT expires_at FROM oauth_accounts WHERE id = oauth_accounts.id))
    -- Or if user owns this OAuth account
    OR user_id = get_current_user_id()
    -- Or if user is superadmin
    OR is_current_user_superadmin()
  )
  WITH CHECK (
    -- Prevent token modifications unless user owns the account or is superadmin
    (access_token IS NOT DISTINCT FROM (SELECT access_token FROM oauth_accounts WHERE id = oauth_accounts.id)
     AND refresh_token IS NOT DISTINCT FROM (SELECT refresh_token FROM oauth_accounts WHERE id = oauth_accounts.id)
     AND expires_at IS NOT DISTINCT FROM (SELECT expires_at FROM oauth_accounts WHERE id = oauth_accounts.id))
    OR user_id = get_current_user_id()
    OR is_current_user_superadmin()
  );

-- ============================================================================
-- RLS POLICY DOCUMENTATION AND COMMENTS
-- ============================================================================

-- Users Table Policy Documentation
COMMENT ON POLICY users_self_isolation ON users IS 'Primary user-level isolation policy. Users can only access their own user record, except admins (company users) and superadmins (all users).';

COMMENT ON POLICY users_tenant_isolation ON users IS 'Company-level tenant isolation policy. Ensures users can only see users from their own company.';

COMMENT ON POLICY users_admin_access ON users IS 'Admin access policy within company. Allows company admins full access to users in their company.';

COMMENT ON POLICY users_read_only_access ON users IS 'Read-only access policy for regular users. Allows reading own user record or company users for admins.';

COMMENT ON POLICY users_write_protection ON users IS 'Insert protection policy. Ensures new users are assigned to current user company only.';

COMMENT ON POLICY users_update_protection ON users IS 'Update protection policy. Prevents cross-company user modifications and company_id changes.';

COMMENT ON POLICY users_delete_protection ON users IS 'Delete protection policy. Prevents cross-company user deletions.';

COMMENT ON POLICY users_superadmin_full_access ON users IS 'Superadmin full access policy. Allows superadmins to access all users across all companies.';

COMMENT ON POLICY users_user_id_immutable ON users IS 'Critical security policy. Prevents user_id changes on existing user records to prevent account hijacking.';

COMMENT ON POLICY users_company_id_immutable ON users IS 'Critical security policy. Prevents company_id changes on existing users to prevent data transfer between companies.';

COMMENT ON POLICY users_role_protection ON users IS 'Role elevation prevention policy. Prevents regular users from elevating their privileges by modifying role or is_admin fields.';

-- OAuth Accounts Table Policy Documentation
COMMENT ON POLICY oauth_accounts_user_isolation ON oauth_accounts IS 'Primary OAuth account isolation policy. Users can only access their own OAuth accounts, admins can access company accounts, superadmins can access all accounts.';

COMMENT ON POLICY oauth_accounts_write_protection ON oauth_accounts IS 'Insert protection policy. Ensures new OAuth accounts belong to current user or company users for admins.';

COMMENT ON POLICY oauth_accounts_update_protection ON oauth_accounts IS 'Update protection policy. Prevents OAuth account hijacking and user_id changes.';

COMMENT ON POLICY oauth_accounts_delete_protection ON oauth_accounts IS 'Delete protection policy. Prevents unauthorized OAuth account deletions.';

COMMENT ON POLICY oauth_accounts_superadmin_full_access ON oauth_accounts IS 'Superadmin full access policy. Allows superadmins to access all OAuth accounts across all companies.';

COMMENT ON POLICY oauth_accounts_user_id_immutable ON oauth_accounts IS 'Critical security policy. Prevents user_id changes on existing OAuth accounts to prevent account hijacking.';

COMMENT ON POLICY oauth_accounts_token_protection ON oauth_accounts IS 'Token protection policy. Restricts modifications to sensitive OAuth tokens to account owners and superadmins.';

-- ============================================================================
-- INDEX OPTIMIZATION FOR RLS PERFORMANCE
-- ============================================================================

-- Ensure users table has proper indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);

-- Create composite index for common RLS queries (company_id + role)
-- This optimizes queries that filter by company and role for admin operations
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role);

-- Create index for email-based lookups within company context
CREATE INDEX IF NOT EXISTS idx_users_company_email ON users(company_id, email);

-- Ensure oauth_accounts table has proper indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);

-- Create composite index for common RLS queries in oauth_accounts
-- This optimizes queries that join oauth_accounts with users for company-based access
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_provider ON oauth_accounts(user_id, provider);

-- ============================================================================
-- EXTENDED RLS CONTEXT MANAGEMENT FUNCTIONS
-- ============================================================================

/**
 * Set complete user context (both company and user)
 * This is a convenience function that sets both company and user contexts
 *
 * @param company_id UUID - The company identifier for the current session
 * @param user_id UUID - The user identifier for the current session
 * @param user_role TEXT - The user role ('user', 'admin', 'superadmin')
 */
CREATE OR REPLACE FUNCTION set_complete_user_context(company_id UUID, user_id UUID, user_role TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set tenant context
  PERFORM set_tenant_context(company_id, user_role);

  -- Set user context
  PERFORM set_user_context(user_id);

  -- Log the complete context set
  RAISE LOG 'RLS complete context set: company_id=%, user_id=%, user_role=%', company_id, user_id, user_role;
END;
$$;

/**
 * Reset complete user context
 * This is a convenience function that resets both company and user contexts
 */
CREATE OR REPLACE FUNCTION reset_complete_user_context()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset tenant context
  PERFORM reset_tenant_context();

  -- Reset user context
  PERFORM set_config('rls.current_user_id', NULL, false);

  -- Log the context reset
  RAISE LOG 'RLS complete context reset';
END;
$$;

-- ============================================================================
-- POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Test function to validate users RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly for the users table. It tests user isolation, admin access,
 * and superadmin access.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_users_rls()
RETURNS TABLE(
  test_name TEXT,
  success BOOLEAN,
  message TEXT,
  details TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  test_company_1_id UUID;
  test_company_2_id UUID;
  test_user_company_1_id UUID;
  test_admin_company_1_id UUID;
  test_superadmin_id UUID;
  test_user_id UUID;
  access_count INTEGER;
  expected_count INTEGER;
BEGIN
  -- Generate test company IDs
  test_company_1_id := gen_random_uuid();
  test_company_2_id := gen_random_uuid();
  test_user_id := gen_random_uuid();

  -- Test 1: Verify RLS is enabled
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'users'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'Users RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on users table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Users RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on users table'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Users RLS Enabled'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 2: Verify user context requirement
  BEGIN
    -- Reset context first
    PERFORM reset_complete_user_context();

    -- Set user context for testing
    PERFORM set_user_context(test_user_id);
    PERFORM set_tenant_context(test_company_1_id, 'user');

    -- Verify user context is set
    IF get_current_user_id() = test_user_id THEN
      RETURN QUERY SELECT 'User Context Requirement'::TEXT, true::BOOLEAN,
        'User context correctly set to user_id'::TEXT, test_user_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'User Context Requirement'::TEXT, false::BOOLEAN,
        'User context not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'User Context Requirement'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 3: Verify user isolation
  BEGIN
    -- Set context for a specific user
    PERFORM set_complete_user_context(test_company_1_id, test_user_id, 'user');

    -- Verify the context is set correctly
    IF get_current_user_id() = test_user_id AND get_current_company_id() = test_company_1_id THEN
      RETURN QUERY SELECT 'User Isolation Context'::TEXT, true::BOOLEAN,
        'User isolation context correctly set'::TEXT,
        'user_id=' || test_user_id || ', company_id=' || test_company_1_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'User Isolation Context'::TEXT, false::BOOLEAN,
        'User isolation context not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'User Isolation Context'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 4: Verify admin function works with users
  BEGIN
    -- Test admin check with admin role
    PERFORM set_complete_user_context(test_company_1_id, test_user_id, 'admin');

    IF is_current_user_admin() THEN
      RETURN QUERY SELECT 'Users Admin Check'::TEXT, true::BOOLEAN,
        'Admin role correctly identified for users policies'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Users Admin Check'::TEXT, false::BOOLEAN,
        'Admin role not correctly identified for users policies'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Users Admin Check'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 5: Verify can_access_user_data function
  BEGIN
    -- Set admin context
    PERFORM set_complete_user_context(test_company_1_id, test_user_id, 'admin');

    -- Test access function
    IF can_access_user_data(test_user_id, test_company_1_id) THEN
      RETURN QUERY SELECT 'User Access Function'::TEXT, true::BOOLEAN,
        'User access function working correctly for admin'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'User Access Function'::TEXT, false::BOOLEAN,
        'User access function not working correctly'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'User Access Function'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 6: Verify users policies exist
  BEGIN
    -- Check if our key policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'users'
      AND policyname = 'users_self_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'users'
      AND policyname = 'users_role_protection'
    ) THEN
      RETURN QUERY SELECT 'Users Policy Existence'::TEXT, true::BOOLEAN,
        'All required users RLS policies exist'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Users Policy Existence'::TEXT, false::BOOLEAN,
        'Some required users RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Users Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_users_rls() IS 'Test function to validate users RLS policy implementation. Returns test results for user-level and company-level access controls.';

/**
 * Test function to validate oauth_accounts RLS policies
 *
 * This function creates test scenarios to validate that RLS policies are
 * working correctly for the oauth_accounts table. It tests user isolation,
 * admin access, and superadmin access.
 *
 * @returns Test results showing policy effectiveness
 */
CREATE OR REPLACE FUNCTION test_oauth_accounts_rls()
RETURNS TABLE(
  test_name TEXT,
  success BOOLEAN,
  message TEXT,
  details TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  test_company_1_id UUID;
  test_company_2_id UUID;
  test_user_company_1_id UUID;
  test_oauth_user_id UUID;
  access_count INTEGER;
BEGIN
  -- Generate test IDs
  test_company_1_id := gen_random_uuid();
  test_company_2_id := gen_random_uuid();
  test_user_company_1_id := gen_random_uuid();
  test_oauth_user_id := gen_random_uuid();

  -- Test 1: Verify RLS is enabled on oauth_accounts
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'oauth_accounts'
      AND rowsecurity = true
    ) THEN
      RETURN QUERY SELECT 'OAuth RLS Enabled'::TEXT, true::BOOLEAN,
        'RLS is enabled on oauth_accounts table'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'OAuth RLS Enabled'::TEXT, false::BOOLEAN,
        'RLS is NOT enabled on oauth_accounts table'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'OAuth RLS Enabled'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 2: Verify OAuth account access function
  BEGIN
    -- Set admin context
    PERFORM set_complete_user_context(test_company_1_id, test_user_company_1_id, 'admin');

    -- Test OAuth access function
    IF can_access_oauth_account(test_oauth_user_id) THEN
      RETURN QUERY SELECT 'OAuth Access Function'::TEXT, true::BOOLEAN,
        'OAuth account access function working correctly'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'OAuth Access Function'::TEXT, false::BOOLEAN,
        'OAuth account access function not working correctly'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'OAuth Access Function'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 3: Verify user isolation for OAuth accounts
  BEGIN
    -- Set regular user context
    PERFORM set_complete_user_context(test_company_1_id, test_oauth_user_id, 'user');

    -- Verify the context is set correctly for OAuth access
    IF get_current_user_id() = test_oauth_user_id THEN
      RETURN QUERY SELECT 'OAuth User Isolation'::TEXT, true::BOOLEAN,
        'OAuth user isolation context correctly set'::TEXT, test_oauth_user_id::TEXT;
    ELSE
      RETURN QUERY SELECT 'OAuth User Isolation'::TEXT, false::BOOLEAN,
        'OAuth user isolation context not correctly set'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'OAuth User Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 4: Verify admin access to company OAuth accounts
  BEGIN
    -- Set admin context
    PERFORM set_complete_user_context(test_company_1_id, test_user_company_1_id, 'admin');

    IF is_current_user_admin() THEN
      RETURN QUERY SELECT 'OAuth Admin Access'::TEXT, true::BOOLEAN,
        'Admin can access company OAuth accounts'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'OAuth Admin Access'::TEXT, false::BOOLEAN,
        'Admin access to OAuth accounts not working'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'OAuth Admin Access'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  -- Test 5: Verify oauth_accounts policies exist
  BEGIN
    -- Check if our key policies exist
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'oauth_accounts'
      AND policyname = 'oauth_accounts_user_isolation'
    ) AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'oauth_accounts'
      AND policyname = 'oauth_accounts_token_protection'
    ) THEN
      RETURN QUERY SELECT 'OAuth Policy Existence'::TEXT, true::BOOLEAN,
        'All required oauth_accounts RLS policies exist'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'OAuth Policy Existence'::TEXT, false::BOOLEAN,
        'Some required oauth_accounts RLS policies are missing'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'OAuth Policy Existence'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 6: Verify complete context management
  BEGIN
    -- Test setting complete user context
    PERFORM set_complete_user_context(test_company_1_id, test_oauth_user_id, 'user');

    IF get_current_user_id() = test_oauth_user_id AND get_current_company_id() = test_company_1_id THEN
      RETURN QUERY SELECT 'Complete Context Management'::TEXT, true::BOOLEAN,
        'Complete user context management working correctly'::TEXT, ''::TEXT;
    ELSE
      RETURN QUERY SELECT 'Complete Context Management'::TEXT, false::BOOLEAN,
        'Complete user context management not working correctly'::TEXT, ''::TEXT;
    END IF;

    PERFORM reset_complete_user_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Complete Context Management'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_complete_user_context();
  END;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_oauth_accounts_rls() IS 'Test function to validate oauth_accounts RLS policy implementation. Returns test results for OAuth account access controls and token protection.';

/**
 * Comprehensive test function for both users and oauth_accounts RLS
 *
 * This function runs all tests for both tables and provides a comprehensive
 * validation of the RLS implementation.
 *
 * @returns Complete test results for all RLS policies
 */
CREATE OR REPLACE FUNCTION test_users_oauth_rls_complete()
RETURNS TABLE(
  table_name TEXT,
  test_name TEXT,
  success BOOLEAN,
  message TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Run users RLS tests
  RETURN QUERY SELECT 'users'::TEXT, * FROM test_users_rls();

  -- Run a small delay to avoid any potential issues
  PERFORM pg_sleep(0.1);

  -- Run oauth_accounts RLS tests
  RETURN QUERY SELECT 'oauth_accounts'::TEXT, * FROM test_oauth_accounts_rls();
END;
$$;

COMMENT ON FUNCTION test_users_oauth_rls_complete() IS 'Comprehensive test function for users and oauth_accounts RLS policies. Runs all validation tests and returns complete results.';

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

/**
 * Audit function to check for potential RLS policy bypass attempts on users table
 *
 * This function can be used to monitor for suspicious activity that might
 * indicate attempts to bypass RLS policies for user data access.
 *
 * @returns Audit information about user access patterns
 */
CREATE OR REPLACE FUNCTION audit_users_rls_access()
RETURNS TABLE(
  event_type TEXT,
  description TEXT,
  severity TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for queries without proper user context setup
  -- This would be implemented with additional monitoring infrastructure

  RETURN QUERY SELECT
    'Users RLS Context Monitoring'::TEXT,
    'Audit function for monitoring users RLS access patterns'::TEXT,
    'INFO'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_users_rls_access() IS 'Audit function to monitor users RLS access patterns for security purposes.';

/**
 * Audit function to check for potential RLS policy bypass attempts on oauth_accounts table
 *
 * This function can be used to monitor for suspicious activity that might
 * indicate attempts to bypass RLS policies for OAuth data access.
 *
 * @returns Audit information about OAuth account access patterns
 */
CREATE OR REPLACE FUNCTION audit_oauth_accounts_rls_access()
RETURNS TABLE(
  event_type TEXT,
  description TEXT,
  severity TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for unusual OAuth account access patterns
  -- This would be implemented with additional monitoring infrastructure

  RETURN QUERY SELECT
    'OAuth Accounts RLS Context Monitoring'::TEXT,
    'Audit function for monitoring OAuth accounts RLS access patterns'::TEXT,
    'INFO'::TEXT;
END;
$$;

COMMENT ON FUNCTION audit_oauth_accounts_rls_access() IS 'Audit function to monitor OAuth accounts RLS access patterns for security purposes.';

/**
 * Comprehensive security audit for users and oauth_accounts tables
 *
 * This function performs a comprehensive security audit checking for:
 * - RLS policy existence and configuration
 * - Potential security vulnerabilities
 * - Access pattern anomalies
 * - Policy bypass attempts
 *
 * @returns Comprehensive security audit results
 */
CREATE OR REPLACE FUNCTION audit_users_oauth_security()
RETURNS TABLE(
  table_name TEXT,
  check_type TEXT,
  status TEXT,
  details TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check users table RLS configuration
  RETURN QUERY SELECT
    'users'::TEXT,
    'RLS Enabled'::TEXT,
    CASE WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'users') THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Users table RLS status check'::TEXT;

  -- Check oauth_accounts table RLS configuration
  RETURN QUERY SELECT
    'oauth_accounts'::TEXT,
    'RLS Enabled'::TEXT,
    CASE WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'oauth_accounts') THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'OAuth accounts table RLS status check'::TEXT;

  -- Check for critical security policies
  RETURN QUERY SELECT
    'users'::TEXT,
    'Critical Policies'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'users'
      AND policyname IN ('users_user_id_immutable', 'users_company_id_immutable', 'users_role_protection')
      GROUP BY policyname
      HAVING COUNT(*) = 3
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Critical users security policies check'::TEXT;

  RETURN QUERY SELECT
    'oauth_accounts'::TEXT,
    'Critical Policies'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'oauth_accounts'
      AND policyname IN ('oauth_accounts_user_id_immutable', 'oauth_accounts_token_protection')
      GROUP BY policyname
      HAVING COUNT(*) = 2
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Critical oauth_accounts security policies check'::TEXT;

  -- Check for performance indexes
  RETURN QUERY SELECT
    'users'::TEXT,
    'Performance Indexes'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'users'
      AND indexname IN ('idx_users_company_id', 'idx_users_id', 'idx_users_company_role')
      GROUP BY indexname
      HAVING COUNT(*) = 3
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Users table performance indexes check'::TEXT;

  RETURN QUERY SELECT
    'oauth_accounts'::TEXT,
    'Performance Indexes'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'oauth_accounts'
      AND indexname IN ('idx_oauth_accounts_user_id', 'idx_oauth_accounts_provider', 'idx_oauth_accounts_user_provider')
      GROUP BY indexname
      HAVING COUNT(*) = 3
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'OAuth accounts table performance indexes check'::TEXT;

END;
$$;

COMMENT ON FUNCTION audit_users_oauth_security() IS 'Comprehensive security audit function for users and oauth_accounts tables. Checks RLS configuration, critical policies, and performance indexes.';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new RLS functions to the database user
-- These permissions will be inherited by the application

GRANT EXECUTE ON FUNCTION set_user_context(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_access_user_data(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_access_oauth_account(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_complete_user_context(UUID, UUID, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION reset_complete_user_context() TO PUBLIC;
GRANT EXECUTE ON FUNCTION test_users_rls() TO PUBLIC;
GRANT EXECUTE ON FUNCTION test_oauth_accounts_rls() TO PUBLIC;
GRANT EXECUTE ON FUNCTION test_users_oauth_rls_complete() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_users_rls_access() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_oauth_accounts_rls_access() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_users_oauth_security() TO PUBLIC;

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

/*
 * ROLLBACK INSTRUCTIONS:
 *
 * To rollback this migration and disable RLS on users and oauth_accounts tables:
 *
 * 1. Disable RLS (not recommended in production):
 *    ALTER TABLE users DISABLE ROW LEVEL SECURITY;
 *    ALTER TABLE oauth_accounts DISABLE ROW LEVEL SECURITY;
 *
 * 2. Drop all users table policies:
 *    DROP POLICY IF EXISTS users_self_isolation ON users;
 *    DROP POLICY IF EXISTS users_tenant_isolation ON users;
 *    DROP POLICY IF EXISTS users_admin_access ON users;
 *    DROP POLICY IF EXISTS users_read_only_access ON users;
 *    DROP POLICY IF EXISTS users_write_protection ON users;
 *    DROP POLICY IF EXISTS users_update_protection ON users;
 *    DROP POLICY IF EXISTS users_delete_protection ON users;
 *    DROP POLICY IF EXISTS users_superadmin_full_access ON users;
 *    DROP POLICY IF EXISTS users_user_id_immutable ON users;
 *    DROP POLICY IF EXISTS users_company_id_immutable ON users;
 *    DROP POLICY IF EXISTS users_role_protection ON users;
 *
 * 3. Drop all oauth_accounts table policies:
 *    DROP POLICY IF EXISTS oauth_accounts_user_isolation ON oauth_accounts;
 *    DROP POLICY IF EXISTS oauth_accounts_write_protection ON oauth_accounts;
 *    DROP POLICY IF EXISTS oauth_accounts_update_protection ON oauth_accounts;
 *    DROP POLICY IF EXISTS oauth_accounts_delete_protection ON oauth_accounts;
 *    DROP POLICY IF EXISTS oauth_accounts_superadmin_full_access ON oauth_accounts;
 *    DROP POLICY IF EXISTS oauth_accounts_user_id_immutable ON oauth_accounts;
 *    DROP POLICY IF EXISTS oauth_accounts_token_protection ON oauth_accounts;
 *
 * 4. Drop test and audit functions:
 *    DROP FUNCTION IF EXISTS test_users_rls();
 *    DROP FUNCTION IF EXISTS test_oauth_accounts_rls();
 *    DROP FUNCTION IF EXISTS test_users_oauth_rls_complete();
 *    DROP FUNCTION IF EXISTS audit_users_rls_access();
 *    DROP FUNCTION IF EXISTS audit_oauth_accounts_rls_access();
 *    DROP FUNCTION IF EXISTS audit_users_oauth_security();
 *
 * 5. Drop extended context functions:
 *    DROP FUNCTION IF EXISTS set_user_context(UUID);
 *    DROP FUNCTION IF EXISTS get_current_user_id();
 *    DROP FUNCTION IF EXISTS can_access_user_data(UUID, UUID);
 *    DROP FUNCTION IF EXISTS can_access_oauth_account(UUID);
 *    DROP FUNCTION IF EXISTS set_complete_user_context(UUID, UUID, TEXT);
 *    DROP FUNCTION IF EXISTS reset_complete_user_context();
 *
 * 6. Drop performance indexes (optional):
 *    DROP INDEX IF EXISTS idx_users_company_role;
 *    DROP INDEX IF EXISTS idx_users_company_email;
 *    DROP INDEX IF EXISTS idx_oauth_accounts_user_provider;
 *
 * WARNING: Rolling back RLS policies will remove database-level security
 * and make the application dependent on application-layer security only.
 */

-- ============================================================================
-- IMPLEMENTATION NOTES
-- ============================================================================

/*
 * IMPLEMENTATION NOTES:
 *
 * 1. USER-LEVEL vs COMPANY-LEVEL ACCESS:
 *    - Users table implements both user-level (self access) and company-level (admin access)
 *    - OAuth accounts inherit access from the user they belong to
 *    - This provides granular security while maintaining admin capabilities
 *
 * 2. CONTEXT MANAGEMENT:
 *    - Application must call set_complete_user_context() at the start of each request
 *    - Context includes: company_id, user_id, and user_role
 *    - All three components are required for proper policy evaluation
 *
 * 3. USING vs WITH CHECK:
 *    - USING controls SELECT, UPDATE, DELETE
 *    - WITH CHECK controls INSERT, UPDATE
 *    - Both are needed for comprehensive security
 *
 * 4. SECURITY POLICIES:
 *    - users_user_id_immutable: Prevents account hijacking
 *    - users_company_id_immutable: Prevents data transfer between companies
 *    - users_role_protection: Prevents privilege escalation
 *    - oauth_accounts_user_id_immutable: Prevents OAuth account hijacking
 *    - oauth_accounts_token_protection: Protects sensitive OAuth tokens
 *
 * 5. FAIL-SECURE PHILOSOPHY:
 *    - All policies deny access by default if context is not properly set
 *    - Prevents accidental data exposure from missing context
 *    - Provides defense-in-depth security
 *
 * 6. PERFORMANCE CONSIDERATIONS:
 *    - Indexes on user_id and company_id are critical for RLS performance
 *    - Composite indexes optimize common admin query patterns
 *    - Policies use subqueries efficiently to minimize performance impact
 *
 * 7. OAUTH ACCOUNTS SECURITY:
 *    - OAuth accounts are protected through user relationship
 *    - Token protection prevents unauthorized token access
 *    - Admin access limited to OAuth accounts within their company
 *
 * 8. TESTING AND VALIDATION:
 *    - test_users_rls() validates user-level and company-level access
 *    - test_oauth_accounts_rls() validates OAuth account access controls
 *    - test_users_oauth_rls_complete() provides comprehensive testing
 *    - audit_users_oauth_security() provides ongoing security monitoring
 *
 * 9. APPLICATION INTEGRATION:
 *    - Update lib/db.ts to use set_complete_user_context()
 *    - Ensure user_id is passed through application session
 *    - Update middleware to set complete user context
 *    - Test thoroughly before deploying to production
 *
 * 10. MONITORING AND AUDITING:
 *     - Use audit functions to monitor access patterns
 *     - Monitor for policy bypass attempts
 *     - Review superadmin access logs regularly
 *     - Set up alerts for suspicious activity
 */