import {
  canCreateOrderWithDate,
  canCreateFutureOrders,
  getUserRestrictionState
} from '@/lib/trial-restrictions';
import { getUserSubscriptionInfo } from '@/lib/subscription';
import { RestrictionLevel, OperationType } from '@/types/trial-restrictions';

// Mock the subscription module and database
jest.mock('@/lib/subscription');
jest.mock('@/lib/db', () => ({
  sql: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn()
}));

describe('Trial Restrictions - Core Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canCreateOrderWithDate', () => {
    it('should allow future orders during active trial', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() + 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'trial_active' as any,
        has_access: true
      });

      const futureDate = new Date(Date.now() + 86400000 * 10);
      const result = await canCreateOrderWithDate('user-123', futureDate);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(RestrictionLevel.NONE);
    });

    it('should block future orders after trial expiration', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      const futureDate = new Date(Date.now() + 86400000);
      const result = await canCreateOrderWithDate('user-123', futureDate);

      expect(result.allowed).toBe(false);
      expect(result.level).toBe(RestrictionLevel.PARTIAL);
      expect(result.reason).toContain('future dates');
    });

    it('should allow past orders after trial expiration', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      const pastDate = new Date(Date.now() - 86400000 * 5);
      const result = await canCreateOrderWithDate('user-123', pastDate);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(RestrictionLevel.PARTIAL);
    });

    it('should allow today orders after trial expiration', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = await canCreateOrderWithDate('user-123', today);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(RestrictionLevel.PARTIAL);
    });

    it('should allow all orders with active subscription', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: true,
        subscription_plan: 'monthly' as any,
        account_status: 'subscription_active' as any,
        has_access: true
      });

      const futureDate = new Date(Date.now() + 86400000 * 10);
      const result = await canCreateOrderWithDate('user-123', futureDate);

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(RestrictionLevel.NONE);
    });
  });

  describe('canCreateFutureOrders', () => {
    it('should return true during active trial', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() + 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'trial_active' as any,
        has_access: true
      });

      const result = await canCreateFutureOrders('user-123');
      expect(result).toBe(true);
    });

    it('should return false after trial expiration', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      const result = await canCreateFutureOrders('user-123');
      expect(result).toBe(false);
    });

    it('should return true with active subscription', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: true,
        subscription_plan: 'monthly' as any,
        account_status: 'subscription_active' as any,
        has_access: true
      });

      const result = await canCreateFutureOrders('user-123');
      expect(result).toBe(true);
    });
  });

  describe('getUserRestrictionState', () => {
    it('should return full access state during trial', async () => {
      const trialExpiry = new Date(Date.now() + 86400000);
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: trialExpiry,
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

    it('should return partial access state after trial', async () => {
      const trialExpiry = new Date(Date.now() - 86400000);
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: trialExpiry,
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

    it('should return full access with active subscription', async () => {
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: true,
        subscription_plan: 'monthly' as any,
        account_status: 'subscription_active' as any,
        has_access: true
      });

      const state = await getUserRestrictionState('user-123');

      expect(state.level).toBe(RestrictionLevel.NONE);
      expect(state.trialExpired).toBe(false);
      expect(state.subscriptionActive).toBe(true);
      expect(state.canCreateFutureOrders).toBe(true);
    });
  });
});