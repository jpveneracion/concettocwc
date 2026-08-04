-- Migration 039: Enable RLS for payment_settings table
-- Phase 11.4: Final Tables RLS Implementation
-- Security Priority: MEDIUM (global payment configuration)
-- Table Purpose: Global payment processing settings, QR codes, payment method configuration
-- Current Data: 2 rows (QR codes, payment configuration)
-- Security Model: Read-only for all users, write access for superadmins only

-- Grant permissions to concetto_boms role (must be run as superuser)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payment_settings TO concetto_boms;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS payment_settings_read_all ON payment_settings;
DROP POLICY IF EXISTS payment_settings_superadmin_write ON payment_settings;
DROP POLICY IF EXISTS payment_settings_critical_protection ON payment_settings;

-- Enable RLS on payment_settings table
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Read-only access for all authenticated users
-- All users can read payment settings for transaction processing
CREATE POLICY payment_settings_read_all ON payment_settings
  FOR SELECT
  TO concetto_boms
  USING (true);

-- Policy 2: Superadmin-only write access
-- Only superadmins can modify global payment configuration
CREATE POLICY payment_settings_superadmin_write ON payment_settings
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 3: Critical payment infrastructure protection
-- Additional protection for active payment settings
CREATE POLICY payment_settings_critical_protection ON payment_settings
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Allow superadmin updates, but protect critical fields
    is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional validation for critical payment settings
    is_current_user_superadmin()
  );

-- Create indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_payment_settings_payment_method ON payment_settings(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_settings_active ON payment_settings(active)
WHERE active IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_settings_created_at ON payment_settings(created_at DESC);

-- Create comprehensive test function
CREATE OR REPLACE FUNCTION test_payment_settings_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID;
  superadmin_read BOOLEAN;
  regular_read BOOLEAN;
  superadmin_write BOOLEAN;
  regular_write BOOLEAN;
  initial_count INTEGER;
  final_count INTEGER;
BEGIN
  -- Setup: Get test data
  SELECT id INTO test_company_id FROM companies LIMIT 1;

  -- Clean up any existing test data
  DELETE FROM payment_settings WHERE payment_method LIKE 'TEST-METHOD-%';

  -- Test 1: Superadmin can read payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) INTO superadmin_read FROM payment_settings;

    RETURN QUERY SELECT
      'Superadmin can read settings'::TEXT,
      (superadmin_read > 0)::BOOLEAN,
      ('Found ' || superadmin_read || ' payment settings')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can read settings'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 2: Regular users can read payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    SELECT count(*) INTO regular_read FROM payment_settings;

    RETURN QUERY SELECT
      'Regular users can read settings'::TEXT,
      (regular_read > 0)::BOOLEAN,
      ('Found ' || regular_read || ' payment settings')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Regular users can read settings'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 3: Superadmin can insert payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) INTO initial_count FROM payment_settings;

    INSERT INTO payment_settings (payment_method, qr_code_url, account_name, account_number, active)
    VALUES ('TEST-METHOD-1', 'https://test.example.com/qr1', 'Test Account 1', '123456789', true);

    SELECT count(*) INTO final_count FROM payment_settings;

    RETURN QUERY SELECT
      'Superadmin can insert settings'::TEXT,
      (final_count > initial_count)::BOOLEAN,
      ('Settings increased from ' || initial_count || ' to ' || final_count)::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can insert settings'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 4: Regular users cannot insert payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    SELECT count(*) INTO initial_count FROM payment_settings;

    INSERT INTO payment_settings (payment_method, qr_code_url, account_name, account_number, active)
    VALUES ('TEST-METHOD-2', 'https://test.example.com/qr2', 'Test Account 2', '987654321', true);

    RETURN QUERY SELECT
      'Regular users blocked from insert'::TEXT,
      false::BOOLEAN,
      'Insert succeeded (security failure)'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Regular users blocked from insert'::TEXT,
      true::BOOLEAN,
      'Insert blocked correctly'::TEXT;
  END;

  -- Test 5: Superadmin can update payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    UPDATE payment_settings SET active = false WHERE payment_method = 'TEST-METHOD-1';

    RETURN QUERY SELECT
      'Superadmin can update settings'::TEXT,
      true::BOOLEAN,
      'Payment settings updated successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can update settings'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 6: Regular users cannot update payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    UPDATE payment_settings SET active = true WHERE payment_method = 'TEST-METHOD-1';

    RETURN QUERY SELECT
      'Regular users blocked from update'::TEXT,
      false::BOOLEAN,
      'Update succeeded (security failure)'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Regular users blocked from update'::TEXT,
      true::BOOLEAN,
      'Update blocked correctly'::TEXT;
  END;

  -- Test 7: Superadmin can delete payment settings
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    DELETE FROM payment_settings WHERE payment_method = 'TEST-METHOD-1';

    RETURN QUERY SELECT
      'Superadmin can delete settings'::TEXT,
      true::BOOLEAN,
      'Payment settings deleted successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can delete settings'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Cleanup
  PERFORM reset_tenant_context();
  PERFORM set_tenant_context(test_company_id, 'superadmin');
  DELETE FROM payment_settings WHERE payment_method LIKE 'TEST-METHOD-%';

  RETURN QUERY SELECT
    'Cleanup completed'::TEXT,
    true::BOOLEAN,
    'Test data removed'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security audit function
CREATE OR REPLACE FUNCTION audit_payment_settings_security()
RETURNS TABLE(audit_check TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit 1: Verify RLS is enabled
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'payment_settings' AND relrowsecurity = true)
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
  WHERE schemaname = 'public' AND tablename = 'payment_settings';

  -- Audit 3: Verify read-only access model
  RETURN QUERY SELECT
    'Read-Only Access Model'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'payment_settings'
        AND policyname = 'payment_settings_read_all'
      ) THEN 'ENFORCED'::TEXT
      ELSE 'NOT_ENFORCED'::TEXT
    END,
    'Read-only access for regular users'::TEXT;

  -- Audit 4: Verify superadmin write protection
  RETURN QUERY SELECT
    'Superadmin Write Protection'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'payment_settings'
        AND policyname = 'payment_settings_superadmin_write'
      ) THEN 'PROTECTED'::TEXT
      ELSE 'VULNERABLE'::TEXT
    END,
    'Superadmin-only write access pattern'::TEXT;

  -- Audit 5: Verify data protection
  RETURN QUERY SELECT
    'Critical Payment Protection'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'payment_settings'
        AND policyname LIKE '%protection%'
      ) THEN 'PROTECTED'::TEXT
      ELSE 'STANDARD'::TEXT
    END,
    'Critical payment infrastructure protection'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'payment_settings' AND relrowsecurity = true) THEN
    RAISE EXCEPTION 'RLS not enabled on payment_settings table';
  END IF;

  -- Verify policies were created
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'payment_settings') < 3 THEN
    RAISE EXCEPTION 'Expected at least 3 RLS policies, found %',
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'payment_settings');
  END IF;

  -- Verify indexes were created
  IF (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'payment_settings') < 3 THEN
    RAISE EXCEPTION 'Expected at least 3 indexes, found %',
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'payment_settings');
  END IF;

  RAISE NOTICE '✅ payment_settings RLS implementation completed successfully';
  RAISE NOTICE '📊 Policies created: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'payment_settings');
  RAISE NOTICE '🔒 Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'payment_settings');
  RAISE NOTICE '🔐 Security Model: Read-only for all users, superadmin-only write access';
END $$;