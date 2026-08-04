// src/lib/subscription-plans.ts

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

/**
 * Subscription plan error interface for better error handling
 */
export interface SubscriptionPlanError extends Error {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'OPERATION_FAILED' | 'INVALID_INTERVAL';
  mobileMessage: string;
  details?: Record<string, unknown>;
}

class SubscriptionPlanErrorImpl extends Error implements SubscriptionPlanError {
  code: SubscriptionPlanError['code'];
  mobileMessage: string;
  details?: Record<string, unknown>;

  constructor(
    code: SubscriptionPlanError['code'],
    message: string,
    mobileMessage: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SubscriptionPlanError';
    this.code = code;
    this.mobileMessage = mobileMessage;
    this.details = details;
  }
}

/**
 * Database subscription plan record interface (matches actual database schema)
 */
export interface SubscriptionPlanRecord {
  id: string; // UUID
  name: string;
  price: string; // DECIMAL in database comes as string
  currency: string;
  interval: string;
  features: Record<string, unknown>; // JSONB from database
  created_at: string; // TIMESTAMPTZ comes as string
  updated_at: string; // TIMESTAMPTZ comes as string
}

/**
 * Create subscription plan input interface
 */
export interface CreateSubscriptionPlanInput {
  name: string;
  description?: string;
  base_monthly_price?: number;
  price: number;
  currency?: string;
  interval: string;
  discount_percent?: number;
  features?: Record<string, unknown>;
  is_active?: boolean;
}

/**
 * Update subscription plan input interface
 */
export interface UpdateSubscriptionPlanInput {
  name?: string;
  description?: string;
  base_monthly_price?: number;
  price?: number;
  currency?: string;
  interval?: string;
  discount_percent?: number;
  features?: Record<string, unknown>;
  is_active?: boolean;
}

/**
 * RLS context interface (established pattern - passed from session)
 */
export interface RLSContext {
  companyId: string;
  userRole: 'user' | 'admin' | 'superadmin';
}

/**
 * Subscription plan filters interface
 */
export interface SubscriptionPlanFilters {
  is_active?: boolean;
  interval?: string;
  currency?: string;
  min_discount_percent?: number;
  max_discount_percent?: number;
  min_price?: number;
  max_price?: number;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create new subscription plan
 */
export async function createSubscriptionPlan(
  planData: CreateSubscriptionPlanInput,
  rlsContext?: RLSContext
): Promise<SubscriptionPlanRecord> {
  try {
    // Validate plan data before creation
    const validation = validateSubscriptionPlanData(planData);
    if (!validation.valid) {
      throw new SubscriptionPlanErrorImpl(
        'VALIDATION_ERROR',
        `Validation failed: ${validation.errors.join(', ')}`,
        'Invalid subscription plan data',
        { errors: validation.errors }
      );
    }

    const { sql, query } = await import('./db');
    // Build features object with additional metadata
    const featuresObject = {
      description: planData.description || '',
      discount_percent: planData.discount_percent || 0,
      is_active: planData.is_active !== undefined ? planData.is_active : true,
      // Handle features array - store as nested array in JSONB
      features: Array.isArray(planData.features) ? planData.features : []
    };

    const sqlText = `
      INSERT INTO subscription_plans (
        name,
        price,
        currency,
        interval,
        features
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb
      )
      RETURNING *
    `;
    const params = [
      planData.name,
      planData.price.toFixed(2),
      planData.currency || 'PHP',
      planData.interval,
      JSON.stringify(featuresObject)
    ];

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      // Run via db.query() so RLS context is set in the same transaction
      const queryResult = await query<SubscriptionPlanRecord>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as SubscriptionPlanRecord[];
    }

    if (result.length === 0) {
      throw new SubscriptionPlanErrorImpl(
        'OPERATION_FAILED',
        'Failed to create subscription plan',
        'Unable to create subscription plan - please try again'
      );
    }

    return result[0];
  } catch (error) {
    if (error instanceof SubscriptionPlanErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to create subscription plan: ${errorMessage}`,
      'Unable to create subscription plan - please try again',
      { originalError: errorMessage }
    );
  }
}

/**
 * Get all subscription plans with optional filters
 */
export async function getAllSubscriptionPlans(
  filters?: SubscriptionPlanFilters,
  rlsContext?: RLSContext
): Promise<SubscriptionPlanRecord[]> {
  try {
    const { sql, query } = await import('./db');
    let queryText = 'SELECT * FROM subscription_plans WHERE 1=1';
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.is_active !== undefined) {
        queryText += ` AND (features->>'is_active')::boolean = $${paramIndex}`;
        params.push(filters.is_active);
        paramIndex++;
      }

      if (filters.interval) {
        queryText += ` AND interval = $${paramIndex}`;
        params.push(filters.interval);
        paramIndex++;
      }

      if (filters.currency) {
        queryText += ` AND currency = $${paramIndex}`;
        params.push(filters.currency);
        paramIndex++;
      }

      if (filters.min_discount_percent !== undefined) {
        queryText += ` AND CAST(features->>'discount_percent' AS DECIMAL) >= $${paramIndex}`;
        params.push(filters.min_discount_percent);
        paramIndex++;
      }

      if (filters.max_discount_percent !== undefined) {
        queryText += ` AND CAST(features->>'discount_percent' AS DECIMAL) <= $${paramIndex}`;
        params.push(filters.max_discount_percent);
        paramIndex++;
      }

      if (filters.min_price !== undefined) {
        queryText += ` AND CAST(price AS DECIMAL) >= $${paramIndex}`;
        params.push(filters.min_price.toFixed(2));
        paramIndex++;
      }

      if (filters.max_price !== undefined) {
        queryText += ` AND CAST(price AS DECIMAL) <= $${paramIndex}`;
        params.push(filters.max_price.toFixed(2));
        paramIndex++;
      }
    }

    queryText += ' ORDER BY created_at DESC';

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      // Run via db.query() so RLS context is set in the same transaction
      const queryResult = await query<SubscriptionPlanRecord>(
        queryText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(queryText, params) as unknown as SubscriptionPlanRecord[];
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to fetch subscription plans: ${errorMessage}`,
      'Unable to load subscription plans - please try again',
      { filters, originalError: errorMessage }
    );
  }
}

/**
 * Get subscription plan by ID
 */
export async function getSubscriptionPlanById(id: string, rlsContext?: RLSContext): Promise<SubscriptionPlanRecord | null> {
  try {
    const { sql, query } = await import('./db');
    const sqlText = 'SELECT * FROM subscription_plans WHERE id = $1';
    const params = [id];

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      const queryResult = await query<SubscriptionPlanRecord>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as SubscriptionPlanRecord[];
    }

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to fetch subscription plan: ${errorMessage}`,
      'Unable to load subscription plan - please try again',
      { planId: id, originalError: errorMessage }
    );
  }
}

/**
 * Get subscription plan by name
 */
export async function getSubscriptionPlanByName(name: string, rlsContext?: RLSContext): Promise<SubscriptionPlanRecord | null> {
  try {
    const { sql, query } = await import('./db');
    const sqlText = 'SELECT * FROM subscription_plans WHERE UPPER(name) = UPPER($1)';
    const params = [name];

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      const queryResult = await query<SubscriptionPlanRecord>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as SubscriptionPlanRecord[];
    }

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to fetch subscription plan: ${errorMessage}`,
      'Unable to load subscription plan - please try again',
      { planName: name, originalError: errorMessage }
    );
  }
}

/**
 * Update subscription plan
 */
export async function updateSubscriptionPlan(
  id: string,
  updates: UpdateSubscriptionPlanInput,
  rlsContext?: RLSContext
): Promise<SubscriptionPlanRecord | null> {
  try {
    // First get existing plan to preserve existing features
    const existingPlan = await getSubscriptionPlanById(id);
    if (!existingPlan) {
      throw new SubscriptionPlanErrorImpl(
        'NOT_FOUND',
        'Subscription plan not found',
        'Subscription plan not found - it may have been deleted',
        { planId: id }
      );
    }

    // Build updated features object
    const updatedFeatures = {
      ...(existingPlan.features || {})
    };

    // Add additional fields to features if provided
    if (updates.description !== undefined) {
      updatedFeatures.description = updates.description;
    }
    if (updates.discount_percent !== undefined) {
      updatedFeatures.discount_percent = updates.discount_percent;
    }
    if (updates.is_active !== undefined) {
      updatedFeatures.is_active = updates.is_active;
    }

    // Handle features array update
    if (Array.isArray(updates.features)) {
      updatedFeatures.features = updates.features;
    }

    // Build dynamic SET clause and values array (proven working pattern from db.ts)
    const updateFields: Record<string, string | number> = {};

    if (updates.name !== undefined) updateFields.name = updates.name;
    if (updates.price !== undefined) updateFields.price = updates.price.toFixed(2);
    if (updates.currency !== undefined) updateFields.currency = updates.currency;
    if (updates.interval !== undefined) updateFields.interval = updates.interval;

    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const baseValues = [id, ...Object.values(updateFields)];
    const values = [...baseValues, JSON.stringify(updatedFeatures)];
    const featuresIndex = values.length;

    const { sql, query } = await import('./db');
    const sqlText = `UPDATE subscription_plans
       SET ${setClause ? `${setClause}, ` : ''}features = $${featuresIndex}::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING *`;

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      const queryResult = await query<SubscriptionPlanRecord>(
        sqlText,
        values,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, values) as unknown as SubscriptionPlanRecord[];
    }

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    if (error instanceof SubscriptionPlanErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to update subscription plan: ${errorMessage}`,
      'Unable to update subscription plan - please try again',
      { planId: id, originalError: errorMessage }
    );
  }
}

/**
 * Delete subscription plan
 */
export async function deleteSubscriptionPlan(id: string, rlsContext?: RLSContext): Promise<boolean> {
  try {
    const { sql, query } = await import('./db');
    const sqlText = 'DELETE FROM subscription_plans WHERE id = $1 RETURNING id';
    const params = [id];

    let result: { id: string }[];
    if (rlsContext) {
      const queryResult = await query<{ id: string }>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as { id: string }[];
    }

    return result.length > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to delete subscription plan: ${errorMessage}`,
      'Unable to delete subscription plan - please try again',
      { planId: id, originalError: errorMessage }
    );
  }
}

/**
 * Activate subscription plan
 */
export async function activateSubscriptionPlan(id: string, rlsContext?: RLSContext): Promise<SubscriptionPlanRecord | null> {
  try {
    // First get existing plan
    const existingPlan = await getSubscriptionPlanById(id, rlsContext);
    if (!existingPlan) {
      throw new SubscriptionPlanErrorImpl(
        'NOT_FOUND',
        'Subscription plan not found',
        'Subscription plan not found - it may have been deleted',
        { planId: id }
      );
    }

    // Update features to set is_active to true
    const updatedFeatures = {
      ...(existingPlan.features || {}),
      is_active: true
    };

    const { sql, query } = await import('./db');
    const sqlText = 'UPDATE subscription_plans SET features = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *';
    const params = [id, JSON.stringify(updatedFeatures)];

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      const queryResult = await query<SubscriptionPlanRecord>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as SubscriptionPlanRecord[];
    }

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    if (error instanceof SubscriptionPlanErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to activate subscription plan: ${errorMessage}`,
      'Unable to activate subscription plan - please try again',
      { planId: id, originalError: errorMessage }
    );
  }
}

/**
 * Deactivate subscription plan
 */
export async function deactivateSubscriptionPlan(id: string, rlsContext?: RLSContext): Promise<SubscriptionPlanRecord | null> {
  try {
    // First get existing plan
    const existingPlan = await getSubscriptionPlanById(id, rlsContext);
    if (!existingPlan) {
      throw new SubscriptionPlanErrorImpl(
        'NOT_FOUND',
        'Subscription plan not found',
        'Subscription plan not found - it may have been deleted',
        { planId: id }
      );
    }

    // Update features to set is_active to false
    const updatedFeatures = {
      ...(existingPlan.features || {}),
      is_active: false
    };

    const { sql, query } = await import('./db');
    const sqlText = 'UPDATE subscription_plans SET features = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *';
    const params = [id, JSON.stringify(updatedFeatures)];

    let result: SubscriptionPlanRecord[];
    if (rlsContext) {
      const queryResult = await query<SubscriptionPlanRecord>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as SubscriptionPlanRecord[];
    }

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    if (error instanceof SubscriptionPlanErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionPlanErrorImpl(
      'OPERATION_FAILED',
      `Failed to deactivate subscription plan: ${errorMessage}`,
      'Unable to deactivate subscription plan - please try again',
      { planId: id, originalError: errorMessage }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format subscription plan for API response (converts decimal strings to numbers)
 */
export function formatSubscriptionPlanForAPI(plan: SubscriptionPlanRecord): Record<string, any> {
  const features = plan.features || {};

  // Extract features array from JSONB object, or use empty array as fallback
  const featuresArray = Array.isArray(features.features)
    ? features.features
    : (typeof features === 'object' && Object.keys(features).length > 0
        ? Object.keys(features).filter(key =>
            typeof features[key] === 'boolean' && features[key] === true ||
            typeof features[key] === 'string' && features[key] !== ''
          ).map(key => key)
        : []);

  return {
    id: plan.id,
    name: plan.name,
    description: features.description || '',
    price: parseFloat(plan.price),
    currency: plan.currency,
    interval: plan.interval,
    discount_percent: features.discount_percent || 0,
    features: featuresArray,
    is_active: features.is_active !== undefined ? features.is_active : true,
    created_at: plan.created_at,
    updated_at: plan.updated_at
  };
}

/**
 * Format multiple subscription plans for API response
 */
export function formatSubscriptionPlansForAPI(plans: SubscriptionPlanRecord[]): Record<string, any>[] {
  return plans.map(formatSubscriptionPlanForAPI);
}

/**
 * Get active subscription plans formatted for API
 */
export async function getActiveSubscriptionPlansForAPI(rlsContext?: RLSContext): Promise<Record<string, any>[]> {
  try {
    const plans = await getAllSubscriptionPlans({ is_active: true }, rlsContext);
    return formatSubscriptionPlansForAPI(plans);
  } catch (error) {
    console.error('Error fetching active subscription plans for API:', error);
    throw error;
  }
}

/**
 * Validate subscription plan interval
 */
export function isValidInterval(interval: string): boolean {
  return ['month', 'quarter', 'year'].includes(interval);
}

/**
 * Validate subscription plan data
 */
export function validateSubscriptionPlanData(data: CreateSubscriptionPlanInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Plan name is required');
  }

  if (data.price === undefined || data.price < 0) {
    errors.push('Price must be a non-negative number');
  }

  if (!data.interval || !isValidInterval(data.interval)) {
    errors.push('Interval must be one of: month, quarter, year');
  }

  if (data.discount_percent !== undefined && (data.discount_percent < 0 || data.discount_percent > 100)) {
    errors.push('Discount percent must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// PLAN IDENTIFIER RESOLUTION
// ============================================================================

/**
 * Plan identifier billing period mapping
 * Maps frontend billing period identifiers to database interval values
 */
const BILLING_PERIOD_TO_INTERVAL_MAP: Record<string, string> = {
  'monthly': 'month',
  'quarterly': 'quarter',
  'annual': 'year'
};

/**
 * Resolve plan identifier to subscription plan UUID
 *
 * Takes a billing period identifier (monthly/quarterly/annual) and queries
 * the database to find the matching subscription plan by interval field.
 *
 * @param billingPeriod - Billing period identifier ('monthly' | 'quarterly' | 'annual')
 * @returns Promise with plan UUID or null if not found
 */
export async function resolvePlanIdentifier(
  billingPeriod: string,
  rlsContext?: RLSContext
): Promise<string | null> {
  try {
    // Map billing period to database interval
    const interval = BILLING_PERIOD_TO_INTERVAL_MAP[billingPeriod];

    if (!interval) {
      console.error(`Invalid billing period identifier: ${billingPeriod}`);
      return null;
    }

    // Query database for plan with matching interval
    const { sql, query } = await import('./db');
    const sqlText = 'SELECT id FROM subscription_plans WHERE interval = $1 LIMIT 1';
    const params = [interval];

    let result: { id: string }[];
    if (rlsContext) {
      const queryResult = await query<{ id: string }>(
        sqlText,
        params,
        rlsContext.companyId,
        rlsContext.userRole
      );
      result = queryResult.rows;
    } else {
      result = await sql(sqlText, params) as unknown as { id: string }[];
    }

    if (result.length === 0) {
      console.error(`No subscription plan found for interval: ${interval}`);
      return null;
    }

    const planId = result[0].id;
    console.log(`Resolved billing period '${billingPeriod}' to plan UUID: ${planId}`);

    return planId;
  } catch (error) {
    console.error(`Error resolving plan identifier for '${billingPeriod}':`, error);
    return null;
  }
}