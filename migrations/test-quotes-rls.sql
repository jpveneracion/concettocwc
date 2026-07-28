-- migrations/test-quotes-rls.sql
-- Policy Testing Utilities for Quotes RLS Implementation
--
-- This file provides comprehensive testing utilities for validating that
-- Row-Level Security policies work correctly for the quotes table.
--
-- Usage:
-- 1. Run this file to create test data and testing functions
-- 2. Execute the test functions to validate RLS policies
-- 3. Use the cleanup functions to remove test data
-- 4. Roll back changes using the provided procedures

-- ============================================================================
-- TEST DATA SETUP
-- ============================================================================

/**
 * Create test companies for RLS testing
 */
DO $$
DECLARE
  company_a_id UUID;
  company_b_id UUID;
  company_c_id UUID;
BEGIN
  -- Create test companies
  INSERT INTO companies (id, name, code, slug, minimum_area_sqft)
  VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Company A', 'TEST-A', 'test-a', 10),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Company B', 'TEST-B', 'test-b', 15),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test Company C', 'TEST-C', 'test-c', 20)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test companies created successfully';
END $$;

/**
 * Create test users with different roles for RLS testing
 */
DO $$
BEGIN
  -- Create test users (assuming users table exists with company_id and role fields)
  -- Adjust column names based on actual schema

  INSERT INTO users (id, email, name, company_id, role)
  VALUES
    ('11111111-1111-1111-1111-111111111111', 'user-a@test.com', 'User A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user'),
    ('22222222-2222-2222-2222-222222222222', 'admin-a@test.com', 'Admin A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
    ('33333333-3333-3333-3333-333333333333', 'user-b@test.com', 'User B', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user'),
    ('44444444-4444-4444-4444-444444444444', 'superadmin@test.com', 'Superadmin', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'superadmin')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test users created successfully';
END $$;

/**
 * Create test quotes for RLS testing
 */
DO $$
DECLARE
  quote_id UUID;
BEGIN
  -- Create quotes for Company A
  FOR i IN 1..3 LOOP
    INSERT INTO quotes (
      company_id, quote_number, customer_name, customer_address,
      customer_name_encrypted, customer_address_encrypted,
      quote_date, our_ref, installation_fee, delivery_fee,
      subtotal, total, total_area, panel_count, status
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'TEST-A-' || LPAD(i::TEXT, 3, '0'),
      'Company A Customer ' || i,
      'Address A' || i,
      pgp_sym_encrypt('Company A Customer ' || i, 'encryption_key'),
      pgp_sym_encrypt('Address A' || i, 'encryption_key'),
      CURRENT_DATE,
      'REF-A-' || i,
      100 * i, 50 * i,
      1000 * i, 1150 * i,
      100 * i, 5 * i,
      CASE WHEN i % 2 = 0 THEN 'sent' ELSE 'draft' END
    );
  END LOOP;

  -- Create quotes for Company B
  FOR i IN 1..2 LOOP
    INSERT INTO quotes (
      company_id, quote_number, customer_name, customer_address,
      customer_name_encrypted, customer_address_encrypted,
      quote_date, our_ref, installation_fee, delivery_fee,
      subtotal, total, total_area, panel_count, status
    ) VALUES (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'TEST-B-' || LPAD(i::TEXT, 3, '0'),
      'Company B Customer ' || i,
      'Address B' || i,
      pgp_sym_encrypt('Company B Customer ' || i, 'encryption_key'),
      pgp_sym_encrypt('Address B' || i, 'encryption_key'),
      CURRENT_DATE,
      'REF-B-' || i,
      200 * i, 75 * i,
      2000 * i, 2150 * i,
      150 * i, 7 * i,
      'draft'
    );
  END LOOP;

  -- Create quotes for Company C
  FOR i IN 1..1 LOOP
    INSERT INTO quotes (
      company_id, quote_number, customer_name, customer_address,
      customer_name_encrypted, customer_address_encrypted,
      quote_date, our_ref, installation_fee, delivery_fee,
      subtotal, total, total_area, panel_count, status
    ) VALUES (
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'TEST-C-' || LPAD(i::TEXT, 3, '0'),
      'Company C Customer ' || i,
      'Address C' || i,
      pgp_sym_encrypt('Company C Customer ' || i, 'encryption_key'),
      pgp_sym_encrypt('Address C' || i, 'encryption_key'),
      CURRENT_DATE,
      'REF-C-' || i,
      300 * i, 100 * i,
      3000 * i, 3150 * i,
      200 * i, 10 * i,
      'sent'
    );
  END LOOP;

  RAISE NOTICE 'Test quotes created successfully';
END $$;

-- ============================================================================
-- RLS POLICY VALIDATION FUNCTIONS
-- ============================================================================

/**
 * Validate tenant isolation policy
 * Tests that users can only access their own company's quotes
 */
CREATE OR REPLACE FUNCTION validate_quotes_tenant_isolation()
RETURNS TABLE(
  test_description TEXT,
  expected_result INTEGER,
  actual_result INTEGER,
  passed BOOLEAN
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  test_result RECORD;
BEGIN
  -- Test 1: Company A user should see only Company A quotes
  PERFORM set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user');

  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'Company A user should see only Company A quotes'::TEXT,
    3::INTEGER,
    actual_result,
    (actual_result = 3)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 2: Company B user should see only Company B quotes
  PERFORM set_tenant_context('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user');

  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'Company B user should see only Company B quotes'::TEXT,
    2::INTEGER,
    actual_result,
    (actual_result = 2)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 3: No context should return 0 quotes (fail-secure)
  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'No context should return 0 quotes (fail-secure)'::TEXT,
    0::INTEGER,
    actual_result,
    (actual_result = 0)::BOOLEAN;

  RETURN;
END;
$$;

/**
 * Validate admin access policy
 * Tests that admins can access all quotes within their company
 */
CREATE OR REPLACE FUNCTION validate_quotes_admin_access()
RETURNS TABLE(
  test_description TEXT,
  expected_result INTEGER,
  actual_result INTEGER,
  passed BOOLEAN
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  actual_result INTEGER;
BEGIN
  -- Test 1: Company A admin should see all Company A quotes
  PERFORM set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'Company A admin should see all Company A quotes'::TEXT,
    3::INTEGER,
    actual_result,
    (actual_result = 3)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 2: Company A admin should not see Company B quotes
  PERFORM set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE company_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'Company A admin should not see Company B quotes'::TEXT,
    0::INTEGER,
    actual_result,
    (actual_result = 0)::BOOLEAN;

  PERFORM reset_tenant_context();

  RETURN;
END;
$$;

/**
 * Validate superadmin access policy
 * Tests that superadmins can access quotes from all companies
 */
CREATE OR REPLACE FUNCTION validate_quotes_superadmin_access()
RETURNS TABLE(
  test_description TEXT,
  expected_result INTEGER,
  actual_result INTEGER,
  passed BOOLEAN
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  actual_result INTEGER;
BEGIN
  -- Test 1: Superadmin should see all test quotes
  PERFORM set_tenant_context('00000000-0000-0000-0000-000000000000', 'superadmin');

  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'Superadmin should see all test quotes'::TEXT,
    6::INTEGER, -- 3 from A, 2 from B, 1 from C
    actual_result,
    (actual_result = 6)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 2: Superadmin should see Company A quotes
  PERFORM set_tenant_context('00000000-0000-0000-0000-000000000000', 'superadmin');

  SELECT COUNT(*) INTO actual_result
  FROM quotes
  WHERE company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND quote_number LIKE 'TEST-%';

  RETURN QUERY SELECT
    'Superadmin should see Company A quotes'::TEXT,
    3::INTEGER,
    actual_result,
    (actual_result = 3)::BOOLEAN;

  PERFORM reset_tenant_context();

  RETURN;
END;
$$;

/**
 * Validate write protection policies
 * Tests that cross-company modifications are prevented
 */
CREATE OR REPLACE FUNCTION validate_quotes_write_protection()
RETURNS TABLE(
  test_description TEXT,
  expected_result BOOLEAN,
  actual_result BOOLEAN,
  passed BOOLEAN
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  update_result RECORD;
  delete_result RECORD;
  test_quote_id UUID;
BEGIN
  -- Get a test quote ID from Company A
  SELECT id INTO test_quote_id
  FROM quotes
  WHERE company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND quote_number LIKE 'TEST-A-%'
  LIMIT 1;

  -- Test 1: Company B user should not update Company A quote
  PERFORM set_tenant_context('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user');

  UPDATE quotes
  SET status = 'delivered', updated_at = NOW()
  WHERE id = test_quote_id
  RETURNING id INTO update_result;

  RETURN QUERY SELECT
    'Company B user should not update Company A quote'::TEXT,
    false::BOOLEAN,
    (update_result IS NOT NULL)::BOOLEAN,
    (update_result IS NULL)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 2: Company B user should not delete Company A quote
  PERFORM set_tenant_context('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user');

  DELETE FROM quotes
  WHERE id = test_quote_id
  RETURNING id INTO delete_result;

  RETURN QUERY SELECT
    'Company B user should not delete Company A quote'::TEXT,
    false::BOOLEAN,
    (delete_result IS NOT NULL)::BOOLEAN,
    (delete_result IS NULL)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 3: Superadmin should update any company quote
  PERFORM set_tenant_context('00000000-0000-0000-0000-000000000000', 'superadmin');

  UPDATE quotes
  SET status = 'sent', updated_at = NOW()
  WHERE id = test_quote_id
  RETURNING id INTO update_result;

  RETURN QUERY SELECT
    'Superadmin should update any company quote'::TEXT,
    true::BOOLEAN,
    (update_result IS NOT NULL)::BOOLEAN,
    (update_result IS NOT NULL)::BOOLEAN;

  PERFORM reset_tenant_context();

  RETURN;
END;
$$;

/**
 * Comprehensive RLS policy validation test suite
 * Runs all validation tests and returns comprehensive results
 */
CREATE OR REPLACE FUNCTION test_quotes_rls_comprehensive()
RETURNS TABLE(
  test_category TEXT,
  test_description TEXT,
  expected_result TEXT,
  actual_result TEXT,
  passed BOOLEAN,
  notes TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Run tenant isolation tests
  RETURN QUERY
  SELECT
    'tenant_isolation'::TEXT,
    test_description,
    expected_result::TEXT,
    actual_result::TEXT,
    passed,
    'User should only access own company data'::TEXT
  FROM validate_quotes_tenant_isolation();

  -- Run admin access tests
  RETURN QUERY
  SELECT
    'admin_access'::TEXT,
    test_description,
    expected_result::TEXT,
    actual_result::TEXT,
    passed,
    'Admin should access all company data'::TEXT
  FROM validate_quotes_admin_access();

  -- Run superadmin access tests
  RETURN QUERY
  SELECT
    'superadmin_access'::TEXT,
    test_description,
    expected_result::TEXT,
    actual_result::TEXT,
    passed,
    'Superadmin should access all data'::TEXT
  FROM validate_quotes_superadmin_access();

  -- Run write protection tests
  RETURN QUERY
  SELECT
    'write_protection'::TEXT,
    test_description,
    expected_result::TEXT,
    actual_result::TEXT,
    passed,
    'Cross-company writes should be blocked'::TEXT
  FROM validate_quotes_write_protection();

  RETURN;
END;
$$;

-- ============================================================================
-- PERFORMANCE TESTING FUNCTIONS
-- ============================================================================

/**
 * Test RLS policy performance impact
 * Measures query execution times with RLS enabled
 */
CREATE OR REPLACE FUNCTION test_quotes_rls_performance()
RETURNS TABLE(
  query_type TEXT,
  execution_time_ms NUMERIC,
  acceptable BOOLEAN
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  execution_time NUMERIC;
  result RECORD;
BEGIN
  -- Test 1: Simple SELECT performance
  PERFORM set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user');

  start_time := clock_timestamp();
  FOR result IN
    SELECT * FROM quotes WHERE quote_number LIKE 'TEST-%'
  LOOP
    EXIT; -- Just get first row
  END LOOP;
  end_time := clock_timestamp();

  execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

  RETURN QUERY SELECT
    'Simple SELECT'::TEXT,
    execution_time,
    (execution_time < 100)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 2: Complex JOIN performance (if applicable)
  PERFORM set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user');

  start_time := clock_timestamp();
  FOR result IN
    SELECT q.*, qi.count
    FROM quotes q
    LEFT JOIN (
      SELECT quote_id, COUNT(*) as count
      FROM quote_items
      GROUP BY quote_id
    ) qi ON q.id = qi.quote_id
    WHERE q.quote_number LIKE 'TEST-%'
  LOOP
    EXIT; -- Just get first row
  END LOOP;
  end_time := clock_timestamp();

  execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

  RETURN QUERY SELECT
    'Complex JOIN'::TEXT,
    execution_time,
    (execution_time < 500)::BOOLEAN;

  PERFORM reset_tenant_context();

  -- Test 3: UPDATE performance
  PERFORM set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

  start_time := clock_timestamp();
  UPDATE quotes
  SET updated_at = NOW()
  WHERE quote_number LIKE 'TEST-A-001';
  end_time := clock_timestamp();

  execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

  RETURN QUERY SELECT
    'UPDATE query'::TEXT,
    execution_time,
    (execution_time < 100)::BOOLEAN;

  PERFORM reset_tenant_context();

  RETURN;
END;
$$;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

/**
 * Clean up all test quotes
 */
CREATE OR REPLACE FUNCTION cleanup_test_quotes()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use superadmin context to ensure access to all test data
  PERFORM set_tenant_context('00000000-0000-0000-0000-000000000000', 'superadmin');

  DELETE FROM quote_items
  WHERE quote_id IN (
    SELECT id FROM quotes WHERE quote_number LIKE 'TEST-%'
  );

  DELETE FROM quotes
  WHERE quote_number LIKE 'TEST-%';

  PERFORM reset_tenant_context();

  RAISE NOTICE 'Test quotes cleaned up successfully';
END;
$$;

/**
 * Clean up all test data (companies, users, quotes)
 */
CREATE OR REPLACE FUNCTION cleanup_all_test_data()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM cleanup_test_quotes();

  -- Clean up test users
  DELETE FROM users
  WHERE email LIKE '%@test.com';

  -- Clean up test companies
  DELETE FROM companies
  WHERE code LIKE 'TEST-%';

  RAISE NOTICE 'All test data cleaned up successfully';
END;
$$;

-- ============================================================================
-- POLICY INFORMATION FUNCTIONS
-- ============================================================================

/**
 * Get information about all RLS policies on quotes table
 */
CREATE OR REPLACE FUNCTION get_quotes_rls_policy_info()
RETURNS TABLE(
  policy_name TEXT,
  policy_command TEXT,
  using_expression TEXT,
  with_check_expression TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    policyname::TEXT,
    CASE WHEN cmd = 'r' THEN 'SELECT'
         WHEN cmd = 'a' THEN 'INSERT'
         WHEN cmd = 'w' THEN 'UPDATE'
         WHEN cmd = 'd' THEN 'DELETE'
         WHEN cmd = '*' THEN 'ALL'
         ELSE cmd::TEXT
    END::TEXT,
    pg_get_expr(qual, policyrelid)::TEXT,
    pg_get_expr(with_check, policyrelid)::TEXT
  FROM pg_policies
  WHERE tablename = 'quotes'
  ORDER BY policyname;
END;
$$;

-- ============================================================================
-- EXECUTING TESTS
-- ============================================================================

/**
 * Run all tests and provide comprehensive results
 */
CREATE OR REPLACE FUNCTION run_all_quotes_rls_tests()
RETURNS TABLE(
  test_suite TEXT,
  total_tests INTEGER,
  passed_tests INTEGER,
  failed_tests INTEGER,
  success_rate NUMERIC
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INTEGER;
  passed_count INTEGER;
  failed_count INTEGER;
BEGIN
  -- Count total tests
  SELECT COUNT(*) INTO total_count
  FROM test_quotes_rls_comprehensive();

  -- Count passed tests
  SELECT COUNT(*) INTO passed_count
  FROM test_quotes_rls_comprehensive()
  WHERE passed = true;

  -- Calculate failed count
  failed_count := total_count - passed_count;

  -- Calculate success rate
  RETURN QUERY SELECT
    'quotes_rls_comprehensive'::TEXT,
    total_count,
    passed_count,
    failed_count,
    CASE WHEN total_count > 0
         THEN (passed_count::NUMERIC / total_count::NUMERIC) * 100
         ELSE 0
    END::NUMERIC;
END;
$$;

-- ============================================================================
-- USAGE DOCUMENTATION
-- ============================================================================

/*
 * USAGE INSTRUCTIONS:
 *
 * 1. SETUP TEST DATA:
 *    -- Run the entire file to create test data
 *    -- Or run specific sections
 *
 * 2. RUN TESTS:
 *    -- Run all comprehensive tests
 *    SELECT * FROM run_all_quotes_rls_tests();
 *
 *    -- Run specific validation tests
 *    SELECT * FROM validate_quotes_tenant_isolation();
 *    SELECT * FROM validate_quotes_admin_access();
 *    SELECT * FROM validate_quotes_superadmin_access();
 *    SELECT * FROM validate_quotes_write_protection();
 *
 *    -- Run comprehensive test suite
 *    SELECT * FROM test_quotes_rls_comprehensive();
 *
 *    -- Test performance
 *    SELECT * FROM test_quotes_rls_performance();
 *
 * 3. VIEW POLICY INFORMATION:
 *    SELECT * FROM get_quotes_rls_policy_info();
 *
 * 4. CLEANUP:
 *    -- Clean up only test quotes
 *    SELECT cleanup_test_quotes();
 *
 *    -- Clean up all test data
 *    SELECT cleanup_all_test_data();
 *
 * 5. ROLLBACK PROCEDURES:
 *    -- Drop test functions
 *    DROP FUNCTION IF EXISTS validate_quotes_tenant_isolation();
 *    DROP FUNCTION IF EXISTS validate_quotes_admin_access();
 *    DROP FUNCTION IF EXISTS validate_quotes_superadmin_access();
 *    DROP FUNCTION IF EXISTS validate_quotes_write_protection();
 *    DROP FUNCTION IF EXISTS test_quotes_rls_comprehensive();
 *    DROP FUNCTION IF EXISTS test_quotes_rls_performance();
 *    DROP FUNCTION IF EXISTS cleanup_test_quotes();
 *    DROP FUNCTION IF EXISTS cleanup_all_test_data();
 *    DROP FUNCTION IF EXISTS get_quotes_rls_policy_info();
 *    DROP FUNCTION IF EXISTS run_all_quotes_rls_tests();
 *
 *    -- Remove test data
 *    SELECT cleanup_all_test_data();
 *
 * EXPECTED RESULTS:
 * - All tenant isolation tests should pass
 * - All admin access tests should pass
 * - All superadmin access tests should pass
 * - All write protection tests should pass
 * - Performance tests should show acceptable execution times
 * - Success rate should be 100%
 */

-- ============================================================================
-- TEST EXECUTION EXAMPLE
-- ============================================================================

/* Example output format:

test_suite           | total_tests | passed_tests | failed_tests | success_rate
---------------------+-------------+--------------+--------------+-------------
quotes_rls_comprehensive | 10        | 10           | 0            | 100.00

Individual test results:

test_category       | test_description                                    | passed
--------------------+-----------------------------------------------------+-------
tenant_isolation    | Company A user should see only Company A quotes    | true
tenant_isolation    | Company B user should see only Company B quotes    | true
tenant_isolation    | No context should return 0 quotes (fail-secure)     | true
admin_access        | Company A admin should see all Company A quotes     | true
admin_access        | Company A admin should not see Company B quotes    | true
superadmin_access   | Superadmin should see all test quotes               | true
superadmin_access   | Superadmin should see Company A quotes              | true
write_protection    | Company B user should not update Company A quote   | true
write_protection    | Company B user should not delete Company A quote   | true
write_protection    | Superadmin should update any company quote          | true
*/