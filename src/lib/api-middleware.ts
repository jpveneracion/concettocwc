/**
 * API Middleware for RLS Context Management
 *
 * This module provides middleware functions to ensure RLS context is properly
 * established and managed throughout API request processing.
 */

import { requireSessionWithRLS, resetSessionContext, type Session } from './auth';
import { setTenantContext, resetTenantContext, requireTenantContext, type RLSUserRole } from './rls';

/**
 * Middleware to verify RLS context is set before processing API request
 * Throws error if context is not properly established
 *
 * @throws Error if RLS context is not set
 *
 * @example
 * ```typescript
 * import { verifyRLSContext } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   await verifyRLSContext(); // Ensure context is set
 *   // ... proceed with API logic
 * }
 * ```
 */
export async function verifyRLSContext(): Promise<void> {
  try {
    await requireTenantContext();
    console.log('✅ RLS context verified');
  } catch (error) {
    console.error('❌ RLS context verification failed:', error);
    throw new Error('RLS context not established. Tenant context required for this operation.');
  }
}

/**
 * Middleware to establish RLS context from session
 * Automatically sets tenant context based on authenticated user session
 *
 * @returns Session with RLS context established
 * @throws Error if not authenticated or context setting fails
 *
 * @example
 * ```typescript
 * import { withRLSContext } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   const session = await withRLSContext(); // Auto-set context from session
 *   // ... proceed with API logic
 * }
 * ```
 */
export async function withRLSContext(): Promise<Session> {
  try {
    const session = await requireSessionWithRLS();
    console.log('✅ RLS context established from session:', session.userId);
    return session;
  } catch (error) {
    console.error('❌ Failed to establish RLS context from session:', error);
    throw new Error('Failed to establish tenant context from session');
  }
}

/**
 * Middleware to establish RLS context with specific role
 * Useful for operations that require elevated privileges
 *
 * @param role - The role to use for RLS context
 * @returns Session with RLS context established
 * @throws Error if not authenticated or context setting fails
 *
 * @example
 * ```typescript
 * import { withAdminRLSContext } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   const session = await withAdminRLSContext(); // Set admin context
 *   // ... proceed with admin operations
 * }
 * ```
 */
export async function withRoleRLSContext(role: RLSUserRole): Promise<Session> {
  try {
    const session = await requireSessionWithRLS();

    // Override role context if requested
    // (This assumes user has permission to use this role)
    await setTenantContext(session.companyId, role);
    console.log('✅ RLS context established with role:', role, 'for user:', session.userId);

    return session;
  } catch (error) {
    console.error('❌ Failed to establish RLS context with role:', role, error);
    throw new Error(`Failed to establish tenant context with role: ${role}`);
  }
}

/**
 * Middleware wrapper for API handlers with automatic RLS context management
 * Wraps API handler functions with automatic context establishment and cleanup
 *
 * @param handler - The API handler function to wrap
 * @returns Wrapped handler function with RLS context management
 *
 * @example
 * ```typescript
 * import { withRLSMiddleware } from '@/lib/api-middleware';
 *
 * export const GET = withRLSMiddleware(async (req, session) => {
 *   // session is provided with RLS context already set
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function withRLSMiddleware(
  handler: (req: Request, session: Session) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    let session: Session | null = null;

    try {
      // Establish RLS context
      session = await withRLSContext();

      // Call the handler with session
      return await handler(req, session);
    } catch (error) {
      console.error('❌ API request with RLS middleware failed:', error);

      // Return appropriate error response
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized') || error.message.includes('session')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized - Authentication required' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (error.message.includes('tenant context') || error.message.includes('RLS')) {
          return new Response(
            JSON.stringify({ error: 'Failed to establish tenant context' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      // Always cleanup context, even on errors
      try {
        await resetSessionContext();
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup RLS context:', cleanupError);
        // Don't throw - this is cleanup code
      }
    }
  };
}

/**
 * Middleware wrapper for optional authentication
 * Establishes RLS context if user is authenticated, but doesn't require it
 *
 * @param handler - The API handler function to wrap
 * @returns Wrapped handler function with optional RLS context
 *
 * @example
 * ```typescript
 * import { withOptionalRLSContext } from '@/lib/api-middleware';
 *
 * export const GET = withOptionalRLSContext(async (req, session) => {
 *   // session is provided if authenticated, null otherwise
 *   if (session) {
 *     // User is authenticated with RLS context set
 *   } else {
 *     // Unauthenticated request
 *   }
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function withOptionalRLSContext(
  handler: (req: Request, session: Session | null) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    let session: Session | null = null;

    try {
      // Try to establish RLS context if authenticated
      session = await requireSessionWithRLS().catch(() => null);
    } catch (error) {
      console.log('ℹ️ No session or RLS context for optional authentication');
      // Continue without session
    }

    try {
      // Call the handler with session (or null)
      return await handler(req, session);
    } catch (error) {
      console.error('❌ API request with optional RLS context failed:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      // Cleanup context only if it was established
      if (session) {
        try {
          await resetSessionContext();
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup RLS context:', cleanupError);
        }
      }
    }
  };
}

/**
 * Role-based access control middleware
 * Checks if current session has required role
 *
 * @param allowedRoles - Array of roles that can access this endpoint
 * @returns Middleware function that checks role permissions
 *
 * @example
 * ```typescript
 * import { requireRole } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   await requireRole(['admin', 'superadmin']);
 *   // ... proceed with admin operations
 * }
 * ```
 */
export async function requireRole(allowedRoles: RLSUserRole[]): Promise<Session> {
  const session = await withRLSContext();
  const userRole = session.role || 'user';

  if (!allowedRoles.includes(userRole)) {
    throw new Error(
      `Forbidden: Role '${userRole}' not allowed. Required: ${allowedRoles.join(' or ')}`
    );
  }

  console.log('✅ Role permission verified:', userRole, 'for user:', session.userId);
  return session;
}

/**
 * Admin-only access control middleware
 * Convenience function for admin endpoints
 *
 * @returns Session with admin role verified
 * @throws Error if user is not admin
 *
 * @example
 * ```typescript
 * import { requireAdmin } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   const session = await requireAdmin();
 *   // ... proceed with admin operations
 * }
 * ```
 */
export async function requireAdmin(): Promise<Session> {
  return requireRole(['admin', 'superadmin']);
}

/**
 * Superadmin-only access control middleware
 * Convenience function for superadmin endpoints
 *
 * @returns Session with superadmin role verified
 * @throws Error if user is not superadmin
 *
 * @example
 * ```typescript
 * import { requireSuperadmin } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   const session = await requireSuperadmin();
 *   // ... proceed with superadmin operations
 * }
 * ```
 */
export async function requireSuperadmin(): Promise<Session> {
  return requireRole(['superadmin']);
}

/**
 * Context restoration after errors
 * Used in error handling to ensure proper context state
 *
 * @param operation - Function to execute with context restoration
 * @returns Result of the operation
 *
 * @example
 * ```typescript
 * import { withContextRestoration } from '@/lib/api-middleware';
 *
 * const result = await withContextRestoration(async () => {
 *   // ... some operation that might fail
 *   return data;
 * });
 * ```
 */
export async function withContextRestoration<T>(
  operation: () => Promise<T>
): Promise<T> {
  // Get current context before operation
  let previousContext: { companyId: string | null; userRole: string | null } | null = null;

  try {
    // Store current context
    const [companyId, userRole] = await Promise.all([
      (await import('./rls')).getCurrentCompanyId(),
      (await import('./rls')).getCurrentUserRole()
    ]);

    previousContext = { companyId, userRole };

    // Execute operation
    return await operation();
  } catch (error) {
    console.error('❌ Operation failed, attempting context restoration:', error);

    // Try to restore previous context
    if (previousContext && previousContext.companyId && previousContext.userRole) {
      try {
        await setTenantContext(previousContext.companyId, previousContext.userRole as RLSUserRole);
        console.log('✅ Context restored after error');
      } catch (restoreError) {
        console.error('❌ Failed to restore context after error:', restoreError);
      }
    }

    throw error;
  }
}

/**
 * Cleanup middleware for request/response cycles
 * Ensures RLS context is properly reset after API operations
 *
 * @example
 * ```typescript
 * import { cleanupRLSContext } from '@/lib/api-middleware';
 *
 * export async function GET(req: Request) {
 *   try {
 *     const session = await withRLSContext();
 *     // ... API logic
 *     return Response.json({ success: true });
 *   } finally {
 *     await cleanupRLSContext();
 *   }
 * }
 * ```
 */
export async function cleanupRLSContext(): Promise<void> {
  try {
    await resetSessionContext();
  } catch (error) {
    console.error('❌ Failed to cleanup RLS context:', error);
    // Don't throw - this is cleanup code
  }
}