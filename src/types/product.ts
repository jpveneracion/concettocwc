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
 * Pending product awaiting admin approval
 */
export interface PendingProduct {
  id: string;
  company_id: string;
  code: string;
  collection: string | null;
  description: string;
  unit: ProductUnit;
  status: ProductStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
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

/**
 * Request to create pending product
 */
export interface CreatePendingProductRequest {
  code: string;
  collection?: string;
  description: string;
  unit?: ProductUnit;
}

/**
 * Request to approve pending product
 */
export interface ApproveProductRequest {
  pending_product_id: string;
  review_notes?: string;
}

/**
 * Request to reject pending product
 */
export interface RejectProductRequest {
  pending_product_id: string;
  review_notes?: string;
}

/**
 * Pending products list response
 */
export interface PendingProductListResponse {
  products: PendingProduct[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Product review statistics for admin dashboard
 */
export interface ProductReviewStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  duplicateCodes: string[];
}
