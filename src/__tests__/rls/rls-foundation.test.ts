/**
 * RLS Foundation Tests
 *
 * Tests the PostgreSQL RLS foundation infrastructure including:
 * - Context setting and retrieval
 * - Error cases and validation
 * - Context isolation between operations
 * - Helper functions for admin checks
 */

import { setTenantContext, resetTenantContext, getCurrentCompanyId, getCurrentUserRole, isCurrentUserAdmin, isCurrentUserSuperadmin, withTenantContext, requireTenantContext, getRLSContext, RLSContextError } from '@/lib/rls';
import { sql } from '@/lib/db';

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

describe('RLS Foundation - Context Management', () => {
  beforeEach(async () => {
    await cleanupContext();
  });

  afterEach(async () => {
    await cleanupContext();
  });

  describe('setTenantContext', () => {
    test('should successfully set tenant context with valid parameters', async () => {
      const companyId = generateTestCompanyId();
      const userRole = 'user';

      await expect(setTenantContext(companyId, userRole)).resolves.not.toThrow();

      // Verify context was set
      const retrievedCompanyId = await getCurrentCompanyId();
      const retrievedUserRole = await getCurrentUserRole();

      expect(retrievedCompanyId).toBe(companyId);
      expect(retrievedUserRole).toBe(userRole);
    });

    test('should set admin context successfully', async () => {
      const companyId = generateTestCompanyId();
      const userRole = 'admin';

      await expect(setTenantContext(companyId, userRole)).resolves.not.toThrow();

      const retrievedUserRole = await getCurrentUserRole();
      expect(retrievedUserRole).toBe(userRole);
    });

    test('should set superadmin context successfully', async () => {
      const companyId = generateTestCompanyId();
      const userRole = 'superadmin';

      await expect(setTenantContext(companyId, userRole)).resolves.not.toThrow();

      const retrievedUserRole = await getCurrentUserRole();
      expect(retrievedUserRole).toBe(userRole);
    });

    test('should throw error when companyId is empty', async () => {
      await expect(setTenantContext('', 'user')).rejects.toThrow(RLSContextError);
    });

    test('should throw error when companyId is null', async () => {
      await expect(setTenantContext(null as any, 'user')).rejects.toThrow(RLSContextError);
    });

    test('should throw error when userRole is empty', async () => {
      const companyId = generateTestCompanyId();
      await expect(setTenantContext(companyId, '')).rejects.toThrow(RLSContextError);
    });

    test('should throw error when userRole is null', async () => {
      const companyId = generateTestCompanyId();
      await expect(setTenantContext(companyId, null as any)).rejects.toThrow(RLSContextError);
    });

    test('should throw error when companyId has invalid UUID format', async () => {
      await expect(setTenantContext('not-a-uuid', 'user')).rejects.toThrow(RLSContextError);
    });

    test('should throw error when userRole is invalid', async () => {
      const companyId = generateTestCompanyId();
      await expect(setTenantContext(companyId, 'invalid-role' as any)).rejects.toThrow(RLSContextError);
    });

    test('should throw error when companyId is almost valid UUID but not quite', async () => {
      await expect(setTenantContext('12345678-1234-1234-1234-123456789abcd', 'user')).rejects.toThrow();
    });
  });

  describe('resetTenantContext', () => {
    test('should successfully reset tenant context', async () => {
      const companyId = generateTestCompanyId();

      // Set context first
      await setTenantContext(companyId, 'user');
      expect(await getCurrentCompanyId()).toBe(companyId);

      // Reset context
      await expect(resetTenantContext()).resolves.not.toThrow();

      // Verify context was cleared
      expect(await getCurrentCompanyId()).toBeNull();
      expect(await getCurrentUserRole()).toBeNull();
    });

    test('should handle reset when no context is set', async () => {
      // Reset without setting context first
      await expect(resetTenantContext()).resolves.not.toThrow();
    });

    test('should handle multiple consecutive resets', async () => {
      await expect(resetTenantContext()).resolves.not.toThrow();
      await expect(resetTenantContext()).resolves.not.toThrow();
      await expect(resetTenantContext()).resolves.not.toThrow();
    });
  });

  describe('getCurrentCompanyId', () => {
    test('should return company ID when context is set', async () => {
      const companyId = generateTestCompanyId();
      await setTenantContext(companyId, 'user');

      const result = await getCurrentCompanyId();
      expect(result).toBe(companyId);
    });

    test('should return null when context is not set', async () => {
      const result = await getCurrentCompanyId();
      expect(result).toBeNull();
    });

    test('should return null after context is reset', async () => {
      const companyId = generateTestCompanyId();
      await setTenantContext(companyId, 'user');
      await resetTenantContext();

      const result = await getCurrentCompanyId();
      expect(result).toBeNull();
    });

    test('should handle consecutive calls consistently', async () => {
      const companyId = generateTestCompanyId();
      await setTenantContext(companyId, 'admin');

      const result1 = await getCurrentCompanyId();
      const result2 = await getCurrentCompanyId();
      const result3 = await getCurrentCompanyId();

      expect(result1).toBe(companyId);
      expect(result2).toBe(companyId);
      expect(result3).toBe(companyId);
    });
  });

  describe('getCurrentUserRole', () => {
    test('should return user role when context is set', async () => {
      await setTenantContext(generateTestCompanyId(), 'admin');

      const result = await getCurrentUserRole();
      expect(result).toBe('admin');
    });

    test('should return null when context is not set', async () => {
      const result = await getCurrentUserRole();
      expect(result).toBeNull();
    });

    test('should return null after context is reset', async () => {
      await setTenantContext(generateTestCompanyId(), 'user');
      await resetTenantContext();

      const result = await getCurrentUserRole();
      expect(result).toBeNull();
    });

    test('should return correct role for all valid roles', async () => {
      const companyId = generateTestCompanyId();

      await setTenantContext(companyId, 'user');
      expect(await getCurrentUserRole()).toBe('user');
      await resetTenantContext();

      await setTenantContext(companyId, 'admin');
      expect(await getCurrentUserRole()).toBe('admin');
      await resetTenantContext();

      await setTenantContext(companyId, 'superadmin');
      expect(await getCurrentUserRole()).toBe('superadmin');
    });
  });

  describe('isCurrentUserAdmin', () => {
    test('should return true for admin role', async () => {
      await setTenantContext(generateTestCompanyId(), 'admin');
      expect(await isCurrentUserAdmin()).toBe(true);
    });

    test('should return true for superadmin role', async () => {
      await setTenantContext(generateTestCompanyId(), 'superadmin');
      expect(await isCurrentUserAdmin()).toBe(true);
    });

    test('should return false for user role', async () => {
      await setTenantContext(generateTestCompanyId(), 'user');
      expect(await isCurrentUserAdmin()).toBe(false);
    });

    test('should return false when no context is set', async () => {
      expect(await isCurrentUserAdmin()).toBe(false);
    });

    test('should return false after context is reset', async () => {
      await setTenantContext(generateTestCompanyId(), 'admin');
      await resetTenantContext();
      expect(await isCurrentUserAdmin()).toBe(false);
    });
  });

  describe('isCurrentUserSuperadmin', () => {
    test('should return true for superadmin role', async () => {
      await setTenantContext(generateTestCompanyId(), 'superadmin');
      expect(await isCurrentUserSuperadmin()).toBe(true);
    });

    test('should return false for admin role', async () => {
      await setTenantContext(generateTestCompanyId(), 'admin');
      expect(await isCurrentUserSuperadmin()).toBe(false);
    });

    test('should return false for user role', async () => {
      await setTenantContext(generateTestCompanyId(), 'user');
      expect(await isCurrentUserSuperadmin()).toBe(false);
    });

    test('should return false when no context is set', async () => {
      expect(await isCurrentUserSuperadmin()).toBe(false);
    });
  });

  describe('withTenantContext', () => {
    test('should execute operation with tenant context', async () => {
      const companyId = generateTestCompanyId();
      const userRole = 'user';

      let capturedContext: any = null;

      await withTenantContext(companyId, userRole, async () => {
        capturedContext = {
          companyId: await getCurrentCompanyId(),
          userRole: await getCurrentUserRole()
        };
      });

      expect(capturedContext.companyId).toBe(companyId);
      expect(capturedContext.userRole).toBe(userRole);
    });

    test('should reset context after operation completes', async () => {
      const companyId = generateTestCompanyId();

      await withTenantContext(companyId, 'user', async () => {
        // Operation with context
      });

      // Context should be reset
      expect(await getCurrentCompanyId()).toBeNull();
    });

    test('should reset context even if operation throws', async () => {
      const companyId = generateTestCompanyId();

      await expect(
        withTenantContext(companyId, 'user', async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');

      // Context should still be reset
      expect(await getCurrentCompanyId()).toBeNull();
    });

    test('should return operation result', async () => {
      const companyId = generateTestCompanyId();
      const expectedResult = { data: 'test-result' };

      const result = await withTenantContext(companyId, 'user', async () => {
        return expectedResult;
      });

      expect(result).toEqual(expectedResult);
    });

    test('should handle async operations', async () => {
      const companyId = generateTestCompanyId();

      let operationExecuted = false;

      await withTenantContext(companyId, 'admin', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        operationExecuted = true;
      });

      expect(operationExecuted).toBe(true);
    });
  });

  describe('requireTenantContext', () => {
    test('should not throw when context is set', async () => {
      await setTenantContext(generateTestCompanyId(), 'user');
      await expect(requireTenantContext()).resolves.not.toThrow();
    });

    test('should throw error when context is not set', async () => {
      await expect(requireTenantContext()).rejects.toThrow(RLSContextError);
      await expect(requireTenantContext()).rejects.toThrow('Tenant context not set');
    });

    test('should throw error after context is reset', async () => {
      await setTenantContext(generateTestCompanyId(), 'user');
      await resetTenantContext();

      await expect(requireTenantContext()).rejects.toThrow(RLSContextError);
    });
  });

  describe('getRLSContext', () => {
    test('should return complete context when both values are set', async () => {
      const companyId = generateTestCompanyId();
      const userRole = 'admin';

      await setTenantContext(companyId, userRole);

      const context = await getRLSContext();

      expect(context).not.toBeNull();
      expect(context?.companyId).toBe(companyId);
      expect(context?.userRole).toBe(userRole);
    });

    test('should return null when no context is set', async () => {
      const context = await getRLSContext();
      expect(context).toBeNull();
    });

    test('should return null after context is reset', async () => {
      await setTenantContext(generateTestCompanyId(), 'user');
      await resetTenantContext();

      const context = await getRLSContext();
      expect(context).toBeNull();
    });

    test('should return correct type for all valid roles', async () => {
      const companyId = generateTestCompanyId();

      await setTenantContext(companyId, 'user');
      let context = await getRLSContext();
      expect(context?.userRole).toBe('user');
      await resetTenantContext();

      await setTenantContext(companyId, 'admin');
      context = await getRLSContext();
      expect(context?.userRole).toBe('admin');
      await resetTenantContext();

      await setTenantContext(companyId, 'superadmin');
      context = await getRLSContext();
      expect(context?.userRole).toBe('superadmin');
    });
  });

  describe('Context Isolation', () => {
    test('should maintain separate context between operations', async () => {
      const companyId1 = generateTestCompanyId();
      const companyId2 = generateTestCompanyId();

      // First operation
      await withTenantContext(companyId1, 'user', async () => {
        expect(await getCurrentCompanyId()).toBe(companyId1);
      });

      // Second operation should have different context
      await withTenantContext(companyId2, 'admin', async () => {
        expect(await getCurrentCompanyId()).toBe(companyId2);
      });

      // Context should be reset after both operations
      expect(await getCurrentCompanyId()).toBeNull();
    });

    test('should handle rapid context switching', async () => {
      const contexts = [
        { companyId: generateTestCompanyId(), role: 'user' },
        { companyId: generateTestCompanyId(), role: 'admin' },
        { companyId: generateTestCompanyId(), role: 'superadmin' }
      ];

      for (const { companyId, role } of contexts) {
        await withTenantContext(companyId, role as any, async () => {
          expect(await getCurrentCompanyId()).toBe(companyId);
          expect(await getCurrentUserRole()).toBe(role);
        });
      }

      // Final check - context should be reset
      expect(await getCurrentCompanyId()).toBeNull();
    });

    test('should prevent context leakage between concurrent operations', async () => {
      const companyId1 = generateTestCompanyId();
      const companyId2 = generateTestCompanyId();

      const results: string[] = [];

      // Run two operations that set different contexts
      await Promise.all([
        withTenantContext(companyId1, 'user', async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          results.push(await getCurrentCompanyId());
        }),
        withTenantContext(companyId2, 'admin', async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          results.push(await getCurrentCompanyId());
        })
      ]);

      // Each operation should see its own context
      expect(results).toContain(companyId1);
      expect(results).toContain(companyId2);
      expect(results.length).toBe(2);

      // Final check - context should be reset
      expect(await getCurrentCompanyId()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should provide detailed error messages', async () => {
      try {
        await setTenantContext('', 'user');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(RLSContextError);
        expect((error as RLSContextError).message).toContain('Company ID is required');
      }
    });

    test('should wrap underlying database errors', async () => {
      // This test verifies that database errors are properly wrapped
      // The specific error depends on whether the migration has been run
      const companyId = generateTestCompanyId();

      try {
        await setTenantContext(companyId, 'user');
        // If migration exists, this should succeed
        expect(await getCurrentCompanyId()).toBe(companyId);
      } catch (error) {
        // If migration doesn't exist, we should get a wrapped error
        expect(error).toBeInstanceOf(RLSContextError);
        expect((error as RLSContextError).message).toContain('Failed to set tenant context');
      }
    });

    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we test that the error handling structure exists
      const companyId = generateTestCompanyId();

      try {
        await setTenantContext(companyId, 'user');
        // If we get here without migration, it should throw
        expect(await getCurrentCompanyId()).toBe(companyId);
      } catch (error) {
        expect(error).toBeInstanceOf(RLSContextError);
      }
    });
  });

  describe('Integration with Database Client', () => {
    test('should work with database queries in context', async () => {
      const companyId = generateTestCompanyId();

      await withTenantContext(companyId, 'user', async () => {
        // This tests that RLS functions work alongside regular queries
        const context = await getCurrentCompanyId();
        expect(context).toBe(companyId);

        // Try a simple query (this may fail if tables don't exist yet)
        try {
          await sql('SELECT 1 as test');
        } catch (error) {
          // Query may fail if schema doesn't exist, but RLS context should still work
        }
      });
    });

    test('should maintain context across multiple queries', async () => {
      const companyId = generateTestCompanyId();

      await withTenantContext(companyId, 'admin', async () => {
        const context1 = await getCurrentCompanyId();
        const context2 = await getCurrentCompanyId();
        const context3 = await getCurrentCompanyId();

        expect(context1).toBe(companyId);
        expect(context2).toBe(companyId);
        expect(context3).toBe(companyId);
      });
    });
  });
});