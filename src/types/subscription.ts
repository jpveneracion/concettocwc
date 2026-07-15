// src/types/subscription.ts

// ============================================================================
// NEW TRIAL SYSTEM TYPES
// ============================================================================

/**
 * Payment method enumeration
 */
export enum PaymentMethod {
  GCASH = 'gcash',
  CRYPTO = 'crypto',
  USD_BANK = 'usd_bank',
  OTHER = 'other'
}

/**
 * Subscription plan enumeration
 */
export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual'
}

/**
 * Account status enumeration
 */
export enum AccountStatus {
  TRIAL_ACTIVE = 'trial_active',
  SUBSCRIPTION_ACTIVE = 'subscription_active',
  LOCKED = 'locked'
}

// ============================================================================
// LEGACY PAYMONGO SUBSCRIPTION TYPES (For backward compatibility)
// ============================================================================

/**
 * Legacy subscription plan interface (PayMongo system)
 */
export interface LegacySubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  features: Record<string, number | boolean | string>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Legacy subscription interface (PayMongo system)
 */
export interface LegacySubscription {
  id: string;
  company_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'suspended';
  plan_id: string;
  trial_end: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  paymongo_subscription_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Activation code interface
 */
export interface ActivationCode {
  id: number;
  code: string;
  discount_percent: number;
  applicable_plans: SubscriptionPlan[];

  // Payment tracking
  payment_amount?: number;
  payment_currency: string;
  payment_amount_usd?: number;
  payment_method?: PaymentMethod;
  exchange_rate?: number;
  payment_reference?: string;
  payment_date?: Date;
  wallet_address?: string;
  bank_reference?: string;

  // Lifecycle tracking
  created_by?: number;
  created_at: Date;
  expires_at?: Date;
  used_by?: number;
  used_at?: Date;
  used_ip_address?: string;
  is_active: boolean;

  // Campaign tracking
  campaign_name?: string;
  notes?: string;
  status_history: StatusHistoryEntry[];
}

/**
 * Status history entry for audit trail
 */
export interface StatusHistoryEntry {
  status: string;
  timestamp: Date;
  note?: string;
  ip_address?: string;
}

/**
 * Trial status response
 */
export interface TrialStatusResponse {
  trial_active: boolean;
  trial_days_remaining: number;
  trial_expires_at: string;
  subscription_activated: boolean;
  requires_activation: boolean;
  has_access: boolean;
  discount_percent?: number;
  subscription_plan?: SubscriptionPlan;
  account_status: AccountStatus;
}

/**
 * Activation code generation request
 */
export interface GenerateActivationCodeRequest {
  discount_percent: number;
  applicable_plans: SubscriptionPlan[];
  payment_amount: number;
  payment_method: PaymentMethod;
  payment_currency: string;
  payment_reference: string;
  expires_at?: Date;
  campaign_name?: string;
  notes?: string;
}

/**
 * Activation code redemption request
 */
export interface RedeemActivationCodeRequest {
  code: string;
  subscription_plan: SubscriptionPlan;
}

/**
 * Subscription info for user
 */
export interface UserSubscriptionInfo {
  user_id: string; // UUID in database
  trial_expires_at?: Date;
  subscription_activated: boolean;
  activation_code?: string;
  discount_percent?: number;
  subscription_plan?: SubscriptionPlan;
  account_status: AccountStatus;
  has_access: boolean;
}

/**
 * Dashboard analytics data
 */
export interface DashboardAnalytics {
  total_gcash_payments: number;
  total_crypto_payments: number;
  total_usd_payments: number;
  active_subscriptions: number;
  pending_codes: number;
  average_revenue_per_user: number;
  trial_to_conversion_rate: number;
  payment_method_distribution: PaymentMethodStats[];
  discount_distribution: DiscountStats[];
  plan_distribution: PlanStats[];
  revenue_over_time: RevenueDataPoint[];
  activation_usage_over_time: UsageDataPoint[];
}

/**
 * Payment method statistics
 */
export interface PaymentMethodStats {
  method: PaymentMethod;
  amount: number;
  count: number;
  percentage: number;
}

/**
 * Discount tier statistics
 */
export interface DiscountStats {
  discount_percent: number;
  count: number;
  total_amount: number;
}

/**
 * Plan type statistics
 */
export interface PlanStats {
  plan: SubscriptionPlanDetails;
  count: number;
  revenue: number;
  percentage: number;
}

/**
 * Revenue data point for charts
 */
export interface RevenueDataPoint {
  date: string;
  gcash: number;
  crypto: number;
  usd: number;
  total: number;
}

/**
 * Usage data point for charts
 */
export interface UsageDataPoint {
  date: string;
  generated: number;
  used: number;
  pending: number;
}

// ============================================================================
// ADDITIONAL LEGACY TYPES (For backward compatibility)
// ============================================================================

/**
 * Legacy subscription access interface
 */
export interface SubscriptionAccess {
  allowed: boolean;
  mode: 'full' | 'readonly' | 'denied';
  reason?: string;
  subscription?: SubscriptionDetails;
}

/**
 * Subscription details interface
 */
export interface SubscriptionDetails {
  plan: LegacySubscriptionPlan; // Legacy subscription plan details
  status: string;
  trial_end: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  usage_stats: {
    quotes_created_this_period: number;
    quotes_remaining: number;
  };
}

/**
 * PayMongo checkout request interface
 */
export interface PayMongoCheckoutRequest {
  plan_id: string;
  success_url: string;
  cancel_url: string;
}

/**
 * PayMongo checkout response interface
 */
export interface PayMongoCheckoutResponse {
  checkout_url: string;
  session_id: string;
}

/**
 * Payment method type for legacy system
 */
export interface LegacyPaymentMethod {
  id: string;
  company_id: string;
  paymongo_payment_method_id: string;
  type: 'gcash' | 'maya' | 'card';
  card_last4: string | null;
  expiry_date: Date | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Webhook event interface
 */
export interface WebhookEvent {
  id: string;
  event_type: string;
  paymongo_event_id: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processing_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Invoice interface
 */
export interface Invoice {
  id: string;
  subscription_id: string;
  company_id: string;
  number: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  paid_at: Date | null;
  attempt_count: number;
  paymongo_invoice_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// ADMIN SUBSCRIPTION PLAN MANAGEMENT TYPES
// ============================================================================

/**
 * Subscription plan interval enumeration
 */
export enum SubscriptionPlanInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual'
}

/**
 * Subscription plan status enumeration
 */
export enum SubscriptionPlanStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  DRAFT = 'draft'
}

/**
 * Subscription plan features structure (stored as JSON in database)
 */
export interface SubscriptionPlanFeatures {
  // Quote limits
  max_quotes_per_period?: number;
  max_quotes_total?: number;

  // User/seat limits
  max_users?: number;
  max_concurrent_users?: number;

  // Storage limits
  max_storage_mb?: number;
  max_attachments_per_quote?: number;

  // Feature flags
  custom_templates?: boolean;
  api_access?: boolean;
  advanced_analytics?: boolean;
  white_labeling?: boolean;
  priority_support?: boolean;
  custom_integrations?: boolean;

  // Billing features
  trial_days?: number;
  discount_percentage?: number;
  cancellation_policy?: string;

  // Additional features (flexible JSON structure)
  additional_features?: Record<string, boolean | number | string>;
}

/**
 * Database model for subscription plans
 */
export interface SubscriptionPlanDetails {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: SubscriptionPlanInterval;
  discount_percent: number;
  features: SubscriptionPlanFeatures;
  status: SubscriptionPlanStatus;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Create subscription plan request payload
 */
export interface CreateSubscriptionPlanRequest {
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: SubscriptionPlanInterval;
  discount_percent: number;
  features: SubscriptionPlanFeatures;
  status?: SubscriptionPlanStatus;
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Update subscription plan request payload (partial updates)
 */
export interface UpdateSubscriptionPlanRequest {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  interval?: SubscriptionPlanInterval;
  discount_percent?: number;
  features?: Partial<SubscriptionPlanFeatures>;
  status?: SubscriptionPlanStatus;
  is_active?: boolean;
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Subscription plan list filters for API queries
 */
export interface SubscriptionPlanListFilters {
  status?: SubscriptionPlanStatus;
  is_active?: boolean;
  interval?: SubscriptionPlanInterval;
  search?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  sort_by?: 'name' | 'price' | 'created_at' | 'sort_order';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Subscription plan API response (single plan)
 */
export interface SubscriptionPlanResponse {
  success: boolean;
  data: SubscriptionPlanDetails;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Subscription plan list API response
 */
export interface SubscriptionPlanListResponse {
  success: boolean;
  data: SubscriptionPlan[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Subscription plan operation result (CRUD operations)
 */
export interface SubscriptionPlanOperationResponse {
  success: boolean;
  data?: SubscriptionPlan;
  message?: string;
  errors?: Record<string, string[]>;
  operation: 'create' | 'update' | 'delete' | 'archive';
}

/**
 * Admin subscription plan statistics
 */
export interface AdminSubscriptionPlanStats {
  total_plans: number;
  active_plans: number;
  draft_plans: number;
  archived_plans: number;
  total_subscribers: number;
  total_revenue: number;
  revenue_by_plan: PlanRevenueStats[];
  subscriber_distribution: PlanDistributionStats[];
  conversion_rates: ConversionRateStats;
}

/**
 * Plan revenue statistics
 */
export interface PlanRevenueStats {
  plan_id: string;
  plan_name: string;
  revenue: number;
  subscriber_count: number;
  average_revenue_per_subscriber: number;
  period: 'monthly' | 'quarterly' | 'annual';
}

/**
 * Plan distribution statistics
 */
export interface PlanDistributionStats {
  plan_id: string;
  plan_name: string;
  subscriber_count: number;
  percentage: number;
  interval: SubscriptionPlanInterval;
}

/**
 * Conversion rate statistics
 */
export interface ConversionRateStats {
  trial_to_paid: number;
  plan_upgrades: number;
  plan_downgrades: number;
  cancellations: number;
  reactivations: number;
}

/**
 * Subscription plan usage analytics data
 */
export interface SubscriptionPlanUsageData {
  plan_id: string;
  plan_name: string;
  usage_metrics: {
    total_quotes_created: number;
    total_users_active: number;
    average_quotes_per_user: number;
    storage_used_mb: number;
    api_calls_count: number;
  };
  period_start: Date;
  period_end: Date;
  trends: UsageTrendData[];
}

/**
 * Usage trend data point
 */
export interface UsageTrendData {
  date: Date;
  metric_name: string;
  value: number;
  change_percent?: number;
}

/**
 * Subscription plan validation result
 */
export interface SubscriptionPlanValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validated_fields: ValidatedField[];
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

/**
 * Validation warning structure
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

/**
 * Validated field information
 */
export interface ValidatedField {
  field: string;
  value: unknown;
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// UI COMPONENT PROP TYPES
// ============================================================================

/**
 * Subscription plan list component props
 */
export interface SubscriptionPlanListProps {
  plans: SubscriptionPlanDetails[];
  isLoading?: boolean;
  filters?: SubscriptionPlanListFilters;
  onFilterChange?: (filters: SubscriptionPlanListFilters) => void;
  onPlanSelect?: (plan: SubscriptionPlanDetails) => void;
  onPlanEdit?: (plan: SubscriptionPlanDetails) => void;
  onPlanDelete?: (plan: SubscriptionPlanDetails) => void;
  onPlanDuplicate?: (plan: SubscriptionPlanDetails) => void;
  onPlanCreate?: () => void;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  onPageChange?: (page: number) => void;
}

/**
 * Subscription plan form component props
 */
export interface SubscriptionPlanFormProps {
  mode: 'create' | 'edit';
  initialData?: SubscriptionPlanDetails;
  onSubmit: (data: CreateSubscriptionPlanRequest | UpdateSubscriptionPlanRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  validationErrors?: Record<string, string[]>;
  availableFeatures?: string[];
}

/**
 * Subscription plan card component props
 */
export interface SubscriptionPlanCardProps {
  plan: SubscriptionPlanDetails;
  isSelected?: boolean;
  isComparable?: boolean;
  onSelect?: (plan: SubscriptionPlanDetails) => void;
  onEdit?: (plan: SubscriptionPlanDetails) => void;
  onDelete?: (plan: SubscriptionPlanDetails) => void;
  onDuplicate?: (plan: SubscriptionPlanDetails) => void;
  showFeatures?: boolean;
  showStats?: boolean;
  comparisonPlans?: SubscriptionPlanDetails[];
  highlightDifferences?: boolean;
}

/**
 * Subscription plan comparison component props
 */
export interface SubscriptionPlanComparisonProps {
  plans: SubscriptionPlanDetails[];
  highlightedPlanId?: string;
  onPlanSelect?: (plan: SubscriptionPlanDetails) => void;
  showOnlyDifferences?: boolean;
  groupFeatures?: boolean;
}

/**
 * Subscription plan feature editor component props
 */
export interface SubscriptionPlanFeatureEditorProps {
  features: SubscriptionPlanFeatures;
  onChange: (features: SubscriptionPlanFeatures) => void;
  availableFeatures?: FeatureDefinition[];
  readOnly?: boolean;
  validationErrors?: Record<string, string[]>;
}

/**
 * Feature definition for the feature editor
 */
export interface FeatureDefinition {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  description?: string;
  category?: string;
  options?: string[]; // for select type
  default_value?: boolean | number | string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// ============================================================================
// UTILITY TYPES AND TYPE GUARDS
// ============================================================================

/**
 * Type guard for subscription plan
 */
export function isSubscriptionPlan(obj: unknown): obj is SubscriptionPlanDetails {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'description' in obj &&
    'price' in obj &&
    'currency' in obj &&
    'interval' in obj &&
    'features' in obj
  );
}

/**
 * Type guard for subscription plan features
 */
export function isSubscriptionPlanFeatures(obj: unknown): obj is SubscriptionPlanFeatures {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('max_quotes_per_period' in obj || 'max_users' in obj || 'custom_templates' in obj)
  );
}

/**
 * Type guard for create subscription plan request
 */
export function isCreateSubscriptionPlanRequest(obj: unknown): obj is CreateSubscriptionPlanRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'description' in obj &&
    'price' in obj &&
    'currency' in obj &&
    'interval' in obj &&
    'features' in obj
  );
}

/**
 * Extract common plan fields from various plan types
 */
export type CommonPlanFields = Pick<SubscriptionPlanDetails,
  'id' | 'name' | 'description' | 'price' | 'currency' | 'interval' | 'discount_percent'
>;

/**
 * Plan summary type for display purposes
 */
export type SubscriptionPlanSummary = Pick<SubscriptionPlanDetails,
  'id' | 'name' | 'description' | 'price' | 'currency' | 'interval' | 'discount_percent' | 'is_active'
> & {
  subscriber_count?: number;
  revenue?: number;
};

/**
 * Plan update history entry
 */
export interface PlanUpdateHistoryEntry {
  id: string;
  plan_id: string;
  changed_by: string;
  changed_at: Date;
  changes: PlanChange[];
  reason?: string;
}

/**
 * Individual plan change
 */
export interface PlanChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}
