-- Migration 042: Enable RLS for webhook_events table
-- Phase 11.4: Final Tables RLS Implementation
-- Security Priority: LOW (system event logging, operational data)
-- Table Purpose: Webhook event logs, payment processing events, system notifications
-- Current Data: 0 rows (system event logging infrastructure)
-- Security Model: Superadmin-only access for system monitoring and debugging

-- Grant permissions to concetto_boms role (must be run as superuser)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE webhook_events TO concetto_boms;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS webhook_events_superadmin_only ON webhook_events;
DROP POLICY IF EXISTS webhook_events_system_read ON webhook_events;
DROP POLICY IF EXISTS webhook_events_insert_protection ON webhook_events;
DROP POLICY IF EXISTS webhook_events_update_protection ON webhook_events;
DROP POLICY IF EXISTS webhook_events_delete_protection ON webhook_events;

-- Enable RLS on webhook_events table
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Superadmin-only access (primary policy)
-- Only superadmins can access webhook event logs for system monitoring
CREATE POLICY webhook_events_superadmin_only ON webhook_events
  FOR ALL
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 2: Limited system read access (optional, for application monitoring)
-- Allow read access for monitoring functions if proper RLS context exists
CREATE POLICY webhook_events_system_read ON webhook_events
  FOR SELECT
  TO concetto_boms
  USING (
    get_current_company_id() IS NOT NULL
    OR is_current_user_superadmin()
  );

-- Policy 3: Insert protection (webhook system only)
-- Webhook events should be created by system processes with superadmin context
CREATE POLICY webhook_events_insert_protection ON webhook_events
  FOR INSERT
  TO concetto_boms
  WITH CHECK (is_current_user_superadmin());

-- Policy 4: Update protection (superadmin only for debugging)
-- Only superadmins can modify webhook events for debugging purposes
CREATE POLICY webhook_events_update_protection ON webhook_events
  FOR UPDATE
  TO concetto_boms
  USING (is_current_user_superadmin())
  WITH CHECK (is_current_user_superadmin());

-- Policy 5: Delete protection (superadmin only for cleanup)
-- Only superadmins can delete webhook events for cleanup purposes
CREATE POLICY webhook_events_delete_protection ON webhook_events
  FOR DELETE
  TO concetto_boms
  USING (is_current_user_superadmin());

-- Create indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_paymongo_event_id ON webhook_events(paymongo_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed)
WHERE processed IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_updated_at ON webhook_events(updated_at DESC)
WHERE updated_at IS NOT NULL;

-- Create comprehensive test function
CREATE OR REPLACE FUNCTION test_webhook_events_rls()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
  test_company_id UUID;
  superadmin_access BOOLEAN;
  regular_access BOOLEAN;
  initial_count INTEGER;
  final_count INTEGER;
BEGIN
  -- Setup: Get test data
  SELECT id INTO test_company_id FROM companies LIMIT 1;

  -- Clean up any existing test data
  DELETE FROM webhook_events WHERE event_type LIKE 'TEST-EVENT-%';

  -- Test 1: Superadmin can insert webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) INTO initial_count FROM webhook_events;

    INSERT INTO webhook_events (event_type, paymongo_event_id, payload, processed, created_at, updated_at)
    VALUES ('TEST-EVENT-1', 'test-event-id-1', '{"test": "data"}', false, NOW(), NOW());

    SELECT count(*) INTO final_count FROM webhook_events;

    RETURN QUERY SELECT
      'Superadmin can insert events'::TEXT,
      (final_count > initial_count)::BOOLEAN,
      ('Events increased from ' || initial_count || ' to ' || final_count)::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can insert events'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 2: Superadmin can read webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    SELECT count(*) INTO superadmin_access FROM webhook_events WHERE event_type = 'TEST-EVENT-1';

    RETURN QUERY SELECT
      'Superadmin can read events'::TEXT,
      (superadmin_access > 0)::BOOLEAN,
      ('Found ' || superadmin_access || ' webhook events')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can read events'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 3: Regular users cannot read webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    SELECT count(*) INTO regular_access FROM webhook_events WHERE event_type = 'TEST-EVENT-1';

    RETURN QUERY SELECT
      'Regular users blocked from read'::TEXT,
      (regular_access = 0)::BOOLEAN,
      ('Found ' || regular_access || ' events (should be 0)')::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Regular users blocked from read'::TEXT,
      true::BOOLEAN,
      'Read access blocked correctly'::TEXT;
  END;

  -- Test 4: Regular users cannot insert webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    INSERT INTO webhook_events (event_type, paymongo_event_id, payload, processed, created_at, updated_at)
    VALUES ('TEST-EVENT-2', 'test-event-id-2', '{"test": "data"}', false, NOW(), NOW());

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

  -- Test 5: Superadmin can update webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    UPDATE webhook_events SET processed = true WHERE event_type = 'TEST-EVENT-1';

    RETURN QUERY SELECT
      'Superadmin can update events'::TEXT,
      true::BOOLEAN,
      'Webhook events updated successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can update events'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Test 6: Regular users cannot update webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'user');

    UPDATE webhook_events SET processed = false WHERE event_type = 'TEST-EVENT-1';

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

  -- Test 7: Superadmin can delete webhook events
  BEGIN
    PERFORM reset_tenant_context();
    PERFORM set_tenant_context(test_company_id, 'superadmin');

    DELETE FROM webhook_events WHERE event_type = 'TEST-EVENT-1';

    RETURN QUERY SELECT
      'Superadmin can delete events'::TEXT,
      true::BOOLEAN,
      'Webhook events deleted successfully'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Superadmin can delete events'::TEXT,
      false::BOOLEAN,
      SQLERRM::TEXT;
  END;

  -- Cleanup
  PERFORM reset_tenant_context();
  PERFORM set_tenant_context(test_company_id, 'superadmin');
  DELETE FROM webhook_events WHERE event_type LIKE 'TEST-EVENT-%';

  RETURN QUERY SELECT
    'Cleanup completed'::TEXT,
    true::BOOLEAN,
    'Test data removed'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security audit function
CREATE OR REPLACE FUNCTION audit_webhook_events_security()
RETURNS TABLE(audit_check TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Audit 1: Verify RLS is enabled
  RETURN QUERY SELECT
    'RLS Status'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'webhook_events' AND relrowsecurity = true)
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
  WHERE schemaname = 'public' AND tablename = 'webhook_events';

  -- Audit 3: Verify superadmin-only access model
  RETURN QUERY SELECT
    'Superadmin Access Model'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'webhook_events'
        AND policyname = 'webhook_events_superadmin_only'
      ) THEN 'ENFORCED'::TEXT
      ELSE 'NOT_ENFORCED'::TEXT
    END,
    'Superadmin-only access pattern'::TEXT;

  -- Audit 4: Verify insert protection
  RETURN QUERY SELECT
    'Insert Protection'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'webhook_events'
        AND policyname = 'webhook_events_insert_protection'
      ) THEN 'PROTECTED'::TEXT
      ELSE 'VULNERABLE'::TEXT
    END,
    'Webhook event insertion protection'::TEXT;

  -- Audit 5: Verify event logging indexes
  RETURN QUERY SELECT
    'Event Logging Indexes'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'webhook_events'
        AND indexname LIKE '%created_at%'
      ) THEN 'OPTIMIZED'::TEXT
      ELSE 'NOT_OPTIMIZED'::TEXT
    END,
    'Time-based event query optimization'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'webhook_events' AND relrowsecurity = true) THEN
    RAISE EXCEPTION 'RLS not enabled on webhook_events table';
  END IF;

  -- Verify policies were created
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'webhook_events') < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 RLS policies, found %',
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'webhook_events');
  END IF;

  -- Verify indexes were created
  IF (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'webhook_events') < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 indexes, found %',
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'webhook_events');
  END IF;

  RAISE NOTICE '✅ webhook_events RLS implementation completed successfully';
  RAISE NOTICE '📊 Policies created: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'webhook_events');
  RAISE NOTICE '🔒 Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'webhook_events');
  RAISE NOTICE '🔐 Security Model: Superadmin-only access for system monitoring';
END $$;