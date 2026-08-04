/**
 * Unified role type definitions for the application
 * Standardizes role handling across database, RLS, and application layers
 */

// Database role format (with underscore for super_admin)
export type DatabaseRole = 'user' | 'admin' | 'super_admin';

// RLS role format (without underscore for superadmin)
export type RLSUserRole = 'user' | 'admin' | 'superadmin';

/**
 * Normalize database role to RLS role format
 * Maps 'super_admin' (database) to 'superadmin' (RLS)
 */
export function normalizeRoleForRLS(dbRole: DatabaseRole | string | null | undefined): RLSUserRole {
  const role = dbRole?.toLowerCase() || 'user';

  // Map database 'super_admin' to RLS 'superadmin'
  if (role === 'super_admin') {
    return 'superadmin';
  }

  // Validate role is allowed
  if (role === 'admin' || role === 'user' || role === 'superadmin') {
    return role as RLSUserRole;
  }

  // Default to 'user' for any unknown role
  return 'user';
}

/**
 * Validate if a role string is a valid database role
 */
export function isValidDatabaseRole(role: string): role is DatabaseRole {
  return ['user', 'admin', 'super_admin'].includes(role);
}

/**
 * Validate if a role string is a valid RLS role
 */
export function isValidRLSUserRole(role: string): role is RLSUserRole {
  return ['user', 'admin', 'superadmin'].includes(role);
}