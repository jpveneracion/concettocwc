/**
 * RLS (Row-Level Security) Utility Module
 *
 * This module provides TypeScript functions to interact with the PostgreSQL
 * RLS foundation functions for multi-tenant data isolation.
 *
 * These functions should be called at the beginning of each request to establish
 * tenant context and at the end to reset it.
 */

import { sql } from './db';

/**
 * User roles for RLS policies
 */
export type RLSUserRole = 'user' | 'admin' | 'superadmin';

/**
 * RLS context information
 */
export interface RLSContext {
  companyId: string;
  userRole: RLSUserRole;
}

/**
 * Error thrown when RLS context operations fail
 */
export class RLSContextError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RLSContextError';
  }
}

/**
 * Set tenant context for the current database session
 * This should be called at the beginning of each authenticated request
 *
 * @param companyId - The company ID UUID
 * @param userRole - The user role ('user', 'admin', or 'superadmin')
 * @throws RLSContextError if context setting fails
 *
 * @example
 * ```typescript
 * // In an API route or server component
 * import { setTenantContext } from '@/lib/rls';
 * import { getSession } from '@/lib/auth';
 *
 * const session = await getSession();
 * await setTenantContext(session.companyId, session.role || 'user');
 *
 * // Now all queries will be automatically scoped to this user's company
 * const quotes = await sql('SELECT * FROM quotes');
 * ```
 */
export async function setTenantContext(
  companyId: string,
  userRole: RLSUserRole
): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate inputs before sending to database
    if (!companyId) {
      throw new Error('Company ID is required');
    }

    if (!userRole) {
      throw new Error('User role is required');
    }

    if (!['user', 'admin', 'superadmin'].includes(userRole)) {
      throw new Error(`Invalid user role: ${userRole}`);
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      throw new Error(`Invalid company ID format: ${companyId}`);
    }

    // Call the database function
    await sql('SELECT set_tenant_context($1, $2)', [companyId, userRole]);

    const duration = Date.now() - startTime;

    // Log success (using the existing structured logging pattern)
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_context_set',
      duration,
      success: true,
      companyId,
      userRole
    }));
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_context_set_failed',
      duration,
      success: false,
      companyId,
      userRole,
      error: errorMessage
    }));

    throw new RLSContextError(
      `Failed to set tenant context: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Reset tenant context for the current database session
 * This should be called at the end of each request to ensure proper isolation
 *
 * @throws RLSContextError if context reset fails
 *
 * @example
 * ```typescript
 * // In a finally block or cleanup handler
 * import { resetTenantContext } from '@/lib/rls';
 *
 * try {
 *   await setTenantContext(session.companyId, session.role || 'user');
 *   // ... perform queries ...
 * } finally {
 *   await resetTenantContext();
 * }
 * ```
 */
export async function resetTenantContext(): Promise<void> {
  const startTime = Date.now();

  try {
    await sql('SELECT reset_tenant_context()');

    const duration = Date.now() - startTime;

    // Log success
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_context_reset',
      duration,
      success: true
    }));
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_context_reset_failed',
      duration,
      success: false,
      error: errorMessage
    }));

    throw new RLSContextError(
      `Failed to reset tenant context: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get the current company ID from session context
 * Returns null if no context has been set
 *
 * @returns The current company ID or null
 * @throws RLSContextError if query fails
 *
 * @example
 * ```typescript
 * import { getCurrentCompanyId } from '@/lib/rls';
 *
 * const companyId = await getCurrentCompanyId();
 * if (!companyId) {
 *   throw new Error('No RLS context set');
 * }
 * ```
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  const startTime = Date.now();

  try {
    const result = await sql('SELECT get_current_company_id() as company_id');

    const duration = Date.now() - startTime;

    if (!result[0]) {
      return null;
    }

    const companyId = result[0].company_id;

    // Log success
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_company_id_retrieved',
      duration,
      success: true,
      companyId: companyId || null
    }));

    return companyId || null;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_company_id_retrieval_failed',
      duration,
      success: false,
      error: errorMessage
    }));

    throw new RLSContextError(
      `Failed to get current company ID: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get the current user role from session context
 * Returns null if no context has been set
 *
 * @returns The current user role or null
 * @throws RLSContextError if query fails
 *
 * @example
 * ```typescript
 * import { getCurrentUserRole } from '@/lib/rls';
 *
 * const userRole = await getCurrentUserRole();
 * if (userRole === 'admin') {
 *   // Allow admin operations
 * }
 * ```
 */
export async function getCurrentUserRole(): Promise<RLSUserRole | null> {
  const startTime = Date.now();

  try {
    const result = await sql('SELECT get_current_user_role() as user_role');

    const duration = Date.now() - startTime;

    if (!result[0]) {
      return null;
    }

    const userRole = result[0].user_role;

    // Log success
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_user_role_retrieved',
      duration,
      success: true,
      userRole: userRole || null
    }));

    return (userRole || null) as RLSUserRole | null;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'rls_user_role_retrieval_failed',
      duration,
      success: false,
      error: errorMessage
    }));

    throw new RLSContextError(
      `Failed to get current user role: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if current user has admin privileges
 * Helper function to simplify admin checks in application code
 *
 * @returns true if user has admin or superadmin role
 * @throws RLSContextError if query fails
 *
 * @example
 * ```typescript
 * import { isCurrentUserAdmin } from '@/lib/rls';
 *
 * if (await isCurrentUserAdmin()) {
 *   // Show admin features
 * }
 * ```
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const userRole = await getCurrentUserRole();
    return userRole === 'admin' || userRole === 'superadmin';
  } catch (error) {
    // If context check fails, default to false (fail secure)
    return false;
  }
}

/**
 * Check if current user has superadmin privileges
 * Helper function to simplify superadmin checks in application code
 *
 * @returns true if user has superadmin role
 * @throws RLSContextError if query fails
 *
 * @example
 * ```typescript
 * import { isCurrentUserSuperadmin } from '@/lib/rls';
 *
 * if (await isCurrentUserSuperadmin()) {
 *   // Show superadmin features
 * }
 * ```
 */
export async function isCurrentUserSuperadmin(): Promise<boolean> {
  try {
    const userRole = await getCurrentUserRole();
    return userRole === 'superadmin';
  } catch (error) {
    // If context check fails, default to false (fail secure)
    return false;
  }
}

/**
 * Execute a function with tenant context automatically set and reset
 * This is a convenience wrapper for the common pattern of setting context,
 * performing operations, and then resetting context.
 *
 * @param companyId - The company ID UUID
 * @param userRole - The user role ('user', 'admin', or 'superadmin')
 * @param operation - The function to execute with tenant context
 * @returns The result of the operation function
 * @throws RLSContextError if context management fails or operation throws
 *
 * @example
 * ```typescript
 * import { withTenantContext } from '@/lib/rls';
 *
 * const result = await withTenantContext(
 *   session.companyId,
 *   session.role || 'user',
 *   async () => {
 *     // All queries here are automatically scoped to the tenant
 *     return await sql('SELECT * FROM quotes');
 *   }
 * );
 * ```
 */
export async function withTenantContext<T>(
  companyId: string,
  userRole: RLSUserRole,
  operation: () => Promise<T>
): Promise<T> {
  await setTenantContext(companyId, userRole);

  try {
    return await operation();
  } finally {
    // Always reset context, even if operation fails
    try {
      await resetTenantContext();
    } catch (error) {
      // Log but don't throw if reset fails
      console.error('Failed to reset tenant context:', error);
    }
  }
}

/**
 * Execute a function with admin tenant context
 * Convenience wrapper for admin operations
 *
 * @param companyId - The company ID UUID
 * @param operation - The function to execute with admin context
 * @returns The result of the operation function
 * @throws RLSContextError if context management fails or operation throws
 *
 * @example
 * ```typescript
 * import { withAdminContext } from '@/lib/rls';
 *
 * const result = await withAdminContext(session.companyId, async () => {
 *   // This operation runs with admin privileges
 *   return await sql('SELECT * FROM admin_dashboard');
 * });
 * ```
 */
export async function withAdminContext<T>(
  companyId: string,
  operation: () => Promise<T>
): Promise<T> {
  return withTenantContext(companyId, 'admin', operation);
}

/**
 * Execute a function with superadmin tenant context
 * Convenience wrapper for superadmin operations
 *
 * @param operation - The function to execute with superadmin context
 * @returns The result of the operation function
 * @throws RLSContextError if context management fails or operation throws
 *
 * @example
 * ```typescript
 * import { withSuperadminContext } from '@/lib/rls';
 *
 * const result = await withSuperadminContext(async () => {
 *   // This operation can access all companies' data
 *   return await sql('SELECT * FROM all_companies');
 * });
 * ```
 */
export async function withSuperadminContext<T>(
  operation: () => Promise<T>
): Promise<T> {
  // Superadmin operations don't need a specific company ID
  // But we need to provide a valid UUID to the function
  // We'll use a special superadmin context company ID
  const SUPERADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000000';
  return withTenantContext(SUPERADMIN_COMPANY_ID, 'superadmin', operation);
}

/**
 * Validate that RLS context is properly set
 * Throws an error if context is not set
 *
 * @throws RLSContextError if context is not set
 *
 * @example
 * ```typescript
 * import { requireTenantContext } from '@/lib/rls';
 *
 * // In a function that requires RLS context
 * async function myProtectedFunction() {
 *   await requireTenantContext();
 *   // ... perform operations ...
 * }
 * ```
 */
export async function requireTenantContext(): Promise<void> {
  const companyId = await getCurrentCompanyId();

  if (!companyId) {
    throw new RLSContextError(
      'Tenant context not set. Call setTenantContext() first.'
    );
  }
}

/**
 * Get current RLS context information
 * Convenience function to get both company ID and user role
 *
 * @returns RLS context with company ID and user role, or null if not set
 *
 * @example
 * ```typescript
 * import { getRLSContext } from '@/lib/rls';
 *
 * const context = await getRLSContext();
 * if (context) {
 *   console.log(`Current company: ${context.companyId}, role: ${context.userRole}`);
 * }
 * ```
 */
export async function getRLSContext(): Promise<RLSContext | null> {
  try {
    const [companyId, userRole] = await Promise.all([
      getCurrentCompanyId(),
      getCurrentUserRole()
    ]);

    if (!companyId || !userRole) {
      return null;
    }

    return {
      companyId,
      userRole
    };
  } catch (error) {
    // If retrieval fails, return null
    return null;
  }
}