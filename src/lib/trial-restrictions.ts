import {
  RestrictionLevel,
  OperationType,
  RestrictionResult,
  RestrictionState,
  ValidationResult
} from '@/types/trial-restrictions';
import { getUserSubscriptionInfo } from '@/lib/subscription';
import { toUTCMidnight, getUTCNow } from '@/lib/utc-utils';

/**
 * Format a Date as YYYY-MM-DD for HTML date input
 */
function toDateInputValue(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if user can create order with specific date
 *
 * Logic (based solely on the user's `trial_expires_at` row, never "today"):
 * - Subscribed: allow any date
 * - Trial active: allow ANY date (installation dates can be weeks out)
 * - Trial expired: allow only dates <= trial_expires_at (hard max,
 *   pinned to the stored row content — never rolls forward)
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

  const trialExpiresAt = subscriptionInfo.trial_expires_at;
  const nowUTC = getUTCNow();
  const trialActive = trialExpiresAt !== null && trialExpiresAt !== undefined && trialExpiresAt > nowUTC;

  // No trial expiration set => block all order creation
  if (trialExpiresAt === null || trialExpiresAt === undefined) {
    return {
      allowed: false,
      operation: OperationType.CREATE_ORDER,
      level: RestrictionLevel.PARTIAL,
      reason: 'No active trial or subscription. Please activate your account.',
      canBypass: false
    };
  }

  // Trial is still active: no date restriction (installation dates can be far out)
  if (trialActive) {
    return {
      allowed: true,
      operation: OperationType.CREATE_ORDER,
      level: RestrictionLevel.NONE,
      reason: 'Trial active - no date restriction'
    };
  }

  // Trial expired: hard max = trial_expires_at (pinned, never rolls).
  // Only orders dated strictly BEFORE the raw trial_expires_at timestamp.
  const targetUTCMidnight = toUTCMidnight(targetDate);

  if (targetUTCMidnight < trialExpiresAt) {
    return {
      allowed: true,
      operation: OperationType.CREATE_ORDER,
      level: RestrictionLevel.PARTIAL,
      reason: 'Trial expired - order date before trial expiration'
    };
  }

  return {
    allowed: false,
    operation: OperationType.CREATE_ORDER,
    level: RestrictionLevel.PARTIAL,
    reason: `Cannot create orders dated after your trial expiration (${toDateInputValue(trialExpiresAt)}). This limit does not change. Activate your subscription to create later dates.`,
    canBypass: false
  };
}

/**
 * Check if user can create orders with dates beyond today.
 * True for subscribed users and users with an active trial.
 * False only for expired-trial users (capped at trial_expires_at).
 */
export async function canCreateFutureOrders(userId: string): Promise<boolean> {
  const subscriptionInfo = await getUserSubscriptionInfo(userId);

  if (subscriptionInfo.subscription_activated) return true;

  const trialExpiresAt = subscriptionInfo.trial_expires_at;
  const nowUTC = getUTCNow();
  return trialExpiresAt !== null && trialExpiresAt !== undefined && trialExpiresAt > nowUTC;
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

  // Determine restriction level and max order date
  let level: RestrictionLevel;
  let restrictionReason: string | undefined;
  let maxOrderDate: string | null;

  if (subscriptionActive) {
    // Subscribed: no date limit
    level = RestrictionLevel.NONE;
    maxOrderDate = null;
  } else if (trialExpiresAt === null || trialExpiresAt === undefined) {
    // No trial row at all: block order creation entirely
    level = RestrictionLevel.PARTIAL;
    restrictionReason = 'No active trial or subscription. Please activate your account.';
    maxOrderDate = null;
  } else if (trialActive) {
    // Trial active: NO date restriction - installation dates can be far out
    level = RestrictionLevel.NONE;
    maxOrderDate = null;
  } else {
    // Trial expired: hard max = trial_expires_at (pinned, never rolls).
    // Max selectable day = day of the last instant strictly before the timestamp.
    level = RestrictionLevel.PARTIAL;
    restrictionReason = `Trial expired on ${toDateInputValue(trialExpiresAt)} - only orders dated before your trial expiration are allowed`;
    maxOrderDate = toDateInputValue(new Date(trialExpiresAt.getTime() - 1));
  }

  // Define allowed operations based on level
  const allowedOperations: OperationType[] = [
    OperationType.VIEW_DASHBOARD,
    OperationType.VIEW_ANALYTICS,
    OperationType.CREATE_ORDER,
    OperationType.CREATE_QUOTE,
    OperationType.MANAGE_PRODUCTS
  ];

  return {
    level,
    trialExpired: !trialActive && !subscriptionActive,
    trialExpiresAt: trialExpiresAt || null,
    subscriptionActive,
    allowedOperations,
    restrictionReason,
    canCreatePastOrders: true, // Always allow backdating within the allowed window
    canCreateFutureOrders: subscriptionActive || trialActive, // Active trial or subscription: no restriction
    maxOrderDate
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

  // For order creation with a specific date, check against trial expiration
  if (operation === OperationType.CREATE_ORDER && context?.targetDate) {
    const orderCheck = await canCreateOrderWithDate(userId, context.targetDate);
    if (!orderCheck.allowed) {
      return {
        allowed: false,
        reason: orderCheck.reason,
        level: orderCheck.level,
        suggestion: 'Create orders dated before your trial expiration date, or activate your subscription'
      };
    }
    return {
      allowed: true,
      level: restrictionState.level
    };
  }

  // For other operations, check against allowedOperations
  if (!restrictionState.allowedOperations.includes(operation)) {
    return {
      allowed: false,
      reason: restrictionState.restrictionReason,
      level: restrictionState.level,
      suggestion: 'Activate your subscription to access this feature'
    };
  }

  return {
    allowed: true,
    level: restrictionState.level
  };
}