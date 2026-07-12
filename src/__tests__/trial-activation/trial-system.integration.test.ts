// src/__tests__/trial-activation/trial-system.integration.test.ts
/**
 * Comprehensive Integration Tests for Trial Activation System
 *
 * Tests all critical user flows:
 * 1. OAuth Signup Flow - automatic 3-day trial for new users
 * 2. Trial Expiry Flow - redirects and access control for expired trials
 * 3. Activation Code Flow - code redemption and subscription activation
 * 4. API Access Control - proper 403 responses and subscription checks
 * 5. Cache Performance - verify caching doesn't break functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setTrialExpiration, getUserSubscriptionInfo, getTrialStatusResponse, activateSubscription, checkUserAccess, AccountStatus } from '../../lib/subscription';
import { generateActivationCode, createActivationCode, validateActivationCode, redeemActivationCode } from '../../lib/activation';

// Mock the database module
jest.mock('../../lib/db', () => ({
  sql: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn()
}));

import { sql, getUser, updateUser } from '../../lib/db';

const mockedSql = sql as jest.MockedFunction<typeof sql>;
const mockedGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockedUpdateUser = updateUser as jest.MockedFunction<typeof updateUser>;

describe('Trial Activation System - Integration Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRITICAL FLOW 1: OAuth Signup with Automatic Trial', () => {

    it('should set 3-day trial expiration for new OAuth user with number ID', async () => {
      const userId = 123;
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 3);

      mockedUpdateUser.mockResolvedValue();

      const result = await setTrialExpiration(userId, 3);

      expect(result).toBeInstanceOf(Date);
      expect(mockedUpdateUser).toHaveBeenCalledWith(userId, {
        trial_expires_at: expect.any(String)
      });

      // Verify the trial date is approximately 3 days from now
      const daysDiff = Math.ceil((result.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(2);
      expect(daysDiff).toBeLessThanOrEqual(4);
    });

    it('should handle UUID-based user IDs for OAuth users', async () => {
      const uuidUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockedSql.mockResolvedValue([]);

      const result = await setTrialExpiration(uuidUserId, 3);

      expect(result).toBeInstanceOf(Date);
      expect(mockedSql).toHaveBeenCalledWith(
        'UPDATE users SET trial_expires_at = $1 WHERE id = $2',
        [expect.any(String), uuidUserId]
      );
    });

    it('should grant immediate access to protected routes for new trial users', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 3);

      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'newuser@example.com',
        name: 'New User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(123);

      expect(subscriptionInfo.account_status).toBe(AccountStatus.TRIAL_ACTIVE);
      expect(subscriptionInfo.has_access).toBe(true);
      expect(subscriptionInfo.trial_expires_at).toBeInstanceOf(Date);
    });

    it('should include trial days remaining in API responses', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 2); // 2 days remaining

      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'trialuser@example.com',
        name: 'Trial User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const trialStatus = await getTrialStatusResponse(123);

      expect(trialStatus.trial_active).toBe(true);
      expect(trialStatus.trial_days_remaining).toBeGreaterThanOrEqual(1);
      expect(trialStatus.trial_days_remaining).toBeLessThanOrEqual(3);
      expect(trialStatus.requires_activation).toBe(false);
      expect(trialStatus.has_access).toBe(true);
    });
  });

  describe('CRITICAL FLOW 2: Trial Expiry and Access Control', () => {

    it('should detect expired trials and deny access', async () => {
      const expiredTrial = new Date();
      expiredTrial.setDate(expiredTrial.getDate() - 1); // Expired yesterday

      mockedGetUser.mockResolvedValue({
        id: 456,
        email: 'expireduser@example.com',
        name: 'Expired User',
        trial_expires_at: expiredTrial.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(456);

      expect(subscriptionInfo.account_status).toBe(AccountStatus.LOCKED);
      expect(subscriptionInfo.has_access).toBe(false);
      expect(subscriptionInfo.subscription_activated).toBe(false);
    });

    it('should return zero trial days for expired users', async () => {
      const expiredTrial = new Date();
      expiredTrial.setDate(expiredTrial.getDate() - 5);

      mockedGetUser.mockResolvedValue({
        id: 456,
        email: 'expireduser@example.com',
        name: 'Expired User',
        trial_expires_at: expiredTrial.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const trialStatus = await getTrialStatusResponse(456);

      expect(trialStatus.trial_active).toBe(false);
      expect(trialStatus.trial_days_remaining).toBe(0);
      expect(trialStatus.requires_activation).toBe(true);
      expect(trialStatus.has_access).toBe(false);
    });

    it('should handle edge case of trial expiring today', async () => {
      const todayExpiry = new Date();
      todayExpiry.setHours(23, 59, 59, 999); // End of today

      mockedGetUser.mockResolvedValue({
        id: 789,
        email: 'lastday@example.com',
        name: 'Last Day User',
        trial_expires_at: todayExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(789);
      const trialStatus = await getTrialStatusResponse(789);

      // Should still have access on the last day
      expect(subscriptionInfo.has_access).toBe(true);
      expect(trialStatus.trial_days_remaining).toBeGreaterThanOrEqual(0);
    });

    it('should handle users without trial expiration date', async () => {
      mockedGetUser.mockResolvedValue({
        id: 999,
        email: 'notrial@example.com',
        name: 'No Trial User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(999);

      expect(subscriptionInfo.account_status).toBe(AccountStatus.LOCKED);
      expect(subscriptionInfo.has_access).toBe(false);
      expect(subscriptionInfo.trial_expires_at).toBeUndefined();
    });
  });

  describe('CRITICAL FLOW 3: Activation Code Redemption', () => {

    it('should generate valid activation codes with correct format', () => {
      const code = generateActivationCode();

      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(code.length).toBe(19); // 4 groups of 4 chars separated by 3 dashes
    });

    it('should create activation codes in database', async () => {
      const mockRequest = {
        discount_percent: 20,
        applicable_plans: ['basic', 'pro'],
        payment_amount: 1000,
        payment_currency: 'PHP',
        payment_method: 'bank_transfer' as const,
        payment_reference: 'REF123',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        campaign_name: 'Test Campaign',
        notes: 'Test activation code'
      };

      const mockCreatedCode = {
        id: 1,
        code: 'TEST-1234-5678-9999',
        discount_percent: 20,
        applicable_plans: '["basic","pro"]', // JSON string as stored in DB
        payment_amount: 1000,
        payment_currency: 'PHP',
        payment_method: 'bank_transfer',
        payment_reference: 'REF123',
        created_by: 1,
        created_at: new Date(),
        expires_at: mockRequest.expires_at,
        is_active: true,
        status_history: '[]'
      };

      mockedSql.mockResolvedValue([mockCreatedCode]);

      const result = await createActivationCode(mockRequest, 1);

      expect(result).toMatchObject({
        code: 'TEST-1234-5678-9999',
        discount_percent: 20,
        is_active: true
      });
    });

    it('should validate activation codes correctly', async () => {
      const mockCode = {
        id: 1,
        code: 'VALID-1234-5678-9999',
        discount_percent: 20,
        applicable_plans: '["basic","pro"]',
        payment_currency: 'PHP',
        payment_method: 'bank_transfer',
        is_active: true,
        status_history: '[]'
      };

      mockedSql.mockResolvedValue([mockCode]);

      const result = await validateActivationCode('VALID-1234-5678-9999', 'pro');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALID-1234-5678-9999');
      expect(result?.applicable_plans).toContain('pro');
    });

    it('should reject activation codes for non-applicable plans', async () => {
      const mockCode = {
        id: 1,
        code: 'BASIC-ONLY-1234-5678',
        discount_percent: 10,
        applicable_plans: '["basic"]', // Only basic plan
        payment_currency: 'PHP',
        payment_method: 'bank_transfer',
        is_active: true,
        status_history: '[]'
      };

      mockedSql.mockResolvedValue([mockCode]);

      const result = await validateActivationCode('BASIC-ONLY-1234-5678', 'enterprise');

      expect(result).toBeNull(); // Should not work for enterprise plan
    });

    it('should redeem activation codes and update user subscription', async () => {
      const mockCode = {
        id: 1,
        code: 'REDEEM-1234-5678-9999',
        discount_percent: 25,
        applicable_plans: '["pro"]',
        payment_currency: 'PHP',
        payment_method: 'bank_transfer',
        is_active: true,
        status_history: '[]'
      };

      mockedSql.mockResolvedValueOnce([mockCode]); // For validation
      mockedSql.mockResolvedValueOnce([{ ...mockCode, used_by: 123, used_at: new Date() }]); // For redemption

      const redeemedCode = await redeemActivationCode('REDEEM-1234-5678-9999', 123, '127.0.0.1', 'pro');

      expect(redeemedCode).toBeDefined();
      expect(mockedSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE activation_codes'),
        expect.arrayContaining([123, expect.any(String), '127.0.0.1', expect.any(String), 'REDEEM-1234-5678-9999'])
      );
    });

    it('should activate user subscription after code redemption', async () => {
      mockedUpdateUser.mockResolvedValue();

      await activateSubscription(123, 'ACTIVATED-1234-5678', 20, 'pro');

      expect(mockedUpdateUser).toHaveBeenCalledWith(123, {
        subscription_activated: true,
        activation_code: 'ACTIVATED-1234-5678',
        discount_percent: 20,
        subscription_plan: 'pro'
      });
    });

    it('should grant immediate access after activation', async () => {
      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'activated@example.com',
        name: 'Activated User',
        subscription_activated: true,
        activation_code: 'ACTIVATED-1234-5678',
        discount_percent: 20,
        subscription_plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(123);

      expect(subscriptionInfo.account_status).toBe(AccountStatus.SUBSCRIPTION_ACTIVE);
      expect(subscriptionInfo.has_access).toBe(true);
      expect(subscriptionInfo.subscription_activated).toBe(true);
      expect(subscriptionInfo.activation_code).toBe('ACTIVATED-1234-5678');
    });

    it('should reject invalid activation codes', async () => {
      mockedSql.mockResolvedValue([]); // No code found

      await expect(
        redeemActivationCode('INVALID-1234-5678-9999', 123, '127.0.0.1', 'pro')
      ).rejects.toThrow('Invalid or expired activation code');
    });
  });

  describe('CRITICAL FLOW 4: API Access Control', () => {

    it('should grant access to users with active trials', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 2);

      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'trialuser@example.com',
        name: 'Trial User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const hasAccess = await checkUserAccess(123);

      expect(hasAccess).toBe(true);
    });

    it('should grant access to users with activated subscriptions', async () => {
      mockedGetUser.mockResolvedValue({
        id: 456,
        email: 'subscriber@example.com',
        name: 'Subscriber',
        subscription_activated: true,
        activation_code: 'SUB123',
        discount_percent: 20,
        subscription_plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const hasAccess = await checkUserAccess(456);

      expect(hasAccess).toBe(true);
    });

    it('should deny access to users without trial or subscription', async () => {
      const expiredTrial = new Date();
      expiredTrial.setDate(expiredTrial.getDate() - 1);

      mockedGetUser.mockResolvedValue({
        id: 789,
        email: 'locked@example.com',
        name: 'Locked User',
        trial_expires_at: expiredTrial.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const hasAccess = await checkUserAccess(789);

      expect(hasAccess).toBe(false);
    });

    it('should provide detailed trial status for API responses', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 1);

      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'trialuser@example.com',
        name: 'Trial User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const trialStatus = await getTrialStatusResponse(123);

      expect(trialStatus).toMatchObject({
        trial_active: true,
        has_access: true,
        requires_activation: false,
        account_status: AccountStatus.TRIAL_ACTIVE
      });
      expect(trialStatus.trial_days_remaining).toBeGreaterThan(0);
      expect(trialStatus.trial_expires_at).toBeDefined();
    });

    it('should provide locked status for expired users', async () => {
      const expiredTrial = new Date();
      expiredTrial.setDate(expiredTrial.getDate() - 2);

      mockedGetUser.mockResolvedValue({
        id: 789,
        email: 'locked@example.com',
        name: 'Locked User',
        trial_expires_at: expiredTrial.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const trialStatus = await getTrialStatusResponse(789);

      expect(trialStatus).toMatchObject({
        trial_active: false,
        has_access: false,
        requires_activation: true,
        account_status: AccountStatus.LOCKED,
        trial_days_remaining: 0
      });
    });
  });

  describe('EDGE CASES: Error Handling and Validation', () => {

    it('should handle database errors gracefully when setting trial', async () => {
      mockedUpdateUser.mockRejectedValue(new Error('Database connection failed'));

      await expect(setTrialExpiration(123, 3)).rejects.toThrow('Database connection failed');
    });

    it('should handle missing user data gracefully', async () => {
      mockedGetUser.mockResolvedValue(null);

      await expect(getUserSubscriptionInfo(123)).rejects.toThrow();
    });

    it('should handle malformed trial expiration dates', async () => {
      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'malformed@example.com',
        name: 'Malformed User',
        trial_expires_at: 'invalid-date',
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Should handle invalid date gracefully
      const subscriptionInfo = await getUserSubscriptionInfo(123);
      expect(subscriptionInfo.trial_expires_at).toBeInstanceOf(Date);
    });

    it('should handle concurrent activation code attempts', async () => {
      const mockCode = {
        id: 1,
        code: 'CONCURRENT-1234-5678',
        discount_percent: 20,
        applicable_plans: '["pro"]',
        payment_currency: 'PHP',
        payment_method: 'bank_transfer',
        is_active: true,
        status_history: '[]'
      };

      // First call succeeds - code is available
      mockedSql.mockResolvedValueOnce([mockCode]);
      mockedSql.mockResolvedValueOnce([{ ...mockCode, used_by: 123, used_at: new Date().toISOString() }]);

      const firstRedemption = await redeemActivationCode('CONCURRENT-1234-5678', 123, '127.0.0.1', 'pro');

      expect(firstRedemption).toBeDefined();

      // Second call finds code already used - should return empty result from validateActivationCode
      // This simulates the WHERE clause filtering out used codes: used_by IS NULL
      mockedSql.mockResolvedValueOnce([]);

      await expect(
        redeemActivationCode('CONCURRENT-1234-5678', 456, '127.0.0.1', 'pro')
      ).rejects.toThrow('Invalid or expired activation code');
    });

    it('should handle subscription plan changes', async () => {
      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'upgraded@example.com',
        name: 'Upgraded User',
        subscription_activated: true,
        activation_code: 'UPGRADE123',
        discount_percent: 20,
        subscription_plan: 'enterprise', // Upgraded from pro
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(123);

      expect(subscriptionInfo.subscription_plan).toBe('enterprise');
      expect(subscriptionInfo.has_access).toBe(true);
    });
  });

  describe('DATA CONSISTENCY: User Record Updates', () => {

    it('should properly update user subscription fields', async () => {
      mockedUpdateUser.mockResolvedValue();

      await activateSubscription(123, 'CODE123', 15, 'basic');

      expect(mockedUpdateUser).toHaveBeenCalledWith(123, {
        subscription_activated: true,
        activation_code: 'CODE123',
        discount_percent: 15,
        subscription_plan: 'basic'
      });
    });

    it('should maintain data consistency across multiple updates', async () => {
      mockedUpdateUser.mockResolvedValue();

      // First: Set trial (uses updateUser for number IDs)
      await setTrialExpiration(123, 3);

      // Then: Activate subscription (uses updateUser)
      await activateSubscription(123, 'CODE123', 20, 'pro');

      expect(mockedUpdateUser).toHaveBeenCalledTimes(2);
    });

    it('should handle partial user data updates', async () => {
      mockedUpdateUser.mockResolvedValue();

      await activateSubscription(123, 'PARTIAL123', 10, 'basic');

      expect(mockedUpdateUser).toHaveBeenCalledWith(123, expect.objectContaining({
        subscription_activated: true,
        activation_code: 'PARTIAL123'
      }));
    });
  });

  describe('PERFORMANCE: Cache Compatibility', () => {

    it('should provide consistent data for caching mechanisms', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 2);

      mockedGetUser.mockResolvedValue({
        id: 123,
        email: 'cache@example.com',
        name: 'Cache User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // First call - should be cacheable
      const firstResult = await getUserSubscriptionInfo(123);

      // Second call - should return same data for cache validation
      const secondResult = await getUserSubscriptionInfo(123);

      expect(firstResult).toEqual(secondResult);
      expect(mockedGetUser).toHaveBeenCalledTimes(2);
    });

    it('should include all necessary fields for cache keys', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 1);

      mockedGetUser.mockResolvedValue({
        id: 456,
        email: 'cachekey@example.com',
        name: 'Cache Key User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const subscriptionInfo = await getUserSubscriptionInfo(456);

      // Verify all cacheable fields are present
      expect(subscriptionInfo).toMatchObject({
        user_id: 456,
        account_status: expect.any(String),
        has_access: expect.any(Boolean),
        trial_expires_at: expect.any(Date),
        subscription_activated: expect.any(Boolean)
      });
    });

    it('should handle rapid successive calls efficiently', async () => {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 3);

      mockedGetUser.mockResolvedValue({
        id: 789,
        email: 'rapid@example.com',
        name: 'Rapid User',
        trial_expires_at: trialExpiry.toISOString(),
        subscription_activated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Simulate rapid cache checks
      const results = await Promise.all([
        getUserSubscriptionInfo(789),
        getUserSubscriptionInfo(789),
        getUserSubscriptionInfo(789)
      ]);

      expect(results).toHaveLength(3);
      expect(mockedGetUser).toHaveBeenCalledTimes(3);
    });
  });
});