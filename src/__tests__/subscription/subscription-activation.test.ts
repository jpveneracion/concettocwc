// src/__tests__/subscription/subscription-activation.test.ts

import {
  mapPlanIdToSubscriptionPlan,
  activateSubscriptionWithVerification,
  setupTrialExpiration,
  rollbackSubscriptionActivation,
  validateActivationPrerequisites,
  getSubscriptionActivationStatus,
  generateActivationCode
} from '@/lib/subscription-activation';
import { SubscriptionPlan } from '@/types/subscription';

// Mock the dependencies
jest.mock('@/lib/subscription', () => ({
  activateSubscription: jest.fn(),
  setTrialExpiration: jest.fn()
}));

jest.mock('@/lib/subscription-plans', () => ({
  getSubscriptionPlanById: jest.fn()
}));

jest.mock('@/lib/db', () => ({
  getUser: jest.fn(),
  updateUser: jest.fn(),
  sql: jest.fn()
}));

describe('Subscription Activation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapPlanIdToSubscriptionPlan', () => {
    it('should map monthly plan correctly', async () => {
      const mockPlan = {
        id: 'plan-monthly-123',
        name: 'Monthly Plan',
        interval: 'month',
        features: {
          discount_percent: 10,
          is_active: true
        }
      };

      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await mapPlanIdToSubscriptionPlan('plan-monthly-123');

      expect(result).toEqual({
        planId: 'plan-monthly-123',
        subscriptionPlan: SubscriptionPlan.MONTHLY,
        trialPeriodDays: 3 // 10% discount = 3 days trial (default)
      });
    });

    it('should map quarterly plan correctly', async () => {
      const mockPlan = {
        id: 'plan-quarterly-456',
        name: 'Quarterly Plan',
        interval: 'quarter',
        features: {
          discount_percent: 25,
          is_active: true
        }
      };

      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await mapPlanIdToSubscriptionPlan('plan-quarterly-456');

      expect(result).toEqual({
        planId: 'plan-quarterly-456',
        subscriptionPlan: SubscriptionPlan.QUARTERLY,
        trialPeriodDays: 5 // 25% discount = 5 days trial
      });
    });

    it('should map annual plan correctly', async () => {
      const mockPlan = {
        id: 'plan-annual-789',
        name: 'Annual Plan',
        interval: 'year',
        features: {
          discount_percent: 50,
          is_active: true
        }
      };

      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await mapPlanIdToSubscriptionPlan('plan-annual-789');

      expect(result).toEqual({
        planId: 'plan-annual-789',
        subscriptionPlan: SubscriptionPlan.ANNUAL,
        trialPeriodDays: 7 // 50% discount = 7 days trial
      });
    });

    it('should return null for non-existent plan', async () => {
      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');
      getSubscriptionPlanById.mockResolvedValue(null);

      const result = await mapPlanIdToSubscriptionPlan('non-existent-plan');

      expect(result).toBeNull();
    });

    it('should default to monthly for unknown intervals', async () => {
      const mockPlan = {
        id: 'plan-unknown-123',
        name: 'Unknown Plan',
        interval: 'unknown',
        features: {
          discount_percent: 10,
          is_active: true
        }
      };

      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await mapPlanIdToSubscriptionPlan('plan-unknown-123');

      expect(result?.subscriptionPlan).toBe(SubscriptionPlan.MONTHLY);
      expect(result?.trialPeriodDays).toBe(3); // unknown interval = default 3 days
    });
  });

  describe('validateActivationPrerequisites', () => {
    it('should validate successfully for valid user and plan', async () => {
      const mockUser = {
        id: 'user-123',
        subscription_activated: false
      };

      const mockPlan = {
        id: 'plan-123',
        interval: 'month',
        features: {
          is_active: true
        }
      };

      const { getUser } = require('@/lib/db');
      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');

      getUser.mockResolvedValue(mockUser);
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await validateActivationPrerequisites('user-123', 'plan-123');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for non-existent user', async () => {
      const { getUser } = require('@/lib/db');
      getUser.mockResolvedValue(null);

      const result = await validateActivationPrerequisites('non-existent-user', 'plan-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User not found: non-existent-user');
    });

    it('should fail validation for non-existent plan', async () => {
      const mockUser = {
        id: 'user-123',
        subscription_activated: false
      };

      const { getUser } = require('@/lib/db');
      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');

      getUser.mockResolvedValue(mockUser);
      getSubscriptionPlanById.mockResolvedValue(null);

      const result = await validateActivationPrerequisites('user-123', 'non-existent-plan');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan not found: non-existent-plan');
    });

    it('should fail validation for inactive plan', async () => {
      const mockUser = {
        id: 'user-123',
        subscription_activated: false
      };

      const mockPlan = {
        id: 'plan-123',
        interval: 'month',
        features: {
          is_active: false
        }
      };

      const { getUser } = require('@/lib/db');
      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');

      getUser.mockResolvedValue(mockUser);
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await validateActivationPrerequisites('user-123', 'plan-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan is not active: plan-123');
    });

    it('should fail validation for user with existing subscription', async () => {
      const mockUser = {
        id: 'user-123',
        subscription_activated: true
      };

      const mockPlan = {
        id: 'plan-123',
        interval: 'month',
        features: {
          is_active: true
        }
      };

      const { getUser } = require('@/lib/db');
      const { getSubscriptionPlanById } = require('@/lib/subscription-plans');

      getUser.mockResolvedValue(mockUser);
      getSubscriptionPlanById.mockResolvedValue(mockPlan);

      const result = await validateActivationPrerequisites('user-123', 'plan-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User already has an active subscription: user-123');
    });
  });

  describe('getSubscriptionActivationStatus', () => {
    it('should return current activation status', async () => {
      const mockUser = {
        id: 'user-123',
        subscription_activated: true,
        subscription_plan: 'monthly',
        activation_code: 'ACT-123',
        discount_percent: 20,
        trial_expires_at: '2024-12-31T23:59:59Z'
      };

      const { getUser } = require('@/lib/db');
      getUser.mockResolvedValue(mockUser);

      const result = await getSubscriptionActivationStatus('user-123');

      expect(result).toEqual({
        is_active: true,
        plan: SubscriptionPlan.MONTHLY,
        activation_code: 'ACT-123',
        discount_percent: 20,
        trial_expires_at: new Date('2024-12-31T23:59:59Z')
      });
    });

    it('should return inactive status for user without subscription', async () => {
      const mockUser = {
        id: 'user-123',
        subscription_activated: false,
        subscription_plan: null,
        activation_code: null,
        discount_percent: 0,
        trial_expires_at: null
      };

      const { getUser } = require('@/lib/db');
      getUser.mockResolvedValue(mockUser);

      const result = await getSubscriptionActivationStatus('user-123');

      expect(result).toEqual({
        is_active: false,
        plan: null,
        activation_code: null,
        discount_percent: 0,
        trial_expires_at: null
      });
    });

    it('should throw error for non-existent user', async () => {
      const { getUser } = require('@/lib/db');
      getUser.mockResolvedValue(null);

      await expect(getSubscriptionActivationStatus('non-existent-user')).rejects.toThrow();
    });
  });
});