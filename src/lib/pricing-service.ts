/**
 * Pricing Configuration from database
 */
export interface PricingConfig {
  id: string;
  monthly_base_rate: number;
  quarterly_discount_percent: number;
  annual_discount_percent: number;
  monthly_threshold: number;
  quarterly_threshold: number;
  is_active: boolean;
  valid_from: Date;
  valid_until?: Date | null;
  created_at: Date;
  created_by?: string;
  updated_at: Date;
  updated_by?: string;
  change_reason?: string;
}

/**
 * Result of a price calculation
 */
export interface PriceCalculationResult {
  base_price: number;
  period_months: number;
  base_total: number;
  period_discount_percent: number;
  period_discount_amount: number;
  price_after_period_discount: number;
  promo_discount_percent?: number;
  promo_discount_amount?: number;
  final_price: number;
  billing_period: 'monthly' | 'quarterly' | 'annual';
  pricing_config_id: string;
  calculated_at: Date;
}

/**
 * Entry in pricing audit history
 */
export interface PricingHistoryEntry {
  id: string;
  pricing_config_id?: string;
  change_type: 'create' | 'update' | 'expire' | 'reactivate';
  changed_field?: string;
  old_value?: string;
  new_value?: string;
  change_reason?: string;
  changed_by?: string;
  changed_at: Date;
  previous_config?: Record<string, unknown>;
}

/**
 * Thresholds for determining billing periods
 */
export interface PricingThresholds {
  monthly_threshold: number;
  quarterly_threshold: number;
}

/**
 * Request to update pricing configuration
 */
export interface PricingUpdateRequest {
  monthly_base_rate?: number;
  quarterly_discount_percent?: number;
  annual_discount_percent?: number;
  monthly_threshold?: number;
  quarterly_threshold?: number;
  change_reason: string;
}

/**
 * Request to create scheduled pricing changes
 */
export interface ScheduledPricingRequest {
  pricing: PricingUpdateRequest;
  valid_from: Date;
}

/**
 * Fallback pricing configuration when database is unavailable
 */
export const FALLBACK_PRICING: PricingConfig = {
  id: 'fallback',
  monthly_base_rate: 500, // Base monthly rate in Philippine Pesos (fallback if database unavailable)
  quarterly_discount_percent: 10, // 10% discount for quarterly payments
  annual_discount_percent: 20, // 20% discount for annual payments
  monthly_threshold: 3, // Monthly threshold in PHP for billing period determination
  quarterly_threshold: 9, // Quarterly threshold in PHP for billing period determination
  is_active: true,
  valid_from: new Date('2024-01-01'),
  valid_until: null,
  created_at: new Date(),
  created_by: 'system',
  updated_at: new Date(),
  updated_by: 'system',
  change_reason: 'Fallback pricing configuration',
};
