/**
 * Product types for the product review system
 */

/**
 * Product status workflow states
 */
export enum ProductStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * Product source for quote items
 */
export enum ProductSource {
  APPROVED = 'approved',
  PENDING = 'pending'
}

/**
 * Product unit type
 */
export type ProductUnit = 'sqft' | 'sqm';

/**
 * User role for permissions
 */
export type UserRole = 'user' | 'admin' | 'superadmin';

/**
 * Permission check result
 */
export interface PermissionCheck {
  canCreate: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canModify: boolean;
  canViewAllPending: boolean;
}

/**
 * Product lookup result combining approved and pending products
 */
export interface ProductLookupResult {
  id: string;
  code: string;
  description: string;
  collection: string | null;
  source: ProductSource;
  unit: ProductUnit;
}
