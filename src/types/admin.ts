// src/types/admin.ts

// Import subscription types for admin management
import type {
  SubscriptionPlan,
  SubscriptionPlanFeatures,
  SubscriptionPlanStatus,
  SubscriptionPlanInterval
} from './subscription';

/**
 * Admin user information from authentication system
 */
export interface AdminUser {
  isAdmin: boolean;
  adminRole?: 'admin' | 'superadmin';
  adminEmail?: string;
}

/**
 * Admin notification data structure
 */
export interface AdminNotifications {
  pendingApprovals: number;
  systemAlerts: string[];
  unreadCount: number;
}

/**
 * Admin quick action configuration
 */
export interface AdminQuickAction {
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

/**
 * Admin layout component props
 */
export interface AdminLayoutProps {
  children: React.ReactNode;
}

// ============================================================================
// ADMIN SUBSCRIPTION PLAN MANAGEMENT TYPES
// ============================================================================

/**
 * Admin subscription plan management interface
 */
export interface AdminSubscriptionPlanManagement {
  plans: SubscriptionPlan[];
  selected_plan?: SubscriptionPlan;
  filters: SubscriptionPlanFilters;
  stats: AdminSubscriptionPlanOverview;
  ui_state: AdminUIState;
}

/**
 * Subscription plan filters for admin interface
 */
export interface SubscriptionPlanFilters {
  status: SubscriptionPlanStatusFilter;
  interval: SubscriptionPlanIntervalFilter;
  price_range: PriceRangeFilter;
  search_query: string;
  sort_by: AdminSortOption;
  show_archived: boolean;
}

/**
 * Subscription plan status filter options
 */
export type SubscriptionPlanStatusFilter = 'all' | 'active' | 'inactive' | 'draft' | 'archived';

/**
 * Subscription plan interval filter options
 */
export type SubscriptionPlanIntervalFilter = 'all' | 'monthly' | 'quarterly' | 'annual';

/**
 * Price range filter structure
 */
export interface PriceRangeFilter {
  enabled: boolean;
  min_price?: number;
  max_price?: number;
  currency: string;
}

/**
 * Admin sort options for subscription plans
 */
export type AdminSortOption = 'name' | 'price_asc' | 'price_desc' | 'created_at' | 'updated_at' | 'popularity';

/**
 * Admin subscription plan overview statistics
 */
export interface AdminSubscriptionPlanOverview {
  total_plans: number;
  active_plans: number;
  total_subscribers: number;
  total_revenue: number;
  revenue_change: number;
  subscriber_change: number;
  popular_plans: PopularPlan[];
  recent_activity: AdminActivityItem[];
}

/**
 * Popular plan summary
 */
export interface PopularPlan {
  plan_id: string;
  plan_name: string;
  subscriber_count: number;
  revenue: number;
  growth_rate: number;
}

/**
 * Admin activity item for recent activity feed
 */
export interface AdminActivityItem {
  id: string;
  activity_type: 'plan_created' | 'plan_updated' | 'plan_deleted' | 'plan_archived' | 'subscriber_joined' | 'subscriber_cancelled';
  description: string;
  performed_by: string;
  timestamp: Date;
  entity_id: string;
  metadata?: Record<string, unknown>;
}

/**
 * Admin UI state management
 */
export interface AdminUIState {
  loading: boolean;
  error: string | null;
  selected_view: AdminView;
  modal_state: AdminModalState;
  sidebar_expanded: boolean;
  notifications: AdminNotificationState;
}

/**
 * Admin view options
 */
export type AdminView = 'plans' | 'subscribers' | 'analytics' | 'settings' | 'activity';

/**
 * Admin modal state
 */
export interface AdminModalState {
  is_open: boolean;
  modal_type: 'create_plan' | 'edit_plan' | 'delete_plan' | 'duplicate_plan' | 'view_stats' | null;
  modal_data?: SubscriptionPlan;
}

/**
 * Admin notification state
 */
export interface AdminNotificationState {
  unread_count: number;
  notifications: AdminNotification[];
  show_notifications: boolean;
}

/**
 * Admin notification structure
 */
export interface AdminNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action_url?: string;
  action_label?: string;
}

/**
 * Admin permission matrix for subscription plan operations
 */
export interface AdminSubscriptionPermissions {
  can_create_plans: boolean;
  can_edit_plans: boolean;
  can_delete_plans: boolean;
  can_archive_plans: boolean;
  can_view_analytics: boolean;
  can_manage_subscribers: boolean;
  can_change_pricing: boolean;
  can_modify_features: boolean;
  can_export_data: boolean;
  can_view_revenue: boolean;
  restricted_actions?: string[];
}

/**
 * Admin action result for subscription plan operations
 */
export interface AdminActionResult {
  success: boolean;
  action_performed: AdminActionType;
  entity_id: string;
  message: string;
  errors?: string[];
  timestamp: Date;
  performed_by: string;
}

/**
 * Admin action types for audit trail
 */
export type AdminActionType =
  | 'create_plan'
  | 'update_plan'
  | 'delete_plan'
  | 'archive_plan'
  | 'restore_plan'
  | 'change_price'
  | 'update_features'
  | 'change_status'
  | 'duplicate_plan'
  | 'export_plans'
  | 'bulk_update';

/**
 * Admin bulk operation request
 */
export interface AdminBulkOperationRequest {
  operation: 'activate' | 'deactivate' | 'archive' | 'delete' | 'update_pricing' | 'update_features';
  plan_ids: string[];
  update_data?: {
    new_price?: number;
    new_features?: SubscriptionPlanFeatures;
    status?: SubscriptionPlanStatus;
  };
  reason?: string;
}

/**
 * Admin bulk operation result
 */
export interface AdminBulkOperationResult {
  success_count: number;
  failure_count: number;
  total_count: number;
  results: BulkOperationItem[];
  errors: BulkOperationError[];
  performed_by: string;
  timestamp: Date;
}

/**
 * Individual bulk operation item result
 */
export interface BulkOperationItem {
  plan_id: string;
  plan_name: string;
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Bulk operation error
 */
export interface BulkOperationError {
  plan_id: string;
  error_message: string;
  error_code: string;
}