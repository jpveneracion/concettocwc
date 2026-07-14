/**
 * Trial restriction types for graduated access control
 */

/**
 * Restriction levels for graduated access control
 */
export enum RestrictionLevel {
  NONE = 'none',           // Full access (trial active or subscribed)
  PARTIAL = 'partial',     // Can view + create past orders
  FULL = 'full'            // All operations restricted
}

/**
 * Operation types that can be restricted
 */
export enum OperationType {
  CREATE_ORDER = 'create_order',
  CREATE_QUOTE = 'create_quote',
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_PRODUCTS = 'manage_products'
}

/**
 * Result of a restriction check operation
 */
export interface RestrictionResult {
  allowed: boolean;
  operation: OperationType;
  level: RestrictionLevel;
  reason?: string;
  canBypass?: boolean;
}

/**
 * User's current restriction state
 */
export interface RestrictionState {
  level: RestrictionLevel;
  trialExpired: boolean;
  trialExpiresAt: Date | null;
  subscriptionActive: boolean;
  allowedOperations: OperationType[];
  restrictionReason?: string;
  canCreatePastOrders: boolean;
  canCreateFutureOrders: boolean;
}

/**
 * Context for specific operation validation
 */
export interface ValidationContext {
  targetDate?: Date;
  operationType?: OperationType;
  resourceId?: string;
}

/**
 * Detailed validation result with user guidance
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  level: RestrictionLevel;
  suggestion?: string;
}
