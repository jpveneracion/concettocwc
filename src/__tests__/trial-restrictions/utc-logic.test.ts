import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  canCreateOrderWithDate,
  canCreateFutureOrders,
  getUserRestrictionState
} from '@/lib/trial-restrictions';
import { getUserSubscriptionInfo } from '@/lib/subscription';
import { RestrictionLevel, OperationType } from '@/types/trial-restrictions';
import { getUTCNow, createUTCDate } from '@/lib/utc-utils';

// Mock the subscription module and database
jest.mock('@/lib/subscription');
jest.mock('@/lib/db', () => ({
  sql: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn()
}));

describe('Trial Restrictions - UTC Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UTC date handling for international expansion', () => {
    it('should use UTC dates for trial expiration comparison', async () => {
      // Set trial expiration to a specific UTC time
      const trialExpirationUTC = createUTCDate(2026, 6, 15, 23, 59, 59); // July 15, 2026 23:59:59 UTC

      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: trialExpirationUTC,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'trial_active' as any,
        has_access: true
      });

      // Current time before trial expiration (simulated)
      const isActive = await canCreateFutureOrders('user-123');
      expect(isActive).toBe(true);
    });

    it('should handle date comparisons consistently across timezones', async () => {
      const mockSession = {
        userId: 'test-user',
        companyId: 'test-company',
        companyCode: 'TEST001',
        email: 'test@example.com'
      };

      // Trial expired yesterday UTC
      const yesterdayUTC = createUTCDate(2026, 6, 13); // July 13, 2026 00:00:00 UTC
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'test-user',
        trial_expires_at: yesterdayUTC,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      // Test creating order with past date (should work regardless of timezone)
      const pastDateUTC = createUTCDate(2026, 6, 10); // July 10, 2026 00:00:00 UTC (before trial expiration)
      const result = await canCreateOrderWithDate('test-user', pastDateUTC);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(RestrictionLevel.PARTIAL);
    });

    it('should block future orders consistently across all timezones', async () => {
      const mockSession = {
        userId: 'expired-user',
        companyId: 'company-789',
        companyCode: 'EXP-001',
        email: 'expired@example.com'
      };

      // Trial expired
      const expiredTrial = createUTCDate(2026, 6, 1); // July 1, 2026 00:00:00 UTC
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'expired-user',
        trial_expires_at: expiredTrial,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      // Future date in UTC (July 20, 2026)
      const futureDateUTC = createUTCDate(2026, 6, 20);
      const result = await canCreateOrderWithDate('expired-user', futureDateUTC);

      expect(result.allowed).toBe(false);
      expect(result.level).toBe(RestrictionLevel.PARTIAL);
      expect(result.reason).toContain('future dates');
    });

    it('should allow past orders consistently across all timezones', async () => {
      const mockSession = {
        userId: 'expired-user',
        companyId: 'company-789',
        companyCode: 'EXP-001',
        email: 'expired@example.com'
      };

      // Trial expired
      const expiredTrial = createUTCDate(2026, 6, 1);
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'expired-user',
        trial_expires_at: expiredTrial,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      // Past date in UTC (July 5, 2026)
      const pastDateUTC = createUTCDate(2026, 6, 5);
      const result = await canCreateOrderWithDate('expired-user', pastDateUTC);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(RestrictionLevel.PARTIAL);
    });
  });

  describe('canCreateFutureOrders with UTC dates', () => {
    it('should return true during active trial using UTC comparisons', async () => {
      const futureTrialUTC = createUTCDate(2026, 7, 20); // Future trial expiration
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: futureTrialUTC,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'trial_active' as any,
        has_access: true
      });

      const result = await canCreateFutureOrders('user-123');
      expect(result).toBe(true);
    });

    it('should return false after trial expiration using UTC comparisons', async () => {
      const pastTrialUTC = createUTCDate(2026, 6, 1); // Past trial expiration
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: pastTrialUTC,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      const result = await canCreateFutureOrders('user-123');
      expect(result).toBe(false);
    });
  });

  describe('getUserRestrictionState with UTC dates', () => {
    it('should correctly determine trial status using UTC comparisons', async () => {
      const futureTrialUTC = createUTCDate(2026, 7, 20);
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: futureTrialUTC,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'trial_active' as any,
        has_access: true
      });

      const state = await getUserRestrictionState('user-123');

      expect(state.level).toBe(RestrictionLevel.NONE);
      expect(state.trialExpired).toBe(false);
      expect(state.canCreateFutureOrders).toBe(true);
      expect(state.canCreatePastOrders).toBe(true);
    });

    it('should return partial access state after trial expiration using UTC', async () => {
      const pastTrialUTC = createUTCDate(2026, 6, 1);
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: pastTrialUTC,
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      const state = await getUserRestrictionState('user-123');

      expect(state.level).toBe(RestrictionLevel.PARTIAL);
      expect(state.trialExpired).toBe(true);
      expect(state.canCreateFutureOrders).toBe(false);
      expect(state.canCreatePastOrders).toBe(true);
      expect(state.allowedOperations).toContain(OperationType.VIEW_DASHBOARD);
      expect(state.allowedOperations).toContain(OperationType.VIEW_ANALYTICS);
    });
  });
});