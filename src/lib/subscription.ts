// src/lib/subscription.ts

import {
  UserSubscriptionInfo,
  AccountStatus,
  TrialStatusResponse,
  SubscriptionPlan,
  SubscriptionPlanDetails,
  SubscriptionPlanInterval,
  // Legacy types for backward compatibility
  LegacySubscription,
  LegacySubscriptionPlan,
  SubscriptionAccess,
  SubscriptionDetails
} from '@/types/subscription';
import { getUser, updateUser, sql, query } from './db';

// Database query result interfaces
interface CountResult {
  count: string;
}

// Re-export types and enums for convenience
export type { UserSubscriptionInfo, TrialStatusResponse, SubscriptionPlan };
export type { LegacySubscription, LegacySubscriptionPlan, SubscriptionAccess, SubscriptionDetails };
export { AccountStatus };

/**
 * RLS context interface (established pattern - passed from session)
 */
export interface RLSContext {
  companyId: string;
  userRole: 'user' | 'admin' | 'superadmin';
}

/**
 * Calculate user's subscription status
 */
export async function getUserSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo> {
  const user = await getUser(userId);

  const trial_expires_at = user.trial_expires_at ? new Date(user.trial_expires_at) : undefined;
  const subscription_activated = user.subscription_activated || false;
  const trial_active = trial_expires_at ? trial_expires_at > new Date() : false;
  const has_access = trial_active || subscription_activated;

  let account_status: AccountStatus;
  if (subscription_activated) {
    account_status = AccountStatus.SUBSCRIPTION_ACTIVE;
  } else if (trial_active) {
    account_status = AccountStatus.TRIAL_ACTIVE;
  } else {
    account_status = AccountStatus.LOCKED;
  }

  return {
    user_id: userId,
    trial_expires_at,
    subscription_activated,
    activation_code: user.activation_code,
    discount_percent: user.discount_percent,
    subscription_plan: user.subscription_plan as SubscriptionPlan,
    account_status,
    has_access
  };
}

/**
 * Calculate trial status response for API
 */
export async function getTrialStatusResponse(userId: string): Promise<TrialStatusResponse> {
  const subscriptionInfo = await getUserSubscriptionInfo(userId);
  const trial_expires_at = subscriptionInfo.trial_expires_at;

  const trial_days_remaining = trial_expires_at
    ? Math.max(0, Math.ceil((trial_expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    trial_active: subscriptionInfo.account_status === AccountStatus.TRIAL_ACTIVE,
    trial_days_remaining,
    trial_expires_at: trial_expires_at?.toISOString() || '',
    subscription_activated: subscriptionInfo.subscription_activated,
    requires_activation: !subscriptionInfo.has_access,
    has_access: subscriptionInfo.has_access,
    discount_percent: subscriptionInfo.discount_percent,
    subscription_plan: subscriptionInfo.subscription_plan,
    account_status: subscriptionInfo.account_status
  };
}

/**
 * Set trial expiration for new user (supports both number IDs and UUID strings)
 */
export async function setTrialExpiration(userId: number | string, days: number = 3): Promise<Date> {
  const trial_expires_at = new Date();
  trial_expires_at.setDate(trial_expires_at.getDate() + days);

  // For OAuth users with UUID strings, use direct SQL query to avoid type conversion issues
  if (typeof userId === 'string' && userId.includes('-')) {
    // This is a UUID - use direct SQL to handle string IDs
    await sql(
      'UPDATE users SET trial_expires_at = $1 WHERE id = $2',
      [trial_expires_at.toISOString(), userId]
    );
    console.log('✅ Set trial expiration for UUID user:', userId);
    return trial_expires_at;
  }

  // For number IDs (legacy system), use the existing updateUser function
  const numericUserId = typeof userId === 'number' ? userId : parseInt(userId as string);
  await updateUser(String(numericUserId), {
    trial_expires_at: trial_expires_at.toISOString()
  });

  return trial_expires_at;
}

/**
 * Activate user subscription with code
 * Uses query() with RLS context so the users update actually applies under RLS
 */
export async function activateSubscription(
  userId: string,
  code: string,
  discount_percent: number,
  subscription_plan: SubscriptionPlan,
  rlsContext?: RLSContext
): Promise<void> {
  if (rlsContext) {
    const result = await query(
      `UPDATE users
       SET subscription_activated = true, activation_code = $2, discount_percent = $3, subscription_plan = $4
       WHERE id = $1::uuid`,
      [userId, code, discount_percent, subscription_plan],
      rlsContext.companyId,
      rlsContext.userRole
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Failed to activate subscription: user not found or RLS blocked update');
    }
    return;
  }

  // Legacy path without context (raw SQL, subject to RLS)
  await updateUser(userId, {
    subscription_activated: true,
    activation_code: code,
    discount_percent,
    subscription_plan
  });
}

/**
 * Check if user has access to protected resources
 */
export async function checkUserAccess(userId: string): Promise<boolean> {
  const subscriptionInfo = await getUserSubscriptionInfo(userId);
  return subscriptionInfo.has_access;
}

/**
 * Get days remaining in trial
 */
export function getTrialDaysRemaining(trial_expires_at: Date | undefined): number {
  if (!trial_expires_at) return 0;

  const now = new Date();
  const diff = trial_expires_at.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

// ============================================================================
// LEGACY PAYMONGO SUBSCRIPTION FUNCTIONS (For backward compatibility)
// ============================================================================

/**
 * Get subscription by company ID (legacy system)
 */
export async function getSubscriptionByCompanyId(companyId: string, rlsContext?: RLSContext): Promise<LegacySubscription | null> {
  let result: LegacySubscription[];
  if (rlsContext) {
    const queryResult = await query<LegacySubscription>(
      'SELECT * FROM subscriptions WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1',
      [companyId],
      rlsContext.companyId,
      rlsContext.userRole
    );
    result = queryResult.rows;
  } else {
    result = await sql('SELECT * FROM subscriptions WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1', [companyId]) as unknown as LegacySubscription[];
  }
  return result[0] || null;
}

/**
 * Get subscription plan by ID (legacy system)
 */
export async function getSubscriptionPlan(planId: string, rlsContext?: RLSContext): Promise<LegacySubscriptionPlan | null> {
  let result: LegacySubscriptionPlan[];
  if (rlsContext) {
    const queryResult = await query<LegacySubscriptionPlan>(
      'SELECT * FROM subscription_plans WHERE id = $1 LIMIT 1',
      [planId],
      rlsContext.companyId,
      rlsContext.userRole
    );
    result = queryResult.rows;
  } else {
    result = await sql('SELECT * FROM subscription_plans WHERE id = $1 LIMIT 1', [planId]) as unknown as LegacySubscriptionPlan[];
  }
  return result[0] || null;
}

/**
 * Session interface for legacy subscription access check
 */
interface SubscriptionSession {
  companyId?: string;
  userId?: string;
  email?: string;
}

/**
 * Check subscription access permissions based on session (legacy system)
 */
export async function checkSubscriptionAccess(session: SubscriptionSession | null | undefined): Promise<SubscriptionAccess> {
  if (!session?.companyId) {
    return {
      allowed: false,
      mode: 'denied',
      reason: 'No authenticated session found'
    };
  }

  const rlsContext: RLSContext = {
    companyId: session.companyId,
    userRole: ((session as { role?: string }).role || 'user') as 'user' | 'admin' | 'superadmin'
  };

  const subscription = await getSubscriptionByCompanyId(session.companyId, rlsContext);

  if (!subscription) {
    // No subscription found - check if company can start trial
    return {
      allowed: true,
      mode: 'full',
      reason: 'No subscription yet - can start trial',
      subscription: undefined
    };
  }

  const plan = await getSubscriptionPlan(subscription.plan_id, rlsContext);

  if (!plan) {
    return {
      allowed: false,
      mode: 'denied',
      reason: 'Invalid subscription plan'
    };
  }

  const now = new Date();
  const details = await buildSubscriptionDetails(subscription, plan, rlsContext);

  // Handle different subscription statuses
  switch (subscription.status) {
    case 'trialing':
      // Check if trial is still valid
      if (subscription.trial_end && subscription.trial_end > now) {
        return {
          allowed: true,
          mode: 'full',
          reason: 'Trial period active',
          subscription: details
        };
      } else {
        // Trial expired - transition to past_due
        await handleTrialExpiration(subscription.id);
        return {
          allowed: true,
          mode: 'readonly',
          reason: 'Trial expired - payment required',
          subscription: details
        };
      }

    case 'active':
      return {
        allowed: true,
        mode: 'full',
        reason: 'Active subscription',
        subscription: details
      };

    case 'past_due':
      // Check grace period (7 days from current_period_end)
      if (subscription.current_period_end && subscription.current_period_end > now) {
        return {
          allowed: true,
          mode: 'readonly',
          reason: 'Payment past due - grace period active',
          subscription: details
        };
      } else {
        return {
          allowed: false,
          mode: 'denied',
          reason: 'Payment past due - grace period expired',
          subscription: details
        };
      }

    case 'cancelled':
      // Check if subscription is still in grace period (7 days from cancellation)
      if (subscription.current_period_end && subscription.current_period_end > now) {
        return {
          allowed: true,
          mode: 'readonly',
          reason: 'Subscription cancelled - grace period active',
          subscription: details
        };
      } else {
        return {
          allowed: false,
          mode: 'denied',
          reason: 'Subscription cancelled - grace period expired',
          subscription: details
        };
      }

    case 'suspended':
      return {
        allowed: false,
        mode: 'denied',
        reason: 'Subscription suspended',
        subscription: details
      };

    default:
      return {
        allowed: false,
        mode: 'denied',
        reason: 'Unknown subscription status'
      };
  }
}

/**
 * Build subscription details with usage statistics (legacy system)
 */
export async function buildSubscriptionDetails(
  subscription: LegacySubscription,
  plan: LegacySubscriptionPlan,
  rlsContext?: RLSContext
): Promise<SubscriptionDetails> {
  const now = new Date();
  const periodStart = subscription.current_period_end
    ? new Date(subscription.current_period_end.getTime() - 30 * 24 * 60 * 60 * 1000) // Approximate period start
    : subscription.created_at;

  // Get quotes created in current period (with RLS context so tenant isolation allows the count)
  let quotesResult: Array<{ count?: string | number }>;
  if (rlsContext) {
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM quotes WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3',
      [subscription.company_id, periodStart, now],
      rlsContext.companyId,
      rlsContext.userRole
    );
    quotesResult = countResult.rows;
  } else {
    quotesResult = await sql(
      'SELECT COUNT(*) as count FROM quotes WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3',
      [subscription.company_id, periodStart, now]
    );
  }

  const quotesCreatedThisPeriod = parseInt((quotesResult[0] as CountResult)?.count || '0');

  // Get quote limit from plan features
  const quotesLimit = (plan.features?.quotes_limit as number | null) || null;
  const quotesRemaining = quotesLimit === null ? -1 : Math.max(0, quotesLimit - quotesCreatedThisPeriod);

  // Convert LegacySubscriptionPlan to SubscriptionPlanDetails for compatibility
  const rawInterval = (plan.interval || 'month').toLowerCase();
  const normalizedInterval: SubscriptionPlanInterval =
    rawInterval === 'year' ? SubscriptionPlanInterval.ANNUAL :
    rawInterval === 'quarter' ? SubscriptionPlanInterval.QUARTERLY :
    SubscriptionPlanInterval.MONTHLY;

  const subscriptionPlanDetails: SubscriptionPlanDetails = {
    id: plan.id,
    name: plan.name,
    description: `Legacy ${plan.name} plan`, // Add description for compatibility
    price: plan.price ?? plan.amount, // Real column is price; amount kept for legacy rows
    currency: plan.currency,
    interval: normalizedInterval,
    discount_percent: 0, // Legacy plans don't have discount_percent
    features: {
      max_quotes_per_period: plan.features?.quotes_limit
    },
    status: 'active' as any, // Legacy plans are considered active
    is_active: true,
    sort_order: 0,
    created_at: plan.created_at,
    updated_at: plan.updated_at
  };

  return {
    plan: subscriptionPlanDetails, // Use converted plan
    status: subscription.status,
    trial_end: subscription.trial_end,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    usage_stats: {
      quotes_created_this_period: quotesCreatedThisPeriod,
      quotes_remaining: quotesRemaining
    }
  };
}

/**
 * Require active subscription - throw error if access not allowed (legacy system)
 */
export function requireActiveSubscription(access: SubscriptionAccess): void {
  if (!access.allowed) {
    throw new Error(access.reason || 'Subscription access denied');
  }

  if (access.mode === 'denied') {
    throw new Error(access.reason || 'Subscription access denied');
  }

  if (access.mode === 'readonly') {
    throw new Error(`Read-only access: ${access.reason || 'Subscription not active'}`);
  }

  // Access is allowed and mode is 'full' - no error thrown
}

/**
 * Handle trial expiration - transition to past_due (legacy system)
 */
async function handleTrialExpiration(subscriptionId: string): Promise<void> {
  await sql(
    'UPDATE subscriptions SET status = \'past_due\', updated_at = NOW() WHERE id = $1',
    [subscriptionId]
  );
}

/**
 * Cancel subscription at period end (legacy system)
 */
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<boolean> {
  const result = await sql(
    'UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE id = $1 RETURNING id',
    [subscriptionId]
  );
  return result.length > 0;
}
