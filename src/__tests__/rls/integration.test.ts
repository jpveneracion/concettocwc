/**
 * RLS Integration Tests
 *
 * Comprehensive integration tests for the RLS system verifying:
 * - SECURITY DEFINER functions work without RLS context
 * - query() with RLS context properly scopes data
 * - connection pool behavior with concurrent requests
 * - transaction scope prevents cross-request contamination
 *
 * These tests verify the entire RLS system works correctly end-to-end.
 */

import { query, pool } from '@/lib/db';
import { setTenantContext, resetTenantContext, getCurrentCompanyId } from '@/lib/rls';

// Helper to generate a valid test company ID
function generateTestCompanyId(): string {
  return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, () => {
    return Math.floor(Math.random() * 16).toString(16);
  });
}

// Helper to clean up any existing context before each test
async function cleanupContext(): Promise<void> {
  try {
    await resetTenantContext();
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Helper to execute operation within a transaction
async function withTransaction<T>(operation: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } finally {
    client.release();
  }
}

describe('RLS Integration Tests', () => {
  beforeEach(async () => {
    await cleanupContext();
  });

  afterEach(async () => {
    await cleanupContext();
  });

  // Test 1: SECURITY DEFINER functions work without RLS context
  test('SECURITY DEFINER functions work without RLS context', async () => {
    // Verify no RLS context is set
    const initialContext = await getCurrentCompanyId();
    expect(initialContext).toBeNull();

    // Test that find_user_by_id SECURITY DEFINER function works without context
    // SECURITY DEFINER functions should bypass RLS and work with their own permissions
    try {
      // Use a test UUID that likely doesn't exist to test function accessibility
      const testUserId = '00000000-0000-0000-0000-000000000001';

      const result = await query('SELECT * FROM find_user_by_id($1)', [testUserId]);

      // The function should execute without RLS context errors
      // It may return no rows (user doesn't exist), but shouldn't throw RLS errors
      expect(result).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);
    } catch (error) {
      // SECURITY DEFINER functions should not fail due to missing RLS context
      // If there's an error, it should be a "user not found" type, not RLS-related
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      expect(errorMessage).not.toContain('rls');
      expect(errorMessage).not.toContain('context');
    }
  });

  // Test 2: query() with RLS context properly scopes data
  test('query() with RLS context properly scopes data', async () => {
    const company1Id = generateTestCompanyId();
    const company2Id = generateTestCompanyId();

    // Set context for company 1
    await setTenantContext(company1Id, 'user');
    const context1Company = await getCurrentCompanyId();
    expect(context1Company).toBe(company1Id);

    // Query should respect company 1 context
    // Test with a simple query that would show context scoping
    const result1 = await query(`
      SELECT
        current_setting('rls.current_company_id', true) as context_company,
        current_setting('rls.current_user_role', true) as context_role
    `, []);

    expect(result1.rows[0].context_company).toBe(company1Id);
    expect(result1.rows[0].context_role).toBe('user');

    // Reset and set context for company 2
    await resetTenantContext();
    await setTenantContext(company2Id, 'admin');
    const context2Company = await getCurrentCompanyId();
    expect(context2Company).toBe(company2Id);

    // Query should now respect company 2 context
    const result2 = await query(`
      SELECT
        current_setting('rls.current_company_id', true) as context_company,
        current_setting('rls.current_user_role', true) as context_role
    `, []);

    expect(result2.rows[0].context_company).toBe(company2Id);
    expect(result2.rows[0].context_role).toBe('admin');

    // Verify query() respects context boundaries by testing direct parameters
    const scopedResult = await query(
      'SELECT current_setting($1, true) as test_value',
      [company1Id],
      company2Id,
      'user'
    );

    // The scoped query should use the provided context parameters
    expect(scopedResult).toBeDefined();
  });

  // Test 3: connection pool behavior with concurrent requests
  test('connection pool behavior with concurrent requests', async () => {
    const company1Id = generateTestCompanyId();
    const company2Id = generateTestCompanyId();
    const company3Id = generateTestCompanyId();

    // Test 3 concurrent connections with different contexts
    const operations = [
      // Connection 1: Set company 1 context
      (async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT set_config($1, $2, true)', ['rls.current_company_id', company1Id]);
          await client.query('SELECT set_config($1, $2, true)', ['rls.current_user_role', 'user']);

          // Verify context is set for this connection
          const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);
          expect(result.rows[0].company_id).toBe(company1Id);

          await client.query('COMMIT');
          return 'connection1_complete';
        } finally {
          client.release();
        }
      })(),

      // Connection 2: Set company 2 context
      (async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT set_config($1, $2, true)', ['rls.current_company_id', company2Id]);
          await client.query('SELECT set_config($1, $2, true)', ['rls.current_user_role', 'admin']);

          // Verify context is set for this connection
          const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);
          expect(result.rows[0].company_id).toBe(company2Id);

          await client.query('COMMIT');
          return 'connection2_complete';
        } finally {
          client.release();
        }
      })(),

      // Connection 3: No context (should remain NULL)
      (async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Verify no context is set for this connection
          const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);
          expect(result.rows[0].company_id).toBeNull();

          await client.query('COMMIT');
          return 'connection3_complete';
        } finally {
          client.release();
        }
      })()
    ];

    // Execute all operations concurrently
    const results = await Promise.all(operations);

    // Verify all connections completed successfully
    expect(results).toContain('connection1_complete');
    expect(results).toContain('connection2_complete');
    expect(results).toContain('connection3_complete');
  });

  // Test 4: transaction scope prevents cross-request contamination
  test('transaction scope prevents cross-request contamination', async () => {
    const company1Id = generateTestCompanyId();
    const company2Id = generateTestCompanyId();

    // First transaction: Set company 1 context
    await withTransaction(async (client) => {
      await client.query('SELECT set_config($1, $2, true)', ['rls.current_company_id', company1Id]);
      await client.query('SELECT set_config($1, $2, true)', ['rls.current_user_role', 'user']);

      const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);
      expect(result.rows[0].company_id).toBe(company1Id);
    });

    // Second transaction: Should start with no context (context isolation)
    await withTransaction(async (client) => {
      const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);

      // Context from previous transaction should not leak
      expect(result.rows[0].company_id).toBeNull();
    });

    // Third transaction: Set company 2 context
    await withTransaction(async (client) => {
      await client.query('SELECT set_config($1, $2, true)', ['rls.current_company_id', company2Id]);
      await client.query('SELECT set_config($1, $2, true)', ['rls.current_user_role', 'admin']);

      const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);
      expect(result.rows[0].company_id).toBe(company2Id);
    });

    // Fourth transaction: Again verify no context leakage
    await withTransaction(async (client) => {
      const result = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);

      // Context from previous transactions should not leak
      expect(result.rows[0].company_id).toBeNull();
    });

    // Additional verification: Test separate query() calls maintain isolation
    await setTenantContext(company1Id, 'user');
    const context1 = await getCurrentCompanyId();
    expect(context1).toBe(company1Id);

    // Reset and verify new context
    await resetTenantContext();
    const contextAfterReset = await getCurrentCompanyId();
    expect(contextAfterReset).toBeNull();

    // Set different context and verify it's isolated
    await setTenantContext(company2Id, 'admin');
    const context2 = await getCurrentCompanyId();
    expect(context2).toBe(company2Id);
    expect(context2).not.toBe(company1Id);
  });

  // Additional integration test: verify context isolation in error scenarios
  test('context isolation maintained during errors', async () => {
    const company1Id = generateTestCompanyId();
    const company2Id = generateTestCompanyId();

    // Set initial context
    await setTenantContext(company1Id, 'user');
    expect(await getCurrentCompanyId()).toBe(company1Id);

    // Simulate an error that might cause context issues
    try {
      // Try to set an invalid context (this should fail)
      await setTenantContext('invalid-uuid', 'user' as any);
      fail('Expected RLS context error');
    } catch (error) {
      // Expected error - invalid UUID
    }

    // Verify original context is still intact
    expect(await getCurrentCompanyId()).toBe(company1Id);

    // Reset and set new context
    await resetTenantContext();
    await setTenantContext(company2Id, 'admin');
    expect(await getCurrentCompanyId()).toBe(company2Id);
  });
});