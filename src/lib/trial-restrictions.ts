import {
  RestrictionLevel,
  OperationType,
  RestrictionResult,
  RestrictionState,
  ValidationResult
} from '@/types/trial-restrictions';
import { getUserSubscriptionInfo } from '@/lib/subscription';
import { getUTCMidnight, toUTCMidnight, getUTCNow } from '@/lib/utc-utils';

/**
 * Check if user can create order with specific date
 */
export async function canCreateOrderWithDate(
  userId: string,
  targetDate: Date
): Promise<RestrictionResult> {
  const subscriptionInfo = await getUserSubscriptionInfo(userId);

  // If subscription is active, allow everything
  if (subscriptionInfo.subscription_activated) {
    return {
      allowed: true,
      operation: OperationType.CREATE_ORDER,
      level: RestrictionLevel.NONE
    };
  }

  // Check if trial is still active using UTC comparisons
  const nowUTC = getUTCNow();
  const trialExpiresAt = subscriptionInfo.trial_expires_at;
  const trialActive = trialExpiresAt !== null && trialExpiresAt !== undefined && trialExpiresAt > nowUTC;

  if (trialActive) {
    return {
      allowed: true,
      operation: OperationType.CREATE_ORDER,
      level: RestrictionLevel.NONE
    };
  }

  // Trial has expired - check if target date is in the future (using UTC)
  const todayUTCMidnight = getUTCMidnight();
  const targetUTCMidnight = toUTCMidnight(targetDate);

  if (targetUTCMidnight > todayUTCMidnight) {
    return {
      allowed: false,
      operation: OperationType.CREATE_ORDER,
      level: RestrictionLevel.PARTIAL,
      reason: 'Cannot create orders with future dates after trial expiration. You can create orders with dates before today, or activate your subscription.',
      canBypass: false
    };
  }

  // Allow past and today dates
  return {
    allowed: true,
    operation: OperationType.CREATE_ORDER,
    level: RestrictionLevel.PARTIAL,
    reason: 'Trial expired - only ante-dated orders allowed'
  };
}

/**
 * Check if user can create future orders (date > today)
 */
export async function canCreateFutureOrders(userId: string): Promise<boolean> {
  const subscriptionInfo = await getUserSubscriptionInfo(userId);

  // Active subscription allows everything
  if (subscriptionInfo.subscription_activated) {
    return true;
  }

  // Check if trial is still active using UTC comparisons
  const nowUTC = getUTCNow();
  const trialExpiresAt = subscriptionInfo.trial_expires_at;
  const trialActive = trialExpiresAt !== null && trialExpiresAt !== undefined && trialExpiresAt > nowUTC;

  return trialActive;
}

/**
 * Get user's current restriction state
 */
export async function getUserRestrictionState(userId: string): Promise<RestrictionState> {
  const subscriptionInfo = await getUserSubscriptionInfo(userId);

  const nowUTC = getUTCNow();
  const trialExpiresAt = subscriptionInfo.trial_expires_at;
  const trialActive = trialExpiresAt !== null && trialExpiresAt !== undefined && trialExpiresAt > nowUTC;
  const subscriptionActive = subscriptionInfo.subscription_activated;

  // Determine restriction level
  let level: RestrictionLevel;
  let restrictionReason: string | undefined;

  if (subscriptionActive) {
    level = RestrictionLevel.NONE;
  } else if (trialActive) {
    level = RestrictionLevel.NONE;
  } else {
    level = RestrictionLevel.PARTIAL;
    restrictionReason = 'Trial period expired - future order creation requires active subscription';
  }

  // Define allowed operations based on level
  const allowedOperations: OperationType[] = [
    OperationType.VIEW_DASHBOARD,
    OperationType.VIEW_ANALYTICS
  ];

  if (level === RestrictionLevel.NONE) {
    allowedOperations.push(
      OperationType.CREATE_ORDER,
      OperationType.CREATE_QUOTE,
      OperationType.MANAGE_PRODUCTS
    );
  } else {
    // Partial access - can create past orders and manage products
    allowedOperations.push(
      OperationType.CREATE_ORDER,
      OperationType.CREATE_QUOTE,
      OperationType.MANAGE_PRODUCTS
    );
  }

  return {
    level,
    trialExpired: !trialActive && !subscriptionActive,
    trialExpiresAt: trialExpiresAt || null,
    subscriptionActive,
    allowedOperations,
    restrictionReason,
    canCreatePastOrders: true, // Users can always create past orders
    canCreateFutureOrders: level === RestrictionLevel.NONE
  };
}

/**
 * Validate specific operation against restrictions
 */
export async function validateOperation(
  operation: OperationType,
  userId: string,
  context?: { targetDate?: Date }
): Promise<ValidationResult> {
  const restrictionState = await getUserRestrictionState(userId);

  // Check if operation is allowed
  if (!restrictionState.allowedOperations.includes(operation)) {
    return {
      allowed: false,
      reason: restrictionState.restrictionReason,
      level: restrictionState.level,
      suggestion: 'Activate your subscription to access this feature'
    };
  }

  // Special handling for order creation with date
  if (operation === OperationType.CREATE_ORDER && context?.targetDate) {
    const orderCheck = await canCreateOrderWithDate(userId, context.targetDate);
    if (!orderCheck.allowed) {
      return {
        allowed: false,
        reason: orderCheck.reason,
        level: orderCheck.level,
        suggestion: 'Create orders with dates before today, or activate your subscription'
      };
    }
  }

  return {
    allowed: true,
    level: restrictionState.level
  };
}