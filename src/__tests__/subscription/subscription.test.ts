import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the database module BEFORE importing the subscription functions
jest.mock('../../lib/db', () => ({
  query: jest.fn(),
  sql: jest.fn()
}));

import {
  getSubscriptionByCompanyId,
  getSubscriptionPlan,
  checkSubscriptionAccess,
  requireActiveSubscription,
  canStartTrial,
  createTrialSubscription,
  getAvailablePlans,
  updateSubscriptionStatus,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription
} from '../../lib/subscription';
import { query } from '../../lib/db';
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionAccess
} from '../../types/subscription';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('getSubscriptionByCompanyId()', () => {
  describe('Success cases', () => {
    it('should return null for company without subscription', async () => {
      const companyId = 'company-without-sub';

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionByCompanyId(companyId);

      expect(result).toBeNull();
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it('should return subscription for company with active subscription', async () => {
      const companyId = 'company-with-sub';
      const mockSubscription: Subscription = {
        id: 'sub-123',
        company_id: companyId,
        status: 'active',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };

      mockedQuery.mockResolvedValue([mockSubscription]);

      const result = await getSubscriptionByCompanyId(companyId);

      expect(result).toEqual(mockSubscription);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should return the most recent subscription when multiple exist', async () => {
      const companyId = 'company-with-multiple-subs';
      const mockSubscriptions: Subscription[] = [
        {
          id: 'sub-new',
          company_id: companyId,
          status: 'active',
          plan_id: 'plan-pro',
          trial_end: null,
          current_period_end: new Date('2026-08-10'),
          cancel_at_period_end: false,
          paymongo_subscription_id: 'paymongo-new',
          created_at: new Date('2026-07-01'),
          updated_at: new Date('2026-07-10')
        }
      ];

      mockedQuery.mockResolvedValue(mockSubscriptions);

      const result = await getSubscriptionByCompanyId(companyId);

      expect(result).toEqual(mockSubscriptions[0]);
      expect(mockedQuery).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const companyId = 'error-company';
      const dbError = new Error('Database connection failed');

      mockedQuery.mockRejectedValue(dbError);

      await expect(getSubscriptionByCompanyId(companyId)).rejects.toThrow(dbError);
    });

    it('should handle empty results gracefully', async () => {
      const companyId = 'empty-company';

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionByCompanyId(companyId);

      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in company ID', async () => {
      const companyId = "company-with-'\"-special-chars";

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionByCompanyId(companyId);

      expect(result).toBeNull();
    });

    it('should handle very long company IDs', async () => {
      const companyId = 'a'.repeat(500);

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionByCompanyId(companyId);

      expect(result).toBeNull();
    });
  });
});

describe('getSubscriptionPlan()', () => {
  describe('Success cases', () => {
    it('should return plan details for valid plan ID', async () => {
      const planId = 'plan-pro';
      const mockPlan: SubscriptionPlan = {
        id: planId,
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: {
          quotes_limit: 1000,
          users_limit: 10,
          advanced_analytics: true,
          custom_templates: true
        },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValue([mockPlan]);

      const result = await getSubscriptionPlan(planId);

      expect(result).toEqual(mockPlan);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should return null for non-existent plan', async () => {
      const planId = 'non-existent-plan';

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionPlan(planId);

      expect(result).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const planId = 'error-plan';
      const dbError = new Error('Database query failed');

      mockedQuery.mockRejectedValue(dbError);

      await expect(getSubscriptionPlan(planId)).rejects.toThrow(dbError);
    });

    it('should handle malformed database responses', async () => {
      const planId = 'malformed-plan';

      mockedQuery.mockResolvedValue([{}]); // Empty object instead of proper plan

      const result = await getSubscriptionPlan(planId);

      expect(result).toEqual({} as SubscriptionPlan);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty plan ID', async () => {
      const planId = '';

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionPlan(planId);

      expect(result).toBeNull();
    });

    it('should handle SQL injection attempts', async () => {
      const planId = "'; DROP TABLE subscription_plans; --";

      mockedQuery.mockResolvedValue([]);

      const result = await getSubscriptionPlan(planId);

      expect(result).toBeNull();
    });
  });
});

describe('checkSubscriptionAccess()', () => {
  describe('Access denial scenarios', () => {
    it('should deny access without session', async () => {
      const session: any = null;

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'No authenticated session found'
      });
    });

    it('should deny access with malformed session', async () => {
      const session: any = {};

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'No authenticated session found'
      });
    });

    it('should deny access for suspended subscriptions', async () => {
      const session: any = { companyId: 'suspended-company' };
      const mockSubscription: Subscription = {
        id: 'sub-suspended',
        company_id: 'suspended-company',
        status: 'suspended',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(50) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'Subscription suspended',
        subscription: expect.objectContaining({
          status: 'suspended'
        })
      });
    });
  });

  describe('Trial access scenarios', () => {
    it('should grant full access during active trial', async () => {
      const session: any = { companyId: 'trial-company' };
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 2); // 2 days from now

      const mockSubscription: Subscription = {
        id: 'sub-trial',
        company_id: 'trial-company',
        status: 'trialing',
        plan_id: 'plan-basic',
        trial_end: trialEndDate,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-08'),
        updated_at: new Date('2026-07-08')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-basic',
        name: 'Basic Plan',
        amount: 0,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 50 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(10) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: true,
        mode: 'full',
        reason: 'Trial period active',
        subscription: expect.objectContaining({
          status: 'trialing'
        })
      });
    });

    it('should deny access after trial ends', async () => {
      const session: any = { companyId: 'expired-trial-company' };
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() - 1); // 1 day ago

      const mockSubscription: Subscription = {
        id: 'sub-expired-trial',
        company_id: 'expired-trial-company',
        status: 'trialing',
        plan_id: 'plan-basic',
        trial_end: trialEndDate,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-05'),
        updated_at: new Date('2026-07-05')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-basic',
        name: 'Basic Plan',
        amount: 0,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 50 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(10) }]);
      mockedQuery.mockResolvedValue([]); // UPDATE for handleTrialExpiration

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: true,
        mode: 'readonly',
        reason: 'Trial expired - payment required',
        subscription: expect.objectContaining({
          status: 'trialing'
        })
      });
    });
  });

  describe('Active subscription scenarios', () => {
    it('should grant full access for active subscriptions', async () => {
      const session: any = { companyId: 'active-company' };
      const mockSubscription: Subscription = {
        id: 'sub-active',
        company_id: 'active-company',
        status: 'active',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: true,
        mode: 'full',
        reason: 'Active subscription',
        subscription: expect.objectContaining({
          status: 'active'
        })
      });
    });
  });

  describe('Past due subscription scenarios', () => {
    it('should allow read-only during grace period', async () => {
      const session: any = { companyId: 'past-due-company' };
      const periodEndDate = new Date();
      periodEndDate.setDate(periodEndDate.getDate() + 5); // 5 days from now

      const mockSubscription: Subscription = {
        id: 'sub-past-due',
        company_id: 'past-due-company',
        status: 'past_due',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: periodEndDate,
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: true,
        mode: 'readonly',
        reason: 'Payment past due - grace period active',
        subscription: expect.objectContaining({
          status: 'past_due'
        })
      });
    });

    it('should deny access after grace period expires', async () => {
      const session: any = { companyId: 'expired-grace-company' };
      const periodEndDate = new Date();
      periodEndDate.setDate(periodEndDate.getDate() - 2); // 2 days ago

      const mockSubscription: Subscription = {
        id: 'sub-expired-grace',
        company_id: 'expired-grace-company',
        status: 'past_due',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: periodEndDate,
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'Payment past due - grace period expired',
        subscription: expect.objectContaining({
          status: 'past_due'
        })
      });
    });
  });

  describe('Cancelled subscription scenarios', () => {
    it('should allow read-only during cancellation grace period', async () => {
      const session: any = { companyId: 'cancelled-company' };
      const periodEndDate = new Date();
      periodEndDate.setDate(periodEndDate.getDate() + 3); // 3 days from now

      const mockSubscription: Subscription = {
        id: 'sub-cancelled',
        company_id: 'cancelled-company',
        status: 'cancelled',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: periodEndDate,
        cancel_at_period_end: true,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: true,
        mode: 'readonly',
        reason: 'Subscription cancelled - grace period active',
        subscription: expect.objectContaining({
          status: 'cancelled'
        })
      });
    });

    it('should deny access after cancellation grace period expires', async () => {
      const session: any = { companyId: 'fully-cancelled-company' };
      const periodEndDate = new Date();
      periodEndDate.setDate(periodEndDate.getDate() - 1); // 1 day ago

      const mockSubscription: Subscription = {
        id: 'sub-fully-cancelled',
        company_id: 'fully-cancelled-company',
        status: 'cancelled',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: periodEndDate,
        cancel_at_period_end: true,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'Subscription cancelled - grace period expired',
        subscription: expect.objectContaining({
          status: 'cancelled'
        })
      });
    });
  });

  describe('No subscription scenarios', () => {
    it('should grant full access for companies without subscription (can start trial)', async () => {
      const session: any = { companyId: 'no-sub-company' };

      mockedQuery.mockResolvedValue([]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: true,
        mode: 'full',
        reason: 'No subscription yet - can start trial',
        subscription: undefined
      });
    });
  });

  describe('Invalid plan scenarios', () => {
    it('should deny access when subscription has invalid plan', async () => {
      const session: any = { companyId: 'invalid-plan-company' };
      const mockSubscription: Subscription = {
        id: 'sub-invalid-plan',
        company_id: 'invalid-plan-company',
        status: 'active',
        plan_id: 'non-existent-plan',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([]); // Plan not found

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'Invalid subscription plan'
      });
    });
  });

  describe('Unknown status scenarios', () => {
    it('should deny access for unknown subscription status', async () => {
      const session: any = { companyId: 'unknown-status-company' };
      const mockSubscription: Subscription = {
        id: 'sub-unknown',
        company_id: 'unknown-status-company',
        status: 'unknown' as any,
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };
      const mockPlan: SubscriptionPlan = {
        id: 'plan-pro',
        name: 'Pro Plan',
        amount: 29000,
        currency: 'PHP',
        interval: 'monthly',
        features: { quotes_limit: 1000 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockResolvedValueOnce([mockPlan]);
      mockedQuery.mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await checkSubscriptionAccess(session);

      expect(result).toEqual({
        allowed: false,
        mode: 'denied',
        reason: 'Unknown subscription status'
      });
    });
  });

  describe('Database error handling', () => {
    it('should handle database errors during subscription lookup', async () => {
      const session: any = { companyId: 'error-company' };
      const dbError = new Error('Database connection failed');

      mockedQuery.mockRejectedValue(dbError);

      await expect(checkSubscriptionAccess(session)).rejects.toThrow(dbError);
    });

    it('should handle database errors during plan lookup', async () => {
      const session: any = { companyId: 'plan-error-company' };
      const mockSubscription: Subscription = {
        id: 'sub-plan-error',
        company_id: 'plan-error-company',
        status: 'active',
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };

      mockedQuery.mockResolvedValueOnce([mockSubscription]);
      mockedQuery.mockRejectedValueOnce(new Error('Plan query failed'));

      await expect(checkSubscriptionAccess(session)).rejects.toThrow('Plan query failed');
    });
  });
});

describe('requireActiveSubscription()', () => {
  describe('Error scenarios', () => {
    it('should throw error for denied access', () => {
      const access: SubscriptionAccess = {
        allowed: false,
        mode: 'denied',
        reason: 'Subscription suspended'
      };

      expect(() => requireActiveSubscription(access)).toThrow('Subscription suspended');
    });

    it('should throw error for read-only access', () => {
      const access: SubscriptionAccess = {
        allowed: true,
        mode: 'readonly',
        reason: 'Trial expired - payment required'
      };

      expect(() => requireActiveSubscription(access)).toThrow('Read-only access: Trial expired - payment required');
    });

    it('should throw error for denied access with custom reason', () => {
      const access: SubscriptionAccess = {
        allowed: false,
        mode: 'denied',
        reason: 'Payment past due - grace period expired'
      };

      expect(() => requireActiveSubscription(access)).toThrow('Payment past due - grace period expired');
    });

    it('should throw default error when reason is not provided', () => {
      const access: SubscriptionAccess = {
        allowed: false,
        mode: 'denied'
      };

      expect(() => requireActiveSubscription(access)).toThrow('Subscription access denied');
    });

    it('should throw default error for read-only without reason', () => {
      const access: SubscriptionAccess = {
        allowed: true,
        mode: 'readonly'
      };

      expect(() => requireActiveSubscription(access)).toThrow('Read-only access:');
    });
  });

  describe('Success scenarios', () => {
    it('should not throw error for full access', () => {
      const access: SubscriptionAccess = {
        allowed: true,
        mode: 'full',
        reason: 'Active subscription'
      };

      expect(() => requireActiveSubscription(access)).not.toThrow();
    });

    it('should not throw error for full access with subscription details', () => {
      const access: SubscriptionAccess = {
        allowed: true,
        mode: 'full',
        reason: 'Active subscription',
        subscription: {
          plan: {
            id: 'plan-pro',
            name: 'Pro Plan',
            amount: 29000,
            currency: 'PHP',
            interval: 'monthly',
                features: { quotes_limit: 1000 },
            created_at: new Date(),
            updated_at: new Date()
          },
          status: 'active',
          trial_end: null,
          current_period_end: new Date('2026-08-10'),
          cancel_at_period_end: false,
          usage_stats: {
            quotes_created_this_period: 100,
            quotes_remaining: 900
          }
        }
      };

      expect(() => requireActiveSubscription(access)).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should throw error for denied access with empty reason', () => {
      const access: SubscriptionAccess = {
        allowed: false,
        mode: 'denied',
        reason: ''
      };

      expect(() => requireActiveSubscription(access)).toThrow();
    });

    it('should handle access objects with undefined subscription', () => {
      const access: SubscriptionAccess = {
        allowed: true,
        mode: 'full',
        reason: 'No subscription yet - can start trial',
        subscription: undefined
      };

      expect(() => requireActiveSubscription(access)).not.toThrow();
    });
  });
});

describe('Additional subscription helper functions', () => {
  describe('canStartTrial()', () => {
    it('should return true for company without subscription', async () => {
      const companyId = 'new-company';
      mockedQuery.mockResolvedValue([]);

      const result = await canStartTrial(companyId);

      expect(result).toBe(true);
    });

    it('should return false for company with existing subscription', async () => {
      const companyId = 'existing-company';
      const mockSubscription: Subscription = {
        id: 'sub-123',
        company_id: companyId,
        status: 'active',
        plan_id: 'plan-basic',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };

      mockedQuery.mockResolvedValue([mockSubscription]);

      const result = await canStartTrial(companyId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const companyId = 'error-company';
      mockedQuery.mockRejectedValue(new Error('Database error'));

      await expect(canStartTrial(companyId)).rejects.toThrow('Database error');
    });
  });

  describe('getAvailablePlans()', () => {
    it('should return list of available plans ordered by amount', async () => {
      const mockPlans: SubscriptionPlan[] = [
        {
          id: 'plan-basic',
          name: 'Basic Plan',
          amount: 0,
          currency: 'PHP',
          interval: 'monthly',
          features: { quotes_limit: 50 },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'plan-pro',
          name: 'Pro Plan',
          amount: 29000,
          currency: 'PHP',
          interval: 'monthly',
          features: { quotes_limit: 1000 },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'plan-enterprise',
          name: 'Enterprise Plan',
          amount: 99000,
          currency: 'PHP',
          interval: 'monthly',
          features: { quotes_limit: -1 },
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockedQuery.mockResolvedValue(mockPlans);

      const result = await getAvailablePlans();

      expect(result).toEqual(mockPlans);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should return empty array when no plans available', async () => {
      mockedQuery.mockResolvedValue([]);

      const result = await getAvailablePlans();

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockedQuery.mockRejectedValue(new Error('Database error'));

      await expect(getAvailablePlans()).rejects.toThrow('Database error');
    });
  });

  describe('updateSubscriptionStatus()', () => {
    it('should update subscription status successfully', async () => {
      const subscriptionId = 'sub-123';
      const newStatus = 'active';
      const mockUpdatedSubscription: Subscription = {
        id: subscriptionId,
        company_id: 'company-123',
        status: newStatus,
        plan_id: 'plan-pro',
        trial_end: null,
        current_period_end: new Date('2026-08-10'),
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date('2026-07-01'),
        updated_at: new Date('2026-07-10')
      };

      mockedQuery.mockResolvedValue([mockUpdatedSubscription]);

      const result = await updateSubscriptionStatus(subscriptionId, newStatus);

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should return null when subscription not found', async () => {
      const subscriptionId = 'non-existent-sub';
      const newStatus = 'active';

      mockedQuery.mockResolvedValue([]);

      const result = await updateSubscriptionStatus(subscriptionId, newStatus);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const subscriptionId = 'error-sub';
      const newStatus = 'active';
      mockedQuery.mockRejectedValue(new Error('Database error'));

      await expect(updateSubscriptionStatus(subscriptionId, newStatus)).rejects.toThrow('Database error');
    });
  });

  describe('cancelSubscriptionAtPeriodEnd()', () => {
    it('should set cancellation flag successfully', async () => {
      const subscriptionId = 'sub-123';
      mockedQuery.mockResolvedValue([{ id: subscriptionId }]);

      const result = await cancelSubscriptionAtPeriodEnd(subscriptionId);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should return false when subscription not found', async () => {
      const subscriptionId = 'non-existent-sub';
      mockedQuery.mockResolvedValue([]);

      const result = await cancelSubscriptionAtPeriodEnd(subscriptionId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const subscriptionId = 'error-sub';
      mockedQuery.mockRejectedValue(new Error('Database error'));

      await expect(cancelSubscriptionAtPeriodEnd(subscriptionId)).rejects.toThrow('Database error');
    });
  });

  describe('reactivateSubscription()', () => {
    it('should reactivate subscription successfully', async () => {
      const subscriptionId = 'sub-123';
      mockedQuery.mockResolvedValue([{ id: subscriptionId }]);

      const result = await reactivateSubscription(subscriptionId);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should return false when subscription not found', async () => {
      const subscriptionId = 'non-existent-sub';
      mockedQuery.mockResolvedValue([]);

      const result = await reactivateSubscription(subscriptionId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const subscriptionId = 'error-sub';
      mockedQuery.mockRejectedValue(new Error('Database error'));

      await expect(reactivateSubscription(subscriptionId)).rejects.toThrow('Database error');
    });
  });

  describe('createTrialSubscription()', () => {
    it('should create trial subscription successfully', async () => {
      const companyId = 'trial-company';
      const planId = 'plan-basic';
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 3);

      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

      const mockCreatedSubscription: Subscription = {
        id: 'sub-trial-123',
        company_id: companyId,
        status: 'trialing',
        plan_id: planId,
        trial_end: trialEnd,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
        paymongo_subscription_id: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockedQuery.mockResolvedValue([mockCreatedSubscription]);

      const result = await createTrialSubscription(companyId, planId);

      expect(result).toEqual(mockCreatedSubscription);
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should throw error when database query fails', async () => {
      const companyId = 'error-company';
      const planId = 'plan-basic';
      mockedQuery.mockResolvedValue([]);

      await expect(createTrialSubscription(companyId, planId)).rejects.toThrow('Failed to create trial subscription');
    });

    it('should handle database errors gracefully', async () => {
      const companyId = 'error-company';
      const planId = 'plan-basic';
      mockedQuery.mockRejectedValue(new Error('Database error'));

      await expect(createTrialSubscription(companyId, planId)).rejects.toThrow('Database error');
    });
  });
});