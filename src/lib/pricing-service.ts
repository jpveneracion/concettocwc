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

// Database import
import { sql } from './db';

/**
 * Cache entry structure for PricingCacheManager
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Cache statistics interface
 */
interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * PricingCacheManager - In-memory cache for pricing data
 * Reduces database load for frequently accessed pricing configurations
 */
class PricingCacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private readonly CACHE_TTL: number = 60000; // 60 seconds
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    this.cache = new Map<string, CacheEntry<any>>();
  }

  /**
   * Get cached data if available and not expired
   * @param key - Cache key to retrieve
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      // Cache expired
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Store data in cache with timestamp
   * @param key - Cache key to store
   * @param data - Data to cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate all cached entries
   */
  invalidate(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns Cache stats object
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }
}

// Singleton instance of cache manager
const cacheManager = new PricingCacheManager();

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate pricing update request data
 * @param data - Partial pricing update request to validate
 * @returns Validation result with errors array
 */
export function validatePricingData(data: Partial<PricingUpdateRequest>): ValidationResult {
  const errors: string[] = [];

  // Validate monthly_base_rate if provided
  if (data.monthly_base_rate !== undefined) {
    if (typeof data.monthly_base_rate !== 'number' || isNaN(data.monthly_base_rate)) {
      errors.push('monthly_base_rate must be a valid number');
    } else if (data.monthly_base_rate <= 0) {
      errors.push('monthly_base_rate must be greater than 0');
    }
  }

  // Validate quarterly_discount_percent if provided
  if (data.quarterly_discount_percent !== undefined) {
    if (typeof data.quarterly_discount_percent !== 'number' || isNaN(data.quarterly_discount_percent)) {
      errors.push('quarterly_discount_percent must be a valid number');
    } else if (data.quarterly_discount_percent < 0 || data.quarterly_discount_percent > 100) {
      errors.push('quarterly_discount_percent must be between 0 and 100');
    }
  }

  // Validate annual_discount_percent if provided
  if (data.annual_discount_percent !== undefined) {
    if (typeof data.annual_discount_percent !== 'number' || isNaN(data.annual_discount_percent)) {
      errors.push('annual_discount_percent must be a valid number');
    } else if (data.annual_discount_percent < 0 || data.annual_discount_percent > 100) {
      errors.push('annual_discount_percent must be between 0 and 100');
    }
  }

  // Validate monthly_threshold if provided
  if (data.monthly_threshold !== undefined) {
    if (typeof data.monthly_threshold !== 'number' || isNaN(data.monthly_threshold)) {
      errors.push('monthly_threshold must be a valid number');
    } else if (data.monthly_threshold <= 0) {
      errors.push('monthly_threshold must be greater than 0');
    }
  }

  // Validate quarterly_threshold if provided
  if (data.quarterly_threshold !== undefined) {
    if (typeof data.quarterly_threshold !== 'number' || isNaN(data.quarterly_threshold)) {
      errors.push('quarterly_threshold must be a valid number');
    } else if (data.quarterly_threshold <= 0) {
      errors.push('quarterly_threshold must be greater than 0');
    }
  }

  // Validate logical consistency between thresholds
  if (data.monthly_threshold !== undefined && data.quarterly_threshold !== undefined) {
    if (data.quarterly_threshold <= data.monthly_threshold) {
      errors.push('quarterly_threshold must be greater than monthly_threshold');
    }
  }

  // Validate change_reason is provided
  if (!data.change_reason || typeof data.change_reason !== 'string' || data.change_reason.trim().length === 0) {
    errors.push('change_reason is required and cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse and convert database values to numbers
 * @param value - Value from database to parse
 * @param fieldName - Field name for error messages
 * @returns Parsed number rounded to 2 decimal places
 * @throws Error if value is invalid
 */
function parseDatabaseValue(value: unknown, fieldName: string): number {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} cannot be null or undefined`);
  }

  const num = typeof value === 'string' ? parseFloat(value) : Number(value);

  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  // Round to 2 decimal places for currency
  return Math.round(num * 100) / 100;
}

/**
 * Get current active pricing configuration
 * @returns Promise with current pricing config or null if none active
 */
export async function getCurrentPricing(): Promise<PricingConfig | null> {
  const cacheKey = 'current_pricing';

  // Check cache first
  const cached = cacheManager.get<PricingConfig>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await sql`
      SELECT
        id,
        monthly_base_rate,
        quarterly_discount_percent,
        annual_discount_percent,
        monthly_threshold,
        quarterly_threshold,
        is_active,
        valid_from,
        valid_until,
        created_at,
        created_by,
        updated_at,
        updated_by,
        change_reason
      FROM pricing_config
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    const config: PricingConfig = {
      id: row.id,
      monthly_base_rate: parseDatabaseValue(row.monthly_base_rate, 'monthly_base_rate'),
      quarterly_discount_percent: parseDatabaseValue(row.quarterly_discount_percent, 'quarterly_discount_percent'),
      annual_discount_percent: parseDatabaseValue(row.annual_discount_percent, 'annual_discount_percent'),
      monthly_threshold: parseDatabaseValue(row.monthly_threshold, 'monthly_threshold'),
      quarterly_threshold: parseDatabaseValue(row.quarterly_threshold, 'quarterly_threshold'),
      is_active: row.is_active,
      valid_from: new Date(row.valid_from),
      valid_until: row.valid_until ? new Date(row.valid_until) : null,
      created_at: new Date(row.created_at),
      created_by: row.created_by,
      updated_at: new Date(row.updated_at),
      updated_by: row.updated_by,
      change_reason: row.change_reason
    };

    // Cache the result
    cacheManager.set(cacheKey, config);

    return config;
  } catch (error) {
    console.error('Failed to fetch current pricing:', error);
    return null;
  }
}

/**
 * Get pricing thresholds for billing period determination
 * @returns Promise with pricing thresholds
 */
export async function getPricingThresholds(): Promise<PricingThresholds> {
  try {
    const currentPricing = await getCurrentPricing();

    if (currentPricing) {
      return {
        monthly_threshold: currentPricing.monthly_threshold,
        quarterly_threshold: currentPricing.quarterly_threshold
      };
    }

    // Fallback to hardcoded values
    return {
      monthly_threshold: FALLBACK_PRICING.monthly_threshold,
      quarterly_threshold: FALLBACK_PRICING.quarterly_threshold
    };
  } catch (error) {
    console.error('Failed to get pricing thresholds, using fallback:', error);
    return {
      monthly_threshold: FALLBACK_PRICING.monthly_threshold,
      quarterly_threshold: FALLBACK_PRICING.quarterly_threshold
    };
  }
}

/**
 * Internal helper function to calculate price using a given pricing configuration
 * @param config - Pricing configuration to use for calculation
 * @param billingPeriod - The billing period ('monthly', 'quarterly', 'annual')
 * @param promoDiscountPercent - Optional promotional discount percentage
 * @returns Price calculation result
 */
function calculatePriceInternal(
  config: PricingConfig,
  billingPeriod: 'monthly' | 'quarterly' | 'annual',
  promoDiscountPercent?: number
): PriceCalculationResult {
  // Determine period in months
  const periodMonths = billingPeriod === 'monthly' ? 1 : billingPeriod === 'quarterly' ? 3 : 12;

  // Calculate base total (before discounts)
  const base_total = Math.round(config.monthly_base_rate * periodMonths * 100) / 100;

  // Get period discount percent
  const period_discount_percent = billingPeriod === 'quarterly'
    ? config.quarterly_discount_percent
    : billingPeriod === 'annual'
      ? config.annual_discount_percent
      : 0;

  // Calculate period discount amount
  const period_discount_amount = Math.round((base_total * period_discount_percent / 100) * 100) / 100;

  // Price after period discount
  const price_after_period_discount = Math.round((base_total - period_discount_amount) * 100) / 100;

  // Calculate promo discount if provided
  let promo_discount_amount = 0;
  let final_price = price_after_period_discount;

  if (promoDiscountPercent && promoDiscountPercent > 0) {
    promo_discount_amount = Math.round((price_after_period_discount * promoDiscountPercent / 100) * 100) / 100;
    final_price = Math.round((price_after_period_discount - promo_discount_amount) * 100) / 100;
  }

  return {
    base_price: config.monthly_base_rate,
    period_months: periodMonths,
    base_total,
    period_discount_percent,
    period_discount_amount,
    price_after_period_discount,
    promo_discount_percent: promoDiscountPercent,
    promo_discount_amount: promo_discount_amount > 0 ? promo_discount_amount : undefined,
    final_price,
    billing_period: billingPeriod,
    pricing_config_id: config.id,
    calculated_at: new Date()
  };
}

/**
 * Calculate price for a given billing period and optional promo discount
 * @param billingPeriod - The billing period ('monthly', 'quarterly', 'annual')
 * @param promoDiscountPercent - Optional promotional discount percentage
 * @returns Promise with detailed price calculation result
 */
export async function calculatePrice(
  billingPeriod: 'monthly' | 'quarterly' | 'annual',
  promoDiscountPercent?: number
): Promise<PriceCalculationResult> {
  try {
    const currentPricing = await getCurrentPricing();
    const pricingConfig = currentPricing || FALLBACK_PRICING;

    return calculatePriceInternal(pricingConfig, billingPeriod, promoDiscountPercent);
  } catch (error) {
    console.error('Failed to calculate price, using fallback:', error);
    return calculateFallbackPrice(billingPeriod, promoDiscountPercent);
  }
}

/**
 * Calculate price using fallback pricing configuration
 * @param billingPeriod - The billing period ('monthly', 'quarterly', 'annual')
 * @param promoDiscountPercent - Optional promotional discount percentage
 * @returns Price calculation result using fallback pricing
 */
export function calculateFallbackPrice(
  billingPeriod: 'monthly' | 'quarterly' | 'annual',
  promoDiscountPercent?: number
): PriceCalculationResult {
  return calculatePriceInternal(FALLBACK_PRICING, billingPeriod, promoDiscountPercent);
}

/**
 * Invalidate pricing cache (call after pricing updates)
 * Forces reload of pricing configuration on next access
 */
export function invalidatePricingCache(): void {
  cacheManager.invalidate();
  console.log('Pricing cache invalidated');
}

/**
 * Create a pricing history entry
 * @param entry - History entry object with pricing details
 * @returns Promise with history entry ID
 */
async function createPricingHistoryEntry(
  entry: {
    pricing_config_id?: string;
    change_type: 'create' | 'update' | 'expire' | 'reactivate';
    changed_field?: string;
    old_value?: string;
    new_value?: string;
    change_reason?: string;
    changed_by?: string;
    previous_config?: Record<string, unknown>;
  }
): Promise<string> {
  const result = await sql`
    INSERT INTO pricing_history (
      pricing_config_id,
      change_type,
      changed_field,
      old_value,
      new_value,
      change_reason,
      changed_by,
      previous_config
    ) VALUES (
      ${entry.pricing_config_id || null},
      ${entry.change_type},
      ${entry.changed_field || null},
      ${entry.old_value || null},
      ${entry.new_value || null},
      ${entry.change_reason || null},
      ${entry.changed_by || null},
      ${entry.previous_config ? JSON.stringify(entry.previous_config) : null}
    )
    RETURNING id
  `;

  return result[0].id;
}

/**
 * Get pricing history entries with pagination and filtering
 * @param options - Query options for pagination and filtering
 * @returns Promise with array of pricing history entries
 */
export async function getPricingHistory(options: {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<PricingHistoryEntry[]> {
  const { limit = 100, offset = 0, startDate, endDate } = options;

  try {
    let whereClause = '';
    const params: (string | number | Date)[] = [limit, offset];
    let paramIndex = 3;

    if (startDate) {
      whereClause += ` AND changed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND changed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT
        id,
        pricing_config_id,
        change_type,
        changed_field,
        old_value,
        new_value,
        change_reason,
        changed_by,
        changed_at,
        previous_config
      FROM pricing_history
      WHERE 1=1${whereClause}
      ORDER BY changed_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await sql(query, params);

    return result.map(row => ({
      id: row.id,
      pricing_config_id: row.pricing_config_id || undefined,
      change_type: row.change_type as 'create' | 'update' | 'expire' | 'reactivate',
      changed_field: row.changed_field || undefined,
      old_value: row.old_value || undefined,
      new_value: row.new_value || undefined,
      change_reason: row.change_reason || undefined,
      changed_by: row.changed_by || undefined,
      changed_at: new Date(row.changed_at),
      previous_config: row.previous_config ? typeof row.previous_config === 'string'
        ? JSON.parse(row.previous_config)
        : row.previous_config
        : undefined
    }));
  } catch (error) {
    console.error('Failed to fetch pricing history:', error);
    return [];
  }
}

/**
 * Update pricing configuration with audit trail
 * @param updates - Pricing update request with changes to apply
 * @param adminUserId - ID of the admin user making the change
 * @returns Promise with updated pricing configuration
 */
export async function updatePricing(
  updates: PricingUpdateRequest,
  adminUserId: string
): Promise<PricingConfig> {
  // Validate input data
  const validation = validatePricingData(updates);
  if (!validation.valid) {
    throw new Error(`Invalid pricing data: ${validation.errors.join(', ')}`);
  }

  // Start transaction
  await sql`BEGIN`;

  try {
    // Get current pricing configuration
    const currentResult = await sql`
      SELECT
        id,
        monthly_base_rate,
        quarterly_discount_percent,
        annual_discount_percent,
        monthly_threshold,
        quarterly_threshold,
        is_active,
        valid_from,
        valid_until,
        created_at,
        created_by,
        updated_at,
        updated_by,
        change_reason
      FROM pricing_config
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    if (!currentResult || currentResult.length === 0) {
      await sql`ROLLBACK`;
      throw new Error('No active pricing configuration found');
    }

    const currentConfig = currentResult[0];
    const currentConfigId = currentConfig.id;

    // Create history entry with current config snapshot
    const previousConfigSnapshot: Record<string, unknown> = {
      monthly_base_rate: parseFloat(currentConfig.monthly_base_rate),
      quarterly_discount_percent: parseFloat(currentConfig.quarterly_discount_percent),
      annual_discount_percent: parseFloat(currentConfig.annual_discount_percent),
      monthly_threshold: parseFloat(currentConfig.monthly_threshold),
      quarterly_threshold: parseFloat(currentConfig.quarterly_threshold),
      is_active: currentConfig.is_active,
      valid_from: currentConfig.valid_from,
      valid_until: currentConfig.valid_until
    };

    await createPricingHistoryEntry({
      pricing_config_id: currentConfigId,
      change_type: 'update',
      change_reason: updates.change_reason,
      changed_by: adminUserId,
      previous_config: previousConfigSnapshot,
      old_value: JSON.stringify(previousConfigSnapshot),
      new_value: JSON.stringify(updates)
    });

    // Update pricing configuration
    const updateResult = await sql`
      UPDATE pricing_config
      SET
        monthly_base_rate = COALESCE(${updates.monthly_base_rate || null}, monthly_base_rate),
        quarterly_discount_percent = COALESCE(${updates.quarterly_discount_percent || null}, quarterly_discount_percent),
        annual_discount_percent = COALESCE(${updates.annual_discount_percent || null}, annual_discount_percent),
        monthly_threshold = COALESCE(${updates.monthly_threshold || null}, monthly_threshold),
        quarterly_threshold = COALESCE(${updates.quarterly_threshold || null}, quarterly_threshold),
        updated_at = NOW(),
        updated_by = ${adminUserId},
        change_reason = ${updates.change_reason}
      WHERE id = ${currentConfigId}
      RETURNING
        id,
        monthly_base_rate,
        quarterly_discount_percent,
        annual_discount_percent,
        monthly_threshold,
        quarterly_threshold,
        is_active,
        valid_from,
        valid_until,
        created_at,
        created_by,
        updated_at,
        updated_by,
        change_reason
    `;

    // Commit transaction
    await sql`COMMIT`;

    // Invalidate cache
    cacheManager.invalidate();

    const row = updateResult[0];
    return {
      id: row.id,
      monthly_base_rate: parseDatabaseValue(row.monthly_base_rate, 'monthly_base_rate'),
      quarterly_discount_percent: parseDatabaseValue(row.quarterly_discount_percent, 'quarterly_discount_percent'),
      annual_discount_percent: parseDatabaseValue(row.annual_discount_percent, 'annual_discount_percent'),
      monthly_threshold: parseDatabaseValue(row.monthly_threshold, 'monthly_threshold'),
      quarterly_threshold: parseDatabaseValue(row.quarterly_threshold, 'quarterly_threshold'),
      is_active: row.is_active,
      valid_from: new Date(row.valid_from),
      valid_until: row.valid_until ? new Date(row.valid_until) : null,
      created_at: new Date(row.created_at),
      created_by: row.created_by,
      updated_at: new Date(row.updated_at),
      updated_by: row.updated_by,
      change_reason: row.change_reason
    };
  } catch (error) {
    // Rollback on error
    await sql`ROLLBACK`;
    throw error;
  }
}

/**
 * Get all pricing configurations (active and scheduled)
 * @returns Promise with array of all pricing configurations ordered by valid_from DESC
 */
export async function getAllPricingConfigs(): Promise<PricingConfig[]> {
  try {
    const result = await sql`
      SELECT
        id,
        monthly_base_rate,
        quarterly_discount_percent,
        annual_discount_percent,
        monthly_threshold,
        quarterly_threshold,
        is_active,
        valid_from,
        valid_until,
        created_at,
        created_by,
        updated_at,
        updated_by,
        change_reason
      FROM pricing_config
      ORDER BY valid_from DESC
    `;

    return result.map(row => ({
      id: row.id,
      monthly_base_rate: parseDatabaseValue(row.monthly_base_rate, 'monthly_base_rate'),
      quarterly_discount_percent: parseDatabaseValue(row.quarterly_discount_percent, 'quarterly_discount_percent'),
      annual_discount_percent: parseDatabaseValue(row.annual_discount_percent, 'annual_discount_percent'),
      monthly_threshold: parseDatabaseValue(row.monthly_threshold, 'monthly_threshold'),
      quarterly_threshold: parseDatabaseValue(row.quarterly_threshold, 'quarterly_threshold'),
      is_active: row.is_active,
      valid_from: new Date(row.valid_from),
      valid_until: row.valid_until ? new Date(row.valid_until) : null,
      created_at: new Date(row.created_at),
      created_by: row.created_by,
      updated_at: new Date(row.updated_at),
      updated_by: row.updated_by,
      change_reason: row.change_reason
    }));
  } catch (error) {
    console.error('Failed to fetch all pricing configs:', error);
    return [];
  }
}

/**
 * Rollback pricing configuration to a previous state
 * @param historyId - History entry ID to rollback to
 * @param adminUserId - ID of the admin user performing the rollback
 * @param reason - Reason for the rollback
 * @returns Promise with restored pricing configuration
 */
export async function rollbackPricing(
  historyId: string,
  adminUserId: string,
  reason: string
): Promise<PricingConfig> {
  // Start transaction
  await sql`BEGIN`;

  try {
    // Fetch history entry with previous config
    const historyResult = await sql`
      SELECT
        id,
        pricing_config_id,
        change_type,
        previous_config,
        change_reason
      FROM pricing_history
      WHERE id = ${historyId}
    `;

    if (!historyResult || historyResult.length === 0) {
      await sql`ROLLBACK`;
      throw new Error('History entry not found');
    }

    const historyEntry = historyResult[0];

    if (!historyEntry.previous_config) {
      await sql`ROLLBACK`;
      throw new Error('No previous configuration found in history entry');
    }

    const previousConfig = typeof historyEntry.previous_config === 'string'
      ? JSON.parse(historyEntry.previous_config)
      : historyEntry.previous_config;

    // Get current active config
    const currentResult = await sql`
      SELECT id, change_reason
      FROM pricing_config
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    if (!currentResult || currentResult.length === 0) {
      await sql`ROLLBACK`;
      throw new Error('No active pricing configuration found');
    }

    const currentConfigId = currentResult[0].id;

    // Create history entry for current config before rollback
    await createPricingHistoryEntry({
      pricing_config_id: currentConfigId,
      change_type: 'update',
      change_reason: `Rollback: ${reason}`,
      changed_by: adminUserId,
      previous_config: { rollback_from_history_id: historyId }
    });

    // Restore previous config
    const updateResult = await sql`
      UPDATE pricing_config
      SET
        monthly_base_rate = ${previousConfig.monthly_base_rate},
        quarterly_discount_percent = ${previousConfig.quarterly_discount_percent},
        annual_discount_percent = ${previousConfig.annual_discount_percent},
        monthly_threshold = ${previousConfig.monthly_threshold},
        quarterly_threshold = ${previousConfig.quarterly_threshold},
        updated_at = NOW(),
        updated_by = ${adminUserId},
        change_reason = ${`Rollback to ${new Date(historyEntry.changed_at).toISOString()}: ${reason}`}
      WHERE id = ${currentConfigId}
      RETURNING
        id,
        monthly_base_rate,
        quarterly_discount_percent,
        annual_discount_percent,
        monthly_threshold,
        quarterly_threshold,
        is_active,
        valid_from,
        valid_until,
        created_at,
        created_by,
        updated_at,
        updated_by,
        change_reason
    `;

    // Commit transaction
    await sql`COMMIT`;

    // Invalidate cache
    cacheManager.invalidate();

    const row = updateResult[0];
    return {
      id: row.id,
      monthly_base_rate: parseDatabaseValue(row.monthly_base_rate, 'monthly_base_rate'),
      quarterly_discount_percent: parseDatabaseValue(row.quarterly_discount_percent, 'quarterly_discount_percent'),
      annual_discount_percent: parseDatabaseValue(row.annual_discount_percent, 'annual_discount_percent'),
      monthly_threshold: parseDatabaseValue(row.monthly_threshold, 'monthly_threshold'),
      quarterly_threshold: parseDatabaseValue(row.quarterly_threshold, 'quarterly_threshold'),
      is_active: row.is_active,
      valid_from: new Date(row.valid_from),
      valid_until: row.valid_until ? new Date(row.valid_until) : null,
      created_at: new Date(row.created_at),
      created_by: row.created_by,
      updated_at: new Date(row.updated_at),
      updated_by: row.updated_by,
      change_reason: row.change_reason
    };
  } catch (error) {
    // Rollback on error
    await sql`ROLLBACK`;
    throw error;
  }
}
