// src/lib/subscription-plans.ts

import { sql } from './db';

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

/**
 * Database subscription plan record interface (matches actual database schema)
 */
export interface SubscriptionPlanRecord {
  id: string; // UUID
  name: string;
  price: string; // DECIMAL in database comes as string
  currency: string;
  interval: string;
  paymongo_plan_id: string | null;
  features: Record<string, any>; // JSONB from database
  created_at: string; // TIMESTAMPTZ comes as string
  updated_at: string; // TIMESTAMPTZ comes as string
}

/**
 * Create subscription plan input interface
 */
export interface CreateSubscriptionPlanInput {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  interval: string;
  discount_percent?: number;
  features?: Record<string, any>;
  paymongo_plan_id?: string;
  is_active?: boolean;
}

/**
 * Update subscription plan input interface
 */
export interface UpdateSubscriptionPlanInput {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  interval?: string;
  discount_percent?: number;
  features?: Record<string, any>;
  paymongo_plan_id?: string;
  is_active?: boolean;
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
  planData: CreateSubscriptionPlanInput
): Promise<SubscriptionPlanRecord> {
  try {
    // Build features object with additional metadata
    const featuresObject = {
      description: planData.description || '',
      discount_percent: planData.discount_percent || 0,
      is_active: planData.is_active !== undefined ? planData.is_active : true,
      // Handle features array - store as nested array in JSONB
      features: Array.isArray(planData.features) ? planData.features : []
    };

    const result = await sql`
      INSERT INTO subscription_plans (
        name,
        price,
        currency,
        interval,
        paymongo_plan_id,
        features
      ) VALUES (
        ${planData.name},
        ${planData.price.toFixed(2)},
        ${planData.currency || 'PHP'},
        ${planData.interval},
        ${planData.paymongo_plan_id || null},
        ${JSON.stringify(featuresObject)}::jsonb
      )
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Failed to create subscription plan');
    }

    return result[0] as SubscriptionPlanRecord;
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    throw new Error(`Failed to create subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all subscription plans with optional filters
 */
export async function getAllSubscriptionPlans(
  filters?: SubscriptionPlanFilters
): Promise<SubscriptionPlanRecord[]> {
  try {
    let query = 'SELECT * FROM subscription_plans WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.is_active !== undefined) {
        query += ` AND (features->>'is_active')::boolean = $${paramIndex}`;
        params.push(filters.is_active);
        paramIndex++;
      }

      if (filters.interval) {
        query += ` AND interval = $${paramIndex}`;
        params.push(filters.interval);
        paramIndex++;
      }

      if (filters.currency) {
        query += ` AND currency = $${paramIndex}`;
        params.push(filters.currency);
        paramIndex++;
      }

      if (filters.min_discount_percent !== undefined) {
        query += ` AND CAST(features->>'discount_percent' AS DECIMAL) >= $${paramIndex}`;
        params.push(filters.min_discount_percent);
        paramIndex++;
      }

      if (filters.max_discount_percent !== undefined) {
        query += ` AND CAST(features->>'discount_percent' AS DECIMAL) <= $${paramIndex}`;
        params.push(filters.max_discount_percent);
        paramIndex++;
      }

      if (filters.min_price !== undefined) {
        query += ` AND CAST(price AS DECIMAL) >= $${paramIndex}`;
        params.push(filters.min_price.toFixed(2));
        paramIndex++;
      }

      if (filters.max_price !== undefined) {
        query += ` AND CAST(price AS DECIMAL) <= $${paramIndex}`;
        params.push(filters.max_price.toFixed(2));
        paramIndex++;
      }
    }

    query += ' ORDER BY created_at DESC';

    const result = await sql(query, ...params);
    return result as SubscriptionPlanRecord[];
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    throw new Error(`Failed to fetch subscription plans: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get subscription plan by ID
 */
export async function getSubscriptionPlanById(id: string): Promise<SubscriptionPlanRecord | null> {
  try {
    const result = await sql`
      SELECT * FROM subscription_plans
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return null;
    }

    return result[0] as SubscriptionPlanRecord;
  } catch (error) {
    console.error('Error fetching subscription plan by ID:', error);
    throw new Error(`Failed to fetch subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get subscription plan by name
 */
export async function getSubscriptionPlanByName(name: string): Promise<SubscriptionPlanRecord | null> {
  try {
    const result = await sql`
      SELECT * FROM subscription_plans
      WHERE UPPER(name) = UPPER(${name})
    `;

    if (result.length === 0) {
      return null;
    }

    return result[0] as SubscriptionPlanRecord;
  } catch (error) {
    console.error('Error fetching subscription plan by name:', error);
    throw new Error(`Failed to fetch subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update subscription plan
 */
export async function updateSubscriptionPlan(
  id: string,
  updates: UpdateSubscriptionPlanInput
): Promise<SubscriptionPlanRecord | null> {
  try {
    // First get existing plan to preserve existing features
    const existingPlan = await getSubscriptionPlanById(id);
    if (!existingPlan) {
      return null;
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

    // Build the UPDATE query using template literal approach
    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setParts.push('name = $1');
      values.push(updates.name);
    }
    if (updates.price !== undefined) {
      setParts.push(`price = $${values.length + 1}`);
      values.push(updates.price.toFixed(2));
    }
    if (updates.currency !== undefined) {
      setParts.push(`currency = $${values.length + 1}`);
      values.push(updates.currency);
    }
    if (updates.interval !== undefined) {
      setParts.push(`interval = $${values.length + 1}`);
      values.push(updates.interval);
    }
    if (updates.paymongo_plan_id !== undefined) {
      setParts.push(`paymongo_plan_id = $${values.length + 1}`);
      values.push(updates.paymongo_plan_id);
    }

    // Always update features and updated_at
    setParts.push(`features = $${values.length + 1}::jsonb`);
    values.push(JSON.stringify(updatedFeatures));

    setParts.push(`updated_at = NOW()`);

    // Add the ID as the last parameter
    values.push(id);

    // Build the final query
    const query = `
      UPDATE subscription_plans
      SET ${setParts.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await sql(query, ...values);

    if (result.length === 0) {
      return null;
    }

    return result[0] as SubscriptionPlanRecord;
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    throw new Error(`Failed to update subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete subscription plan
 */
export async function deleteSubscriptionPlan(id: string): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM subscription_plans
      WHERE id = ${id}
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    throw new Error(`Failed to delete subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Activate subscription plan
 */
export async function activateSubscriptionPlan(id: string): Promise<SubscriptionPlanRecord | null> {
  try {
    // First get existing plan
    const existingPlan = await getSubscriptionPlanById(id);
    if (!existingPlan) {
      return null;
    }

    // Update features to set is_active to true
    const updatedFeatures = {
      ...(existingPlan.features || {}),
      is_active: true
    };

    const result = await sql`
      UPDATE subscription_plans
      SET features = ${JSON.stringify(updatedFeatures)}::jsonb, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return null;
    }

    return result[0] as SubscriptionPlanRecord;
  } catch (error) {
    console.error('Error activating subscription plan:', error);
    throw new Error(`Failed to activate subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deactivate subscription plan
 */
export async function deactivateSubscriptionPlan(id: string): Promise<SubscriptionPlanRecord | null> {
  try {
    // First get existing plan
    const existingPlan = await getSubscriptionPlanById(id);
    if (!existingPlan) {
      return null;
    }

    // Update features to set is_active to false
    const updatedFeatures = {
      ...(existingPlan.features || {}),
      is_active: false
    };

    const result = await sql`
      UPDATE subscription_plans
      SET features = ${JSON.stringify(updatedFeatures)}::jsonb, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return null;
    }

    return result[0] as SubscriptionPlanRecord;
  } catch (error) {
    console.error('Error deactivating subscription plan:', error);
    throw new Error(`Failed to deactivate subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
export async function getActiveSubscriptionPlansForAPI(): Promise<Record<string, any>[]> {
  try {
    const plans = await getAllSubscriptionPlans({ is_active: true });
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