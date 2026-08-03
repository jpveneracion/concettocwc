/**
 * Transaction Scope Tests
 *
 * Tests the PostgreSQL transaction-scoped RLS context isolation.
 * Verifies that:
 * - Context does not leak between separate transactions
 * - Context persists correctly within a single transaction
 * - Reset functions properly clear all context variables
 * - The query() helper properly handles transaction scope
 */

import { query, pool } from '@/lib/db';

// Helper to generate a valid test company ID
function generateTestCompanyId(): string {
  return '00000000-0000-0000-0000-00000000'.replace(/[0]/g, () => {
    return Math.floor(Math.random() * 16).toString(16);
  }).slice(0, 36);
}

// Helper to clean up any existing context before each test
async function cleanupContext(): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT reset_tenant_context()');
    } catch (error) {
      // Function may not exist yet, ignore
    }
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

// Helper to set RLS context
async function setContext(client: any, companyId: string, userRole?: string): Promise<void> {
  await client.query('SELECT set_config($1, $2, true)', ['rls.current_company_id', companyId]);
  if (userRole) {
    await client.query('SELECT set_config($1, $2, true)', ['rls.current_user_role', userRole]);
  }
}

// Helper to get current context
async function getContext(client: any): Promise<{ company_id: string | null; user_role: string | null }> {
  const companyIdResult = await client.query('SELECT current_setting($1, true) as company_id', ['rls.current_company_id']);
  const userRoleResult = await client.query('SELECT current_setting($1, true) as user_role', ['rls.current_user_role']);
  return {
    company_id: companyIdResult.rows[0].company_id,
    user_role: userRoleResult.rows[0].user_role
  };
}

// Verify database state in setup
async function verifyDatabaseFunctions(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'reset_tenant_context'
      ) as exists
    `);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

describe('Transaction Scope Isolation', () => {
  beforeEach(async () => {
    await cleanupContext();
  });

  afterEach(async () => {
    await cleanupContext();
  });

  describe('transaction boundaries', () => {
    test('context should not leak between transactions', async () => {
      jest.setTimeout(30000); // Increase timeout for database operations
      const testCompanyId = '00000000-0000-0000-0000-000000000001';

      // First transaction: set context and verify it works
      await withTransaction(async (client) => {
        await setContext(client, testCompanyId);
        const context = await getContext(client);
        expect(context.company_id).toBe(testCompanyId);
      });

      // Second transaction: context should be NULL
      await withTransaction(async (client) => {
        const context = await getContext(client);
        expect(context.company_id).toBeNull();
      });
    });

    test('context should persist within single transaction', async () => {
      const testCompanyId = '00000000-0000-0000-0000-000000000002';

      await withTransaction(async (client) => {
        // Set context
        await setContext(client, testCompanyId);

        // Verify context persists in same transaction
        const contextCheck1 = await getContext(client);
        expect(contextCheck1.company_id).toBe(testCompanyId);

        // Verify again - should still persist
        const contextCheck2 = await getContext(client);
        expect(contextCheck2.company_id).toBe(testCompanyId);
      });
    });

    test('reset_tenant_context clears all context variables', async () => {
      const testCompanyId = '00000000-0000-0000-0000-000000000003';
      const testUserRole = 'admin';

      await withTransaction(async (client) => {
        // Set multiple context variables
        await setContext(client, testCompanyId, testUserRole);

        // Verify both are set
        const contextBefore = await getContext(client);
        expect(contextBefore.company_id).toBe(testCompanyId);
        expect(contextBefore.user_role).toBe(testUserRole);

        // Reset context
        await client.query('SELECT reset_tenant_context()');

        // Verify both are cleared
        const contextAfter = await getContext(client);
        expect(contextAfter.company_id).toBeNull();
        expect(contextAfter.user_role).toBeNull();
      });
    });

    test('query() function properly wraps in transactions', async () => {
      // Test that our query() helper properly handles transaction scope
      const testCompanyId = '00000000-0000-0000-0000-000000000004';

      // First query: set context within transaction
      await query('SELECT set_config($1, $2, true)', ['rls.current_company_id', testCompanyId]);

      // After the query transaction commits, verify context is cleared
      // This requires a separate connection to see the actual session state
      await withTransaction(async (client) => {
        const context = await getContext(client);
        expect(context.company_id).toBeNull();
      });
    });
  });

  describe('transaction error handling', () => {
    test('context is cleared on rollback', async () => {
      const client = await pool.connect();

      try {
        // Start transaction and set context
        await client.query('BEGIN');
        await setContext(client, '00000000-0000-0000-0000-000000000005');

        // Verify context is set
        const contextBefore = await getContext(client);
        expect(contextBefore.company_id).toBe('00000000-0000-0000-0000-000000000005');

        // Rollback the transaction
        await client.query('ROLLBACK');

        // Start new transaction and verify context is cleared
        await client.query('BEGIN');
        const contextAfter = await getContext(client);
        expect(contextAfter.company_id).toBeNull();
        await client.query('COMMIT');

      } finally {
        client.release();
      }
    });

    test('multiple sequential transactions maintain isolation', async () => {
      const client = await pool.connect();

      try {
        // First transaction
        await client.query('BEGIN');
        await setContext(client, '00000000-0000-0000-0000-000000000006');
        const tx1Context = await getContext(client);
        expect(tx1Context.company_id).toBe('00000000-0000-0000-0000-000000000006');
        await client.query('COMMIT');

        // Second transaction - different context
        await client.query('BEGIN');
        await setContext(client, '00000000-0000-0000-0000-000000000007');
        const tx2Context = await getContext(client);
        expect(tx2Context.company_id).toBe('00000000-0000-0000-0000-000000000007');
        await client.query('COMMIT');

        // Third transaction - no context (should be NULL)
        await client.query('BEGIN');
        const tx3Context = await getContext(client);
        expect(tx3Context.company_id).toBeNull();
        await client.query('COMMIT');

      } finally {
        client.release();
      }
    });
  });

  describe('concurrent connection isolation', () => {
    test('different connections maintain separate context', async () => {
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      try {
        // Client 1: set context in transaction
        await client1.query('BEGIN');
        await setContext(client1, '00000000-0000-0000-0000-000000000008');

        // Client 2: should not see client 1's context
        await client2.query('BEGIN');
        const client2Context = await getContext(client2);
        expect(client2Context.company_id).toBeNull();

        // Client 1: should still see its own context
        const client1Context = await getContext(client1);
        expect(client1Context.company_id).toBe('00000000-0000-0000-0000-000000000008');

        // Clean up both transactions
        await client1.query('COMMIT');
        await client2.query('COMMIT');

      } finally {
        client1.release();
        client2.release();
      }
    });
  });
});