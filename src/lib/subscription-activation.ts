// src/lib/subscription-activation.ts

import {
  activateSubscription,
  setTrialExpiration
} from './subscription';
import {
  getSubscriptionPlanById
} from './subscription-plans';
import { SubscriptionPlan } from '@/types/subscription';
import { getUser, updateUser, sql } from './db';

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

/**
 * Subscription activation result interface
 */
export interface SubscriptionActivationResult {
  success: boolean;
  subscription_id?: string;
  message: string;
  user_id: string;
  plan_id: string;
  trial_expires_at?: Date;
  error?: string;
}

/**
 * Plan ID mapping interface
 */
export interface PlanIdMapping {
  planId: string;
  subscriptionPlan: SubscriptionPlan;
  trialPeriodDays: number;
}

/**
 * Subscription activation options interface
 */
export interface SubscriptionActivationOptions {
  skipTrial?: boolean;
  customTrialDays?: number;
  activationCode?: string;
  adminUserId?: string;
}

// ============================================================================
// PLAN ID TO SUBSCRIPTION PLAN MAPPING
// ============================================================================

/**
 * Map plan ID to subscription plan enum and trial period
 * This function determines the subscription plan type and trial duration based on plan ID
 *
 * @param planId - The subscription plan ID from the database
 * @returns Promise containing the plan mapping or null if not found
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const mapping = await mapPlanIdToSubscriptionPlan('plan-uuid');
 * if (mapping) {
 *   console.log(`Plan: ${mapping.subscriptionPlan}, Trial: ${mapping.trialPeriodDays} days`);
 * }
 * ```
 */
export async function mapPlanIdToSubscriptionPlan(planId: string): Promise<PlanIdMapping | null> {
  try {
    const plan = await getSubscriptionPlanById(planId);

    if (!plan) {
      console.warn(`Plan not found for ID: ${planId}`);
      return null;
    }

    // Map interval to SubscriptionPlan enum
    let subscriptionPlan: SubscriptionPlan;
    switch (plan.interval.toLowerCase()) {
      case 'month':
        subscriptionPlan = SubscriptionPlan.MONTHLY;
        break;
      case 'quarter':
        subscriptionPlan = SubscriptionPlan.QUARTERLY;
        break;
      case 'year':
        subscriptionPlan = SubscriptionPlan.ANNUAL;
        break;
      default:
        console.warn(`Unknown plan interval: ${plan.interval}, defaulting to MONTHLY`);
        subscriptionPlan = SubscriptionPlan.MONTHLY;
    }

    // Extract discount percent from features
    const discountPercent = plan.features?.discount_percent || 0;

    // Determine trial period based on plan characteristics
    // Higher discount plans get longer trial periods
    let trialPeriodDays = 3; // Default trial period
    if (discountPercent >= 50) {
      trialPeriodDays = 7; // Extended trial for high discount plans
    } else if (discountPercent >= 20) {
      trialPeriodDays = 5; // Moderate trial for medium discount plans
    }

    return {
      planId: plan.id,
      subscriptionPlan,
      trialPeriodDays
    };
  } catch (error) {
    console.error(`Error mapping plan ID ${planId} to subscription plan:`, error);
    throw new Error(`Failed to map plan ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// SUBSCRIPTION ACTIVATION WITH VERIFICATION
// ============================================================================

/**
 * Activate user subscription with payment verification
 * This is the main function that orchestrates the subscription activation process
 *
 * @param userId - The user ID to activate subscription for
 * @param planId - The plan ID from the payment verification
 * @param verificationId - The payment verification ID (for audit trail)
 * @param options - Optional activation settings
 * @returns Promise containing the activation result
 * @throws Error if activation fails
 * @example
 * ```typescript
 * const result = await activateSubscriptionWithVerification(
 *   'user-uuid',
 *   'plan-uuid',
 *   'verification-uuid',
 *   { skipTrial: true, activationCode: 'PROMO2024' }
 * );
 * if (result.success) {
 *   console.log(`Subscription activated: ${result.subscription_id}`);
 * }
 * ```
 */
export async function activateSubscriptionWithVerification(
  userId: string,
  planId: string,
  verificationId: string,
  options: SubscriptionActivationOptions = {}
): Promise<SubscriptionActivationResult> {
  const startTime = Date.now();
  let rollbackActions: Array<() => Promise<void>> = [];

  try {
    console.log(`Starting subscription activation for user ${userId}, plan ${planId}, verification ${verificationId}`);

    // 1. Verify user exists
    const user = await getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // 2. Map plan ID to subscription plan
    const planMapping = await mapPlanIdToSubscriptionPlan(planId);
    if (!planMapping) {
      throw new Error(`Plan not found or invalid: ${planId}`);
    }

    // 3. Get discount percent from plan features
    const plan = await getSubscriptionPlanById(planId);
    if (!plan) {
      throw new Error(`Plan details not found: ${planId}`);
    }
    const discountPercent = plan.features?.discount_percent || 0;

    // 4. Generate activation code (if not provided)
    const activationCode = options.activationCode || generateActivationCode(userId, planId);

    // 5. Determine trial period
    const trialDays = options.customTrialDays || planMapping.trialPeriodDays;
    const shouldSkipTrial = options.skipTrial || false;

    // 6. Activate the subscription
    await activateSubscription(
      userId,
      activationCode,
      discountPercent,
      planMapping.subscriptionPlan
    );

    // Add rollback action for subscription activation
    rollbackActions.push(async () => {
      console.log(`Rolling back subscription activation for user ${userId}`);
      await updateUser(userId, {
        subscription_activated: false,
        discount_percent: 0
      });
    });

    // 7. Set trial expiration (if not skipped)
    let trialExpiresAt: Date | undefined;
    if (!shouldSkipTrial) {
      trialExpiresAt = await setTrialExpiration(userId, trialDays);

      // Add rollback action for trial expiration
      rollbackActions.push(async () => {
        console.log(`Rolling back trial expiration for user ${userId}`);
        await updateUser(userId, {
          subscription_activated: false
        });
      });
    }

    // 8. Log successful activation
    const duration = Date.now() - startTime;
    console.log(`✅ Subscription activation completed successfully in ${duration}ms:`, {
      userId,
      planId,
      verificationId,
      subscriptionPlan: planMapping.subscriptionPlan,
      trialExpiresAt: trialExpiresAt?.toISOString(),
      discountPercent,
      activationCode
    });

    // 9. Return success result
    return {
      success: true,
      subscription_id: verificationId, // Using verification ID as subscription reference
      message: 'Subscription activated successfully',
      user_id: userId,
      plan_id: planId,
      trial_expires_at: trialExpiresAt
    };

  } catch (error) {
    // Rollback all changes on error
    console.error(`❌ Subscription activation failed for user ${userId}, rolling back changes...`);

    for (const rollbackAction of rollbackActions.reverse()) {
      try {
        await rollbackAction();
      } catch (rollbackError) {
        console.error('Rollback action failed:', rollbackError);
      }
    }

    // Log error details
    const duration = Date.now() - startTime;
    console.error(`Subscription activation failed after ${duration}ms:`, {
      userId,
      planId,
      verificationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return error result
    return {
      success: false,
      message: 'Subscription activation failed',
      user_id: userId,
      plan_id: planId,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// TRIAL EXPIRATION SETUP
// ============================================================================

/**
 * Setup trial expiration for a user's subscription
 * This function sets up the trial period for a new user or subscription
 *
 * @param userId - The user ID to set trial expiration for
 * @param planId - The plan ID to determine trial period
 * @param customDays - Optional custom trial period in days
 * @returns Promise containing the trial expiration date
 * @throws Error if setup fails
 * @example
 * ```typescript
 * const trialExpires = await setupTrialExpiration('user-uuid', 'plan-uuid');
 * console.log(`Trial expires: ${trialExpires.toISOString()}`);
 * ```
 */
export async function setupTrialExpiration(
  userId: string,
  planId: string,
  customDays?: number
): Promise<Date> {
  try {
    // Get plan mapping to determine trial period
    const planMapping = await mapPlanIdToSubscriptionPlan(planId);
    if (!planMapping) {
      throw new Error(`Plan not found or invalid: ${planId}`);
    }

    // Use custom days if provided, otherwise use plan default
    const trialDays = customDays || planMapping.trialPeriodDays;

    // Set trial expiration
    const trialExpiresAt = await setTrialExpiration(userId, trialDays);

    console.log(`✅ Trial expiration set for user ${userId}: ${trialExpiresAt.toISOString()} (${trialDays} days)`);

    return trialExpiresAt;
  } catch (error) {
    console.error(`❌ Failed to setup trial expiration for user ${userId}:`, error);
    throw new Error(`Failed to setup trial expiration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// ROLLBACK FUNCTIONALITY
// ============================================================================

/**
 * Rollback subscription activation
 * This function reverts all changes made during subscription activation
 *
 * @param userId - The user ID to rollback subscription for
 * @param verificationId - The verification ID for audit trail
 * @returns Promise containing true if rollback was successful
 * @throws Error if rollback fails
 * @example
 * ```typescript
 * const rollbackSuccess = await rollbackSubscriptionActivation('user-uuid', 'verification-uuid');
 * if (rollbackSuccess) {
 *   console.log('Subscription activation rolled back successfully');
 * }
 * ```
 */
export async function rollbackSubscriptionActivation(
  userId: string,
  verificationId: string
): Promise<boolean> {
  try {
    console.log(`Starting subscription activation rollback for user ${userId}, verification ${verificationId}`);

    // 1. Get current user state
    const user = await getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // 2. Revert subscription activation
    await updateUser(userId, {
      subscription_activated: false,
      discount_percent: 0
    });

    // 3. Log successful rollback
    console.log(`✅ Subscription activation rollback completed successfully:`, {
      userId,
      verificationId,
      previousState: {
        subscriptionActivated: user.subscription_activated,
        activationCode: user.activation_code,
        discountPercent: user.discount_percent,
        subscriptionPlan: user.subscription_plan,
        trialExpiresAt: user.trial_expires_at
      }
    });

    return true;

  } catch (error) {
    console.error(`❌ Subscription activation rollback failed for user ${userId}:`, {
      userId,
      verificationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    throw new Error(`Failed to rollback subscription activation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate activation code for subscription
 * This function creates a unique activation code based on user and plan
 *
 * @param userId - The user ID
 * @param planId - The plan ID
 * @returns A unique activation code
 * @example
 * ```typescript
 * const code = generateActivationCode('user-uuid', 'plan-uuid');
 * console.log(`Activation code: ${code}`);
 * ```
 */
function generateActivationCode(userId: string, planId: string): string {
  const timestamp = Date.now().toString(36);
  const userHash = userId.split('-')[0].substring(0, 8);
  const planHash = planId.split('-')[0].substring(0, 4);

  return `ACT-${userHash}-${planHash}-${timestamp}`.toUpperCase();
}

/**
 * Validate subscription activation prerequisites
 * This function checks if all requirements are met for activation
 *
 * @param userId - The user ID to validate
 * @param planId - The plan ID to validate
 * @returns Promise containing validation result with any errors
 * @example
 * ```typescript
 * const validation = await validateActivationPrerequisites('user-uuid', 'plan-uuid');
 * if (validation.valid) {
 *   console.log('Can proceed with activation');
 * } else {
 *   console.error('Validation errors:', validation.errors);
 * }
 * ```
 */
export async function validateActivationPrerequisites(
  userId: string,
  planId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // 1. Check user exists
    const user = await getUser(userId);
    if (!user) {
      errors.push(`User not found: ${userId}`);
    }

    // 2. Check plan exists
    const plan = await getSubscriptionPlanById(planId);
    if (!plan) {
      errors.push(`Plan not found: ${planId}`);
    } else {
      // 3. Check plan is active
      const isActive = plan.features?.is_active !== false;
      if (!isActive) {
        errors.push(`Plan is not active: ${planId}`);
      }

      // 4. Check plan has valid interval
      const validInterval = ['month', 'quarter', 'year'].includes(plan.interval.toLowerCase());
      if (!validInterval) {
        errors.push(`Plan has invalid interval: ${plan.interval}`);
      }
    }

    // 5. Check if user already has active subscription
    if (user && user.subscription_activated) {
      errors.push(`User already has an active subscription: ${userId}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Get subscription activation status
 * This function returns the current activation status for a user
 *
 * @param userId - The user ID to check status for
 * @returns Promise containing activation status information
 * @example
 * ```typescript
 * const status = await getSubscriptionActivationStatus('user-uuid');
 * console.log(`Is active: ${status.is_active}, Plan: ${status.plan}`);
 * ```
 */
export async function getSubscriptionActivationStatus(userId: string): Promise<{
  is_active: boolean;
  plan: SubscriptionPlan | null;
  trial_expires_at: Date | null;
  activation_code: string | null;
  discount_percent: number;
}> {
  try {
    const user = await getUser(userId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return {
      is_active: user.subscription_activated || false,
      plan: user.subscription_plan as SubscriptionPlan || null,
      trial_expires_at: user.trial_expires_at ? new Date(user.trial_expires_at) : null,
      activation_code: user.activation_code || null,
      discount_percent: user.discount_percent || 0
    };

  } catch (error) {
    console.error(`Error getting subscription activation status for user ${userId}:`, error);
    throw new Error(`Failed to get activation status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}