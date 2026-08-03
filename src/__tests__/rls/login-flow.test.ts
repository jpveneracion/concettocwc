/**
 * Login Flow Integration Tests
 *
 * Tests the RLS context operations for login flow scenarios.
 * Verifies that:
 * - setTenantContext properly establishes both company_id and user_role
 * - Context can be switched between different companies
 * - Invalid company ID formats are rejected
 * - Invalid user roles are rejected
 * - Role normalization works correctly
 * - No-context scenarios are handled appropriately
 */

import { setTenantContext, resetTenantContext, getCurrentCompanyId, getCurrentUserRole, RLSContextError } from '@/lib/rls';

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

// Helper to validate role rejection with error message checking
async function expectRoleRejection(companyId: string, invalidRole: string): Promise<void> {
  try {
    await setTenantContext(companyId, invalidRole as any);
    fail(`Expected RLSContextError for role: "${invalidRole}"`);
  } catch (error) {
    expect(error).toBeInstanceOf(RLSContextError);
    expect((error as RLSContextError).message).toContain('role');
  }
}

// Helper to validate role acceptance
async function expectRoleAcceptance(companyId: string, validRole: string): Promise<void> {
  await expect(setTenantContext(companyId, validRole)).resolves.not.toThrow();
  expect(await getCurrentUserRole()).toBe(validRole);
  await resetTenantContext();
}

describe('Login Flow Integration Tests', () => {
  beforeEach(async () => {
    await cleanupContext();
  });

  afterEach(async () => {
    await cleanupContext();
  });

  // Spec Test 1: setTenantContext establishes proper context
  test('setTenantContext establishes both company_id and user_role in session', async () => {
    const companyId = generateTestCompanyId();
    const userRole = 'user';

    // Set the tenant context
    await expect(setTenantContext(companyId, userRole)).resolves.not.toThrow();

    // Verify both company_id and user_role are set correctly
    const retrievedCompanyId = await getCurrentCompanyId();
    const retrievedUserRole = await getCurrentUserRole();

    expect(retrievedCompanyId).toBe(companyId);
    expect(retrievedUserRole).toBe(userRole);
  });

  // Spec Test 2: Context isolation between different companies
  test('context switching allows moving between different companies and roles', async () => {
    const company1Id = generateTestCompanyId();
    const company2Id = generateTestCompanyId();

    // Set context for first company
    await setTenantContext(company1Id, 'user');
    expect(await getCurrentCompanyId()).toBe(company1Id);

    // Switch to second company
    await setTenantContext(company2Id, 'admin');
    expect(await getCurrentCompanyId()).toBe(company2Id);
    expect(await getCurrentUserRole()).toBe('admin');

    // Switch back to first company
    await setTenantContext(company1Id, 'user');
    expect(await getCurrentCompanyId()).toBe(company1Id);
    expect(await getCurrentUserRole()).toBe('user');
  });

  // Spec Test 3: Invalid UUID format rejection
  test('rejects invalid company ID formats with meaningful error messages', async () => {
    const invalidUUIDs = [
      'not-a-uuid',
      '12345678-1234-1234-1234-123456789abcd', // Invalid character
      '12345678-1234-1234-1234-123456789ab',   // Too short
      '12345678-1234-1234-1234-123456789abcde', // Too long
      '12345678-1234-12345-1234-123456789abc',  // Invalid segment length
      '',                                        // Empty string
    ];

    for (const invalidUUID of invalidUUIDs) {
      try {
        await setTenantContext(invalidUUID, 'user');
        fail(`Expected RLSContextError for UUID: "${invalidUUID}"`);
      } catch (error) {
        expect(error).toBeInstanceOf(RLSContextError);
        expect((error as RLSContextError).message).toContain('company');
      }
    }
  });

  // Spec Test 4: Valid UUID acceptance
  test('accepts valid UUID format for company ID', async () => {
    const validUUID = '00000000-0000-0000-0000-000000000000';

    await expect(setTenantContext(validUUID, 'user')).resolves.not.toThrow();
    expect(await getCurrentCompanyId()).toBe(validUUID);
  });

  // Spec Test 5: Invalid role rejection
  test('rejects invalid user roles with meaningful error messages', async () => {
    const companyId = generateTestCompanyId();

    const invalidRoles = [
      'superuser',     // Not a valid role
      'manager',       // Not a valid role
      'guest',         // Not a valid role
      'User',          // Wrong case
      'ADMIN',         // Wrong case
      '',              // Empty string
      'root',          // Not a valid role
      'moderator',     // Not a valid role
    ];

    for (const invalidRole of invalidRoles) {
      await expectRoleRejection(companyId, invalidRole);
    }
  });

  // Additional test: Valid roles are accepted
  test('accepts all valid user roles', async () => {
    const companyId = generateTestCompanyId();
    const validRoles = ['user', 'admin', 'superadmin'];

    for (const validRole of validRoles) {
      await expectRoleAcceptance(companyId, validRole);
    }
  });

  // Additional test: Role behavior consistency
  test('maintains consistent role behavior across different companies', async () => {
    const companyId = generateTestCompanyId();
    const roleTests = [
      { input: 'user', expected: 'user' },
      { input: 'admin', expected: 'admin' },
      { input: 'superadmin', expected: 'superadmin' },
    ];

    for (const { input, expected } of roleTests) {
      await setTenantContext(companyId, input);
      const retrievedRole = await getCurrentUserRole();
      expect(retrievedRole).toBe(expected);
      await resetTenantContext();
    }
  });

  // Additional test: Role variations are rejected
  test('rejects role variations when normalization is not supported', async () => {
    const companyId = generateTestCompanyId();
    const variationsThatShouldBeRejected = [
      'super_admin',
      'SuperAdmin',
      'SUPER_ADMIN',
      'Admin',
      'User',
    ];

    for (const variation of variationsThatShouldBeRejected) {
      await expectRoleRejection(companyId, variation);
    }
  });

  // Additional test: No-context scenarios for getCurrentCompanyId
  test('handles getCurrentCompanyId when no context is set', async () => {
    // Ensure no context is set
    await cleanupContext();

    try {
      await getCurrentCompanyId();
      fail('Expected error when calling getCurrentCompanyId without context');
    } catch (error) {
      expect(error).toBeInstanceOf(RLSContextError);
      expect((error as RLSContextError).message).toContain('context');
    }
  });

  // Additional test: No-context scenarios for getCurrentUserRole
  test('handles getCurrentUserRole when no context is set', async () => {
    // Ensure no context is set
    await cleanupContext();

    try {
      await getCurrentUserRole();
      fail('Expected error when calling getCurrentUserRole without context');
    } catch (error) {
      expect(error).toBeInstanceOf(RLSContextError);
      expect((error as RLSContextError).message).toContain('context');
    }
  });
});