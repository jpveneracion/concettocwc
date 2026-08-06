import { getUserSubscriptionInfo } from '@/lib/subscription';

/**
 * Theme editor is a premium feature.
 * Unlocked by redeeming an activation code (users.subscription_activated = true).
 * Fails closed: any error never grants premium access.
 */
export async function canUseThemeEditor(userId: string): Promise<boolean> {
  try {
    const info = await getUserSubscriptionInfo(userId);
    return info.subscription_activated === true;
  } catch (error) {
    console.error('Error checking theme editor entitlement:', error);
    return false; // fail closed - never grant premium on error
  }
}

export const PREMIUM_FEATURE_ERROR = {
  error: 'PREMIUM_FEATURE',
  message: 'The theme editor is a premium feature. Redeem an activation code to unlock it.',
} as const;
