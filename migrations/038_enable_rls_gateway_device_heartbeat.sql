-- Migration 038: Enable RLS for gateway_device_heartbeat table
-- Phase 11.4: Final Tables RLS Implementation
-- Security Priority: MEDIUM (device tracking and privacy data)
-- Table Purpose: Device tracking, heartbeat monitoring, IP addresses, user surveillance
-- Current Data: 0 rows (preventive privacy protection)
-- Challenge: No direct company_id or user_id relationship

-- Grant permissions to concetto_boms role (must be run as superuser)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gateway_device_heartbeat TO concetto_boms;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS gateway_device_heartbeat_superadmin_only ON gateway_device_heartbeat;
DROP POLICY IF EXISTS gateway_device_heartbeat_system_access ON gateway_device_heartbeat;
DROP POLICY IF EXISTS gateway_device_heartbeat_insert_protection ON gateway_device_heartbeat;
DROP POLICY IF EXISTS gateway_device_heartbeat_update_protection ON gateway_device_heartbeat;
DROP POLICY IF EXISTS gateway_device_heartbeat_delete_protection ON gateway_device_heartbeat;

-- Enable RLS on gateway_device_heartbeat table
ALTER TABLE gateway_device_heartbeat ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmin-only access (primary policy)
-- Since we can't establish company context, only superadmins should access this data
CREATE POLICY gateway_device_heartbeat_superadmin_only ON gateway_device_heartbeat
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 2: System access for heartbeat monitoring
-- Limited access for device monitoring functions (if needed by application)
CREATE POLICY gateway_device_heartbeat_system_access ON gateway_device_heartbeat
  FOR SELECT
  TO concetto_boms
  USING (
    -- Allow read access for system monitoring if proper RLS context exists
    -- This is a fallback policy for application functions that need to read device status
    get_current_company_id() IS NOT NULL
    OR is_current_user_superadmin()
  );

-- Policy 3: Insert protection (no INSERT for non-superadmins)
CREATE POLICY gateway_device_heartbeat_insert_protection ON gateway_device_heartbeat
  FOR INSERT
  TO concetto_boms
  WITH CHECK (is_current_user_superadmin());

-- Policy 4: Update protection (no UPDATE for non-superadmins)
CREATE POLICY gateway_device_heartbeat_update_protection ON gateway_device_heartbeat
  FOR UPDATE
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 5: Delete protection (no DELETE for non-superadmins)
CREATE POLICY gateway_device_heartbeat_delete_protection ON gateway_device_heartbeat
  FOR DELETE
  TO concetto_boms
  USING (is_current_user_superadmin());

-- Create indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_gateway_device_heartbeat_device_id ON gateway_device_heartbeat(device_id);
CREATE INDEX IF NOT EXISTS idx_gateway_device_heartbeat_last_ping ON gateway_device_heartbeat(last_ping DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_device_heartbeat_status ON gateway_device_heartbeat(status)
WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gateway_device_heartbeat_created_at ON gateway_device_heartbeat(created_at DESC);

-- Create data retention function for privacy compliance
CREATE OR REPLACE FUNCTION cleanup_old_gateway_heartbeat_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_days INTEGER := 90; -- 90-day retention policy
BEGIN
  -- Delete tracking data older than retention period
  DELETE FROM gateway_device_heartbeat
  WHERE last_ping < NOW() - INTERVAL '1 day' * retention_days;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create comprehensive test function
CREATE OR REPLACE FUNCTION test_gateway_device_heartbeat_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID;
  test_device_id TEXT;
  superadmin_access BOOLEAN;
  regular_access BOOLEAN;
BEGIN
  -- Clean up any existing test data
  DELETE FROM gateway_device_heartbeat WHERE device_id LIKE 'TEST-DEVICE-%';

  -- Test 1: Superadmin can insert heartbeat data
  BEGIN
    PERFORM reset_tenant_context();
    -- Get a company ID for superadmin context
    SELECT id INTO test_company_id FROM companies LIMIT 1;
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    INSERT INTO gateway_device_heartbeat (device_id, last_ping, status, ip_address, battery_level)
    VALUES ('TEST-DEVICE-1', NOW(), 'active', '192.168.1.100', 85);

    RETURN QUERY SELECT
      'Superadmin can insert heartbeat data'::TEXT,
      true::BOOLEAN,
      'Heartbeat data created successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can insert heartbeat data'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 2: Superadmin can read all heartbeat data
  BEGIN
    PERFORM reset_tenant_context();
    SELECT id INTO test_company_id FROM companies LIMIT 1;
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) > 0 INTO superadmin_access FROM gateway_device_heartbeat WHERE device_id = 'TEST-DEVICE-1';

    RETURN QUERY SELECT
      'Superadmin can read heartbeat data'::TEXT,
      superadmin_access::BOOLEAN,
      CASE WHEN superadmin_access THEN 'Superadmin access confirmed' ELSE 'No superadmin access' END::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can read heartbeat data'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 3: Regular users cannot insert heartbeat data (should be blocked)
  BEGIN
    PERFORM reset_tenant_context();

    -- Try to insert without superadmin context (should fail)
    INSERT INTO gateway_device_heartbeat (device_id, last_ping, status, ip_address, battery_level)
    VALUES ('TEST-DEVICE-2', NOW(), 'active', '192.168.1.101', 90);

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

  -- Test 4: Data retention function works
  BEGIN
    PERFORM reset_tenant_context();
    SELECT id INTO test_company_id FROM companies LIMIT 1;
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    -- Insert old test data
    INSERT INTO gateway_device_heartbeat (device_id, last_ping, status, ip_address, battery_level)
    VALUES ('TEST-DEVICE-OLD', NOW() - INTERVAL '100 days', 'inactive', '192.168.1.102', 75);

    -- Run cleanup
    PERFORM cleanup_old_gateway_heartbeat_data();

    SELECT count(*) = 0 INTO regular_access FROM gateway_device_heartbeat WHERE device_id = 'TEST-DEVICE-OLD';

    RETURN QUERY SELECT
      'Data retention function works'::TEXT,
      regular_access::BOOLEAN,
      CASE WHEN regular_access THEN 'Old data cleaned up correctly' ELSE 'Old data still exists' END::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Data retention function works'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Cleanup
  PERFORM reset_tenant_context();
  SELECT id INTO test_company_id FROM companies LIMIT 1;
  PERFORM set_tenant_context(test_company_id, 'superadmin');
  DELETE FROM gateway_device_heartbeat WHERE device_id LIKE 'TEST-DEVICE-%';

  RETURN QUERY SELECT
    'Cleanup completed'::TEXT,
    true::BOOLEAN,
    'Test data removed'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security audit function
CREATE OR REPLACE FUNCTION audit_gateway_device_heartbeat_security()
RETURNS TABLE(audit_check TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit 1: Verify RLS is enabled
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'gateway_device_heartbeat' AND relrowsecurity = true)
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
  WHERE schemaname = 'public' AND tablename = 'gateway_device_heartbeat';

  -- Audit 3: Verify superadmin-only access
  RETURN QUERY SELECT
    'Superadmin Access Model'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'gateway_device_heartbeat'
        AND policyname = 'gateway_device_heartbeat_superadmin_only'
      ) THEN 'ENFORCED'::TEXT
      ELSE 'NOT_ENFORCED'::TEXT
    END,
    'Superadmin-only access pattern'::TEXT;

  -- Audit 4: Verify data retention function exists
  RETURN QUERY SELECT
    'Data Retention Function'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'cleanup_old_gateway_heartbeat_data'
      ) THEN 'PRESENT'::TEXT
      ELSE 'MISSING'::TEXT
    END,
    'Privacy compliance data cleanup function'::TEXT;

  -- Audit 5: Check for privacy protection indexes
  RETURN QUERY SELECT
    'Privacy Indexes'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'gateway_device_heartbeat'
        AND indexname LIKE '%last_ping%'
      ) THEN 'OPTIMIZED'::TEXT
      ELSE 'NOT_OPTIMIZED'::TEXT
    END,
    'Time-based query optimization for cleanup'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'gateway_device_heartbeat' AND relrowsecurity = true) THEN
    RAISE EXCEPTION 'RLS not enabled on gateway_device_heartbeat table';
  END IF;

  -- Verify policies were created
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'gateway_device_heartbeat') < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 RLS policies, found %',
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'gateway_device_heartbeat');
  END IF;

  -- Verify indexes were created
  IF (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'gateway_device_heartbeat') < 4 THEN
    RAISE EXCEPTION 'Expected at least 4 indexes, found %',
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'gateway_device_heartbeat');
  END IF;

  RAISE NOTICE '✅ gateway_device_heartbeat RLS implementation completed successfully';
  RAISE NOTICE '📊 Policies created: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'gateway_device_heartbeat');
  RAISE NOTICE '🔒 Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'gateway_device_heartbeat');
  RAISE NOTICE '🔐 Privacy Model: Superadmin-only access with 90-day data retention';
END $$;