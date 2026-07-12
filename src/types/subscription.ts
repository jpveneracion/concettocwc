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
  paymongo_plan_id: string;
  features: Record<string, any>;
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
  user_id: number;
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
  plan: SubscriptionPlan;
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
  plan: any; // Can be either LegacySubscriptionPlan or new plan type
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
  payload: Record<string, any>;
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
