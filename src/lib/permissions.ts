/**
 * Role-based permission system for product management
 */

import type { UserRole, PermissionCheck } from '@/types/product';

/**
 * Get product permissions based on user role
 */
export function getProductPermissions(userRole: UserRole): PermissionCheck {
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return {
    canCreate: true, // All users can create pending products
    canApprove: isAdmin, // Only admins can approve products
    canDelete: isAdmin, // Only admins can delete products
    canModify: isAdmin, // Only admins can modify products
    canViewAllPending: isAdmin // Only admins can view all pending products
  };
}

/**
 * Check if user has specific permission
 */
export function checkPermission(
  userRole: UserRole,
  permission: keyof PermissionCheck
): boolean {
  const permissions = getProductPermissions(userRole);
  return permissions[permission];
}

/**
 * Check if user can approve products
 */
export function canApproveProducts(userRole: UserRole): boolean {
  return checkPermission(userRole, 'canApprove');
}

/**
 * Check if user can delete products
 */
export function canDeleteProducts(userRole: UserRole): boolean {
  return checkPermission(userRole, 'canDelete');
}

/**
 * Check if user can modify products
 */
export function canModifyProducts(userRole: UserRole): boolean {
  return checkPermission(userRole, 'canModify');
}

/**
 * Check if user can view all pending products
 */
export function canViewAllPendingProducts(userRole: UserRole): boolean {
  return checkPermission(userRole, 'canViewAllPending');
}

/**
 * Get user role from database
 * This function should be called in API routes to get the current user's role
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    console.log('getUserRole called for userId:', userId);
    const { sql } = await import('@/lib/db');

    const result = await sql`
      SELECT role, is_admin FROM users WHERE id = ${userId}::uuid
    `;

    console.log('Database result:', result);
    const role = result[0]?.role || 'user';
    console.log('Final role:', role);
    return role;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return 'user'; // Default to user role on error
  }
}

/**
 * Require admin access - throws error if user is not admin
 */
export async function requireAdmin(userId: string): Promise<UserRole> {
  console.log('requireAdmin called for user:', userId);
  const role = await getUserRole(userId);
  console.log('User role result:', role);

  if (role !== 'admin' && role !== 'superadmin') {
    console.log('Access denied for role:', role);
    throw new Error('Forbidden: Admin access required');
  }

  console.log('Access granted for role:', role);
  return role;
}

/**
 * Require superadmin access - throws error if user is not superadmin
 */
export async function requireSuperAdmin(userId: string): Promise<UserRole> {
  const role = await getUserRole(userId);

  if (role !== 'superadmin') {
    throw new Error('Forbidden: Superadmin access required');
  }

  return role;
}