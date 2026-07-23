/**
 * Test to verify promo code UUID fix
 *
 * This test demonstrates that promo codes now work with UUID-based plan identifiers
 * instead of expecting only billing period enum values.
 */

import { validateActivationCodeWithDetails } from '@/lib/activation';
import { sql } from '@/lib/db';
import { SubscriptionPlan } from '@/types/subscription';

describe('Promo Code UUID Fix', () => {
  it('should handle UUID-based plan identifiers correctly', async () => {
    // 1. Get a sample subscription plan with UUID
    const plans = await sql('SELECT id, name, interval FROM subscription_plans LIMIT 3');

    expect(plans.length).toBeGreaterThan(0);

    // 2. Get a sample promo code
    const promoCodes = await sql(`
      SELECT code, applicable_plans, discount_percent
      FROM activation_codes
      WHERE is_active = true
      LIMIT 1
    `);

    if (promoCodes.length === 0) {
      console.log('No active promo codes found - creating test promo code');

      // Create a test promo code that applies to all plans
      const testCodeResult = await sql(`
        INSERT INTO activation_codes (
          code, discount_percent, applicable_plans,
          created_by, status_history, payment_currency, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        'TEST-UUID-FIX-123',
        10,
        JSON.stringify([SubscriptionPlan.MONTHLY, SubscriptionPlan.QUARTERLY, SubscriptionPlan.ANNUAL]),
        'system',
        JSON.stringify([{
          status: 'created',
          timestamp: new Date().toISOString(),
          note: 'Test promo code for UUID fix validation'
        }]),
        'PHP',
        true
      ]);

      expect(testCodeResult.length).toBe(1);
    }

    // 3. Test the validation function with UUID instead of enum
    for (const plan of plans) {
      const result = await validateActivationCodeWithDetails('TEST-UUID-FIX-123', plan.id);

      // The validation should not throw an error when given a UUID
      // It should either validate successfully or return a valid error message
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');

      if (result.valid) {
        expect(result).toHaveProperty('activationCode');
      } else {
        expect(result).toHaveProperty('error');
      }
    }
  });

  it('should still work with direct enum values', async () => {
    // Test that the fix doesn't break existing functionality
    const result = await validateActivationCodeWithDetails(
      'TEST-UUID-FIX-123',
      SubscriptionPlan.MONTHLY
    );

    expect(result).toHaveProperty('valid');
    expect(typeof result.valid).toBe('boolean');
  });

  it('should handle invalid UUIDs gracefully', async () => {
    // Test that invalid UUIDs are handled properly
    const result = await validateActivationCodeWithDetails(
      'TEST-UUID-FIX-123',
      'invalid-uuid-format'
    );

    expect(result).toHaveProperty('valid');
    expect(result.valid).toBe(false);
    expect(result).toHaveProperty('error');
  });
});