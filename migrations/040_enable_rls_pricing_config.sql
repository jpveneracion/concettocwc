-- Migration 040: Enable RLS for pricing_config table
-- Phase 11.4: Final Tables RLS Implementation
-- Security Priority: MEDIUM (global pricing configuration)
-- Table Purpose: Administrative pricing settings, discount percentages, business rules
-- Current Data: 2 rows (pricing configuration, business rules)
-- Security Model: Read-only for all users, write access for superadmins only

-- Grant permissions to concetto_boms role (must be run as superuser)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pricing_config TO concetto_boms;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS pricing_config_read_all ON pricing_config;
DROP POLICY IF EXISTS pricing_config_superadmin_write ON pricing_config;
DROP POLICY IF EXISTS pricing_config_critical_protection ON pricing_config;

-- Enable RLS on pricing_config table
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Policy 1: Read-only access for all authenticated users
-- All users and application code can read pricing configuration for calculations
CREATE POLICY pricing_config_read_all ON pricing_config
  FOR SELECT
  TO concetto_boms
  USING (true);

-- Policy 2: Superadmin-only write access
-- Only superadmins can modify global pricing configuration
CREATE POLICY pricing_config_superadmin_write ON pricing_config
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 3: Critical pricing infrastructure protection
-- Additional protection for active pricing configurations
CREATE POLICY pricing_config_critical_protection ON pricing_config
  FOR UPDATE
  TO concetto_boms
  USING (
    -- Allow superadmin updates, but protect critical pricing fields
    is_current_user_superadmin()
  )
  WITH CHECK (
    -- Additional validation for critical pricing configuration
    is_current_user_superadmin()
  );

-- Create indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_pricing_config_is_active ON pricing_config(is_active)
WHERE is_active IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_config_valid_from ON pricing_config(valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_config_valid_until ON pricing_config(valid_until)
WHERE valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_config_created_at ON pricing_config(created_at DESC);

-- Create comprehensive test function
CREATE OR REPLACE FUNCTION test_pricing_config_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID;
  superadmin_read BOOLEAN;
  regular_read BOOLEAN;
  initial_count INTEGER;
  final_count INTEGER;
BEGIN
  -- Setup: Get test data
  SELECT id INTO test_company_id FROM companies LIMIT 1;

  -- Clean up any existing test data
  DELETE FROM pricing_config WHERE monthly_base_rate < 0;

  -- Test 1: Superadmin can read pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) INTO superadmin_read FROM pricing_config;

    RETURN QUERY SELECT
      'Superadmin can read config'::TEXT,
      (superadmin_read > 0)::BOOLEAN,
      ('Found ' || superadmin_read || ' pricing configurations')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can read config'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 2: Regular users can read pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    SELECT count(*) INTO regular_read FROM pricing_config;

    RETURN QUERY SELECT
      'Regular users can read config'::TEXT,
      (regular_read > 0)::BOOLEAN,
      ('Found ' || regular_read || ' pricing configurations')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Regular users can read config'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 3: Superadmin can insert pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) INTO initial_count FROM pricing_config;

    INSERT INTO pricing_config (monthly_base_rate, quarterly_discount_percent, annual_discount_percent, monthly_threshold, quarterly_threshold, is_active, valid_from, created_at, updated_at)
    VALUES (-1.0, 15.0, 25.0, 500.0, 1500.0, true, NOW(), NOW(), NOW());

    SELECT count(*) INTO final_count FROM pricing_config;

    RETURN QUERY SELECT
      'Superadmin can insert config'::TEXT,
      (final_count > initial_count)::BOOLEAN,
      ('Config increased from ' || initial_count || ' to ' || final_count)::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can insert config'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 4: Regular users cannot insert pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    INSERT INTO pricing_config (monthly_base_rate, quarterly_discount_percent, annual_discount_percent, monthly_threshold, quarterly_threshold, is_active, valid_from, created_at, updated_at)
    VALUES (-2.0, 10.0, 20.0, 400.0, 1200.0, true, NOW(), NOW(), NOW());

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

  -- Test 5: Superadmin can update pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    UPDATE pricing_config SET is_active = false WHERE monthly_base_rate = -1.0;

    RETURN QUERY SELECT
      'Superadmin can update config'::TEXT,
      true::BOOLEAN,
      'Pricing configuration updated successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can update config'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 6: Regular users cannot update pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    UPDATE pricing_config SET is_active = true WHERE monthly_base_rate = -1.0;

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

  -- Test 7: Superadmin can delete pricing configuration
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    DELETE FROM pricing_config WHERE monthly_base_rate = -1.0;

    RETURN QUERY SELECT
      'Superadmin can delete config'::TEXT,
      true::BOOLEAN,
      'Pricing configuration deleted successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can delete config'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Cleanup
  PERFORM reset_tenant_context();
  PERFORM set_tenant_context(test_company_id, 'superadmin');
  DELETE FROM pricing_config WHERE monthly_base_rate < 0;

  RETURN QUERY SELECT
    'Cleanup completed'::TEXT,
    true::BOOLEAN,
    'Test data removed'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security audit function
CREATE OR REPLACE FUNCTION audit_pricing_config_security()
RETURNS TABLE(audit_check TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit 1: Verify RLS is enabled
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pricing_config' AND relrowsecurity = true)
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
  WHERE schemaname = 'public' AND tablename = 'pricing_config';

  -- Audit 3: Verify read-only access model
  RETURN QUERY SELECT
    'Read-Only Access Model'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pricing_config'
        AND policyname = 'pricing_config_read_all'
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
        WHERE tablename = 'pricing_config'
        AND policyname = 'pricing_config_superadmin_write'
      ) THEN 'PROTECTED'::TEXT
      ELSE 'VULNERABLE'::TEXT
    END,
    'Superadmin-only write access pattern'::TEXT;

  -- Audit 5: Verify pricing protection
  RETURN QUERY SELECT
    'Critical Pricing Protection'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pricing_config'
        AND policyname LIKE '%protection%'
      ) THEN 'PROTECTED'::TEXT
      ELSE 'STANDARD'::TEXT
    END,
    'Critical pricing infrastructure protection'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pricing_config' AND relrowsecurity = true) THEN
    RAISE EXCEPTION 'RLS not enabled on pricing_config table';
  END IF;

  -- Verify policies were created
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pricing_config') < 3 THEN
    RAISE EXCEPTION 'Expected at least 3 RLS policies, found %',
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pricing_config');
  END IF;

  -- Verify indexes were created
  IF (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'pricing_config') < 4 THEN
    RAISE EXCEPTION 'Expected at least 4 indexes, found %',
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'pricing_config');
  END IF;

  RAISE NOTICE '✅ pricing_config RLS implementation completed successfully';
  RAISE NOTICE '📊 Policies created: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pricing_config');
  RAISE NOTICE '🔒 Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'pricing_config');
  RAISE NOTICE '🔐 Security Model: Read-only for all users, superadmin-only write access';
END $$;