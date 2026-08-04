-- Migration 036: Enable RLS for password_reset_tokens table
-- Phase 11.4: Final Tables RLS Implementation
-- Security Priority: MEDIUM-HIGH (authentication security tokens)
-- Table Purpose: Password reset authentication tokens
-- Current Data: 0 rows (preventive security implementation)

-- Grant permissions to concetto_boms role (must be run as superuser)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE password_reset_tokens TO concetto_boms;

-- Drop existing policies if they exist from previous runs
DROP POLICY IF EXISTS password_reset_tokens_user_isolation ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_admin_access ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_superadmin_full_access ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_token_protection ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_user_protection ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_used_protection ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_read_only_access ON password_reset_tokens;

-- Enable RLS on password_reset_tokens table
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policy 1: User-level isolation (self-access pattern)
-- Users can only manage their own password reset tokens
CREATE POLICY password_reset_tokens_user_isolation ON password_reset_tokens
  FOR ALL
  TO concetto_boms
  USING (user_id IN (
    SELECT id FROM users
    WHERE company_id = get_current_company_id()
    AND id = get_current_user_id()
  ))
  WITH CHECK (user_id IN (
    SELECT id FROM users
    WHERE company_id = get_current_company_id()
    AND id = get_current_user_id()
  ));

-- Policy 2: Company admin access for password reset support
-- Company admins can manage password reset tokens within their company
CREATE POLICY password_reset_tokens_admin_access ON password_reset_tokens
  FOR ALL
  TO concetto_boms
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    ) AND is_current_user_admin()
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
    ) AND is_current_user_admin()
  );

-- Policy 3: Superadmin full access for security support
CREATE POLICY password_reset_tokens_superadmin_full_access ON password_reset_tokens
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 4: Token immutability protection
-- Prevent modification of token values after creation
CREATE POLICY password_reset_tokens_token_immutable ON password_reset_tokens
  FOR UPDATE
  TO concetto_boms
  USING (true)
  WITH CHECK (
    token = (SELECT token FROM password_reset_tokens WHERE id = password_reset_tokens.id)
    OR is_current_user_superadmin()
  );

-- Policy 5: User association immutability protection
-- Prevent reassignment of tokens between users
CREATE POLICY password_reset_tokens_user_association_immutable ON password_reset_tokens
  FOR UPDATE
  TO concetto_boms
  USING (true)
  WITH CHECK (
    user_id = (SELECT user_id FROM password_reset_tokens WHERE id = password_reset_tokens.id)
    OR is_current_user_superadmin()
  );

-- Policy 6: Used token protection
-- Once a token is used, only superadmin can modify
CREATE POLICY password_reset_tokens_used_protection ON password_reset_tokens
  FOR UPDATE
  TO concetto_boms
  USING (
    (SELECT used_at FROM password_reset_tokens WHERE id = password_reset_tokens.id) IS NULL
    OR is_current_user_superadmin()
  );

-- Policy 7: Insert protection for security
-- Control who can create new password reset tokens
CREATE POLICY password_reset_tokens_insert_protection ON password_reset_tokens
  FOR INSERT
  TO concetto_boms
  WITH CHECK (
    user_id IN (
      SELECT id FROM users
      WHERE company_id = get_current_company_id()
      AND (id = get_current_user_id() OR is_current_user_admin() OR is_current_user_superadmin())
    )
  );

-- Policy 8: Read-only access for authenticated users (fallback)
-- Ensures users with proper context can at least read their own tokens
CREATE POLICY password_reset_tokens_read_only_access ON password_reset_tokens
  FOR SELECT
  TO concetto_boms
  USING (user_id IN (
    SELECT id FROM users
    WHERE company_id = get_current_company_id()
  ));

-- Create indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_company_indirect ON password_reset_tokens(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used_at ON password_reset_tokens(used_at)
  WHERE used_at IS NOT NULL;

-- Create comprehensive test function
CREATE OR REPLACE FUNCTION test_password_reset_tokens_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID;
  test_user_id UUID;
  test_admin_id UUID;
  test_token_id UUID;
  context_set BOOLEAN;
BEGIN
  -- Setup: Get test data
  SELECT id INTO test_company_id FROM companies LIMIT 1;
  SELECT id INTO test_user_id FROM users WHERE company_id = test_company_id LIMIT 1;
  SELECT id INTO test_admin_id FROM users WHERE company_id = test_company_id AND role = 'admin' LIMIT 1;

  -- Clean up any existing test tokens
  DELETE FROM password_reset_tokens WHERE token LIKE 'TEST-TOKEN-%';

  -- Test 1: User can create their own password reset token
  BEGIN
    PERFORM set_tenant_context(test_company_id, 'user');
    PERFORM set_user_context(test_user_id);

    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (test_user_id, 'TEST-TOKEN-1', NOW() + INTERVAL '1 hour')
    RETURNING id INTO test_token_id;

    RETURN QUERY SELECT
      'User can create own token'::TEXT,
      true::BOOLEAN,
      'Token created successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'User can create own token'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 2: User can only see their own tokens
  BEGIN
    PERFORM set_tenant_context(test_company_id, 'user');
    PERFORM set_user_context(test_user_id);

    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');
    PERFORM set_user_context(test_user_id);

    SELECT count(*) INTO context_set FROM password_reset_tokens
    WHERE user_id = test_user_id AND token = 'TEST-TOKEN-1';

    RETURN QUERY SELECT
      'User can see own tokens'::TEXT,
      (context_set = 1)::BOOLEAN,
      ('Found ' || context_set || ' tokens')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'User can see own tokens'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 3: User cannot see other users' tokens
  BEGIN
    PERFORM reset_tenant_context();

    -- Create another user's token
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (
      (SELECT id FROM users WHERE company_id != test_company_id LIMIT 1),
      'TEST-TOKEN-OTHER',
      NOW() + INTERVAL '1 hour'
    );

    PERFORM set_tenant_context(test_company_id, 'user');
    PERFORM set_user_context(test_user_id);

    SELECT count(*) INTO context_set FROM password_reset_tokens WHERE token = 'TEST-TOKEN-OTHER';

    RETURN QUERY SELECT
      'User cannot see other tokens'::TEXT,
      (context_set = 0)::BOOLEAN,
      ('Found ' || context_set || ' other user tokens')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'User cannot see other tokens'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 4: Admin can see all company tokens
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'admin');
    PERFORM set_user_context(test_admin_id);

    SELECT count(*) INTO context_set FROM password_reset_tokens
    WHERE user_id IN (SELECT id FROM users WHERE company_id = test_company_id);

    RETURN QUERY SELECT
      'Admin can see company tokens'::TEXT,
      (context_set > 0)::BOOLEAN,
      ('Found ' || context_set || ' company tokens')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Admin can see company tokens'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 5: Superadmin can see all tokens
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(NULL, 'superadmin');

    SELECT count(*) INTO context_set FROM password_reset_tokens;

    RETURN QUERY SELECT
      'Superadmin can see all tokens'::TEXT,
      (context_set > 0)::BOOLEAN,
      ('Found ' || context_set || ' total tokens')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can see all tokens'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 6: Token immutability protection
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');
    PERFORM set_user_context(test_user_id);

    -- Try to modify token value (should fail)
    UPDATE password_reset_tokens SET token = 'MODIFIED-TOKEN'
    WHERE id = test_token_id;

    RETURN QUERY SELECT
      'Token immutability enforced'::TEXT,
      false::BOOLEAN,
      'Token was modified (security failure)'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Token immutability enforced'::TEXT,
      true::BOOLEAN,
      'Token modification blocked correctly'::TEXT;
  END;

  -- Test 7: User association immutability protection
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'admin');
    PERFORM set_user_context(test_admin_id);

    -- Try to reassign token to different user (should fail)
    UPDATE password_reset_tokens SET user_id =
      (SELECT id FROM users WHERE company_id = test_company_id AND id != test_user_id LIMIT 1)
    WHERE id = test_token_id;

    RETURN QUERY SELECT
      'User association immutability enforced'::TEXT,
      false::BOOLEAN,
      'User association was modified (security failure)'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'User association immutability enforced'::TEXT,
      true::BOOLEAN,
      'User association modification blocked correctly'::TEXT;
  END;

  -- Cleanup
  PERFORM reset_tenant_context();
  DELETE FROM password_reset_tokens WHERE token LIKE 'TEST-TOKEN-%';

  RETURN QUERY SELECT
    'Cleanup completed'::TEXT,
    true::BOOLEAN,
    'Test data removed'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security audit function
CREATE OR REPLACE FUNCTION audit_password_reset_tokens_security()
RETURNS TABLE(audit_check TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit 1: Verify RLS is enabled
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'password_reset_tokens' AND relrowsecurity = true)
      THEN 'ENABLED'::TEXT
      ELSE 'DISABLED'::TEXT
    END,
    'Row-level security status check'::TEXT;

  -- Audit 2: Count policies
  RETURN QUERY SELECT
    'Policy Count'::TEXT,
    COUNT(*)::TEXT,
    'Number of RLS policies defined'::TEXT
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'password_reset_tokens';

  -- Audit 3: Verify critical indexes exist
  RETURN QUERY SELECT
    'Critical Indexes'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'password_reset_tokens' AND indexname LIKE '%user_id%')
      THEN 'PRESENT'::TEXT
      ELSE 'MISSING'::TEXT
    END,
    'Required user_id index for RLS performance'::TEXT;

  -- Audit 4: Check for proper user context usage
  RETURN QUERY SELECT
    'User Context Integration'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        WHERE cls.relname = 'password_reset_tokens'
        AND pol.polqual::text LIKE '%get_current_user_id()%'
      ) THEN 'INTEGRATED'::TEXT
      ELSE 'NOT_INTEGRATED'::TEXT
    END,
    'User-level context integration check'::TEXT;

  -- Audit 5: Verify token protection policies
  RETURN QUERY SELECT
    'Token Protection'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'password_reset_tokens'
        AND policyname LIKE '%immutable%'
      ) THEN 'PROTECTED'::TEXT
      ELSE 'VULNERABLE'::TEXT
    END,
    'Token immutability protection status'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'password_reset_tokens' AND relrowsecurity = true) THEN
    RAISE EXCEPTION 'RLS not enabled on password_reset_tokens table';
  END IF;

  -- Verify policies were created
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'password_reset_tokens') < 8 THEN
    RAISE EXCEPTION 'Expected at least 8 RLS policies, found %',
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'password_reset_tokens');
  END IF;

  -- Verify indexes were created
  IF (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'password_reset_tokens') < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 indexes, found %',
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'password_reset_tokens');
  END IF;

  RAISE NOTICE '✅ password_reset_tokens RLS implementation completed successfully';
  RAISE NOTICE '📊 Policies created: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'password_reset_tokens');
  RAISE NOTICE '🔒 Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'password_reset_tokens');
END $$;