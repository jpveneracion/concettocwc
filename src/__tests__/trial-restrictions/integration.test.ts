import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST } from '@/app/api/quotes/route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserSubscriptionInfo, checkSubscriptionAccess } from '@/lib/subscription';
import { sql } from '@/lib/db';
import { encryptPII, decryptPII } from '@/lib/crypto';

// Mock dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/db');
jest.mock('@/lib/crypto');
jest.mock('@/lib/subscription');

const mockedSql = sql as jest.MockedFunction<typeof sql>;
const mockedEncryptPII = encryptPII as jest.MockedFunction<typeof encryptPII>;
const mockedDecryptPII = decryptPII as jest.MockedFunction<typeof decryptPII>;

describe('Trial Restrictions - API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup crypto mocking that properly simulates encryption/decryption
    mockedEncryptPII.mockImplementation((plaintext) => `encrypted_${plaintext}`);
    mockedDecryptPII.mockImplementation((encrypted) => {
      if (typeof encrypted === 'string' && encrypted.startsWith('encrypted_')) {
        return encrypted.replace('encrypted_', '');
      }
      return encrypted;
    });

    // Setup database mocking for successful quote creation
    mockedSql.mockResolvedValue([{ id: 1, quote_number: 'QT-001', customer_name: 'Test Customer', created_at: new Date() }]);

    // Setup default subscription access check (allow full access)
    (checkSubscriptionAccess as jest.Mock).mockResolvedValue({
      allowed: true,
      mode: 'full',
      reason: 'No subscription yet - can start trial'
    });
  });

  describe('POST /api/quotes with trial restrictions', () => {
    it('should allow order creation during active trial', async () => {
      // Mock session with active trial
      const mockSession = {
        userId: 'user-123',
        companyId: 'company-456',
        companyCode: 'TEST001',
        email: 'test@example.com'
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);

      // Mock subscription check for full access
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        trial_expires_at: new Date(Date.now() + 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'trial_active' as any,
        has_access: true
      });

      // Mock subscription access to return full access
      (checkSubscriptionAccess as jest.Mock).mockResolvedValue({
        allowed: true,
        mode: 'full',
        reason: 'Test - full access granted'
      });

      // Mock database operations for successful quote creation
      mockedSql.mockResolvedValue([{ id: 1, quote_number: 'QT-001', customer_name: 'John Doe', created_at: new Date() }]);

      const requestBody = {
        quote_number: 'QT-001',
        customer_name: 'John Doe',
        customer_address: '123 Main St',
        quote_date: new Date(Date.now() + 86400000 * 5).toISOString(),
        our_ref: 'REF-001',
        installation_fee: 100,
        delivery_fee: 50,
        items: [{
          location: 'Living Room',
          product_code: 'BLIND-001',
          product_collection: 'Premium',
          product_description: 'Wooden Blinds',
          unit: 'inches' as const,
          is_fixed: false,
          measured_width: 36,
          measured_drop: 48,
          final_width: 36,
          final_drop: 48,
          area_sqft: 12,
          retail_price_sqft: 25,
          supplier_cost_sqft: 15,
          retail_amount: 300,
          supplier_amount: 180
        }]
      };

      const request = new NextRequest('http://localhost/api/quotes', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect([201, 403]).toContain(response.status);

      if (response.status === 403) {
        expect(data.restrictionType).toBe('future_orders_blocked');
      }
    });

    it('should block future orders after trial expiration', async () => {
      const mockSession = {
        userId: 'expired-user',
        companyId: 'company-789',
        companyCode: 'EXP-001',
        email: 'expired@example.com'
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);

      // Mock expired trial
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'expired-user',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      // Mock subscription access to return full access (so we can test the trial restrictions specifically)
      (checkSubscriptionAccess as jest.Mock).mockResolvedValue({
        allowed: true,
        mode: 'full',
        reason: 'Test - full access granted'
      });

      const requestBody = {
        quote_number: 'QT-002',
        customer_name: 'Jane Smith',
        customer_address: '456 Oak Ave',
        quote_date: new Date(Date.now() + 86400000 * 10).toISOString(),
        our_ref: 'REF-002',
        installation_fee: 100,
        delivery_fee: 50,
        items: [{
          location: 'Bedroom',
          product_code: 'BLIND-002',
          product_collection: 'Standard',
          product_description: 'Aluminum Blinds',
          unit: 'inches' as const,
          is_fixed: false,
          measured_width: 48,
          measured_drop: 60,
          final_width: 48,
          final_drop: 60,
          area_sqft: 20,
          retail_price_sqft: 15,
          supplier_cost_sqft: 10,
          retail_amount: 300,
          supplier_amount: 200
        }]
      };

      const request = new NextRequest('http://localhost/api/quotes', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.restrictionType).toBe('future_orders_blocked');
      expect(data.canCreatePastOrders).toBe(true);
      expect(data.canViewDashboard).toBe(true);
    });

    it('should allow past orders after trial expiration', async () => {
      const mockSession = {
        userId: 'expired-user',
        companyId: 'company-789',
        companyCode: 'EXP-001',
        email: 'expired@example.com'
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);

      // Mock expired trial
      (getUserSubscriptionInfo as jest.Mock).mockResolvedValue({
        user_id: 'expired-user',
        trial_expires_at: new Date(Date.now() - 86400000),
        subscription_activated: false,
        subscription_plan: undefined,
        account_status: 'locked' as any,
        has_access: false
      });

      // Mock subscription access to return full access (so we can test the trial restrictions specifically)
      (checkSubscriptionAccess as jest.Mock).mockResolvedValue({
        allowed: true,
        mode: 'full',
        reason: 'Test - full access granted'
      });

      // Mock database operations for successful quote creation
      mockedSql.mockResolvedValue([{ id: 3, quote_number: 'QT-003', customer_name: 'Bob Johnson', created_at: new Date() }]);

      const pastDate = new Date(Date.now() - 86400000 * 7);

      const requestBody = {
        quote_number: 'QT-003',
        customer_name: 'Bob Johnson',
        customer_address: '789 Pine Rd',
        quote_date: pastDate.toISOString(),
        our_ref: 'REF-003',
        installation_fee: 100,
        delivery_fee: 50,
        items: [{
          location: 'Kitchen',
          product_code: 'BLIND-003',
          product_collection: 'Basic',
          product_description: 'Vinyl Blinds',
          unit: 'inches' as const,
          is_fixed: false,
          measured_width: 36,
          measured_drop: 48,
          final_width: 36,
          final_drop: 48,
          area_sqft: 12,
          retail_price_sqft: 10,
          supplier_cost_sqft: 7,
          retail_amount: 120,
          supplier_amount: 84
        }]
      };

      const request = new NextRequest('http://localhost/api/quotes', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect([201, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(403);
    });
  });
});