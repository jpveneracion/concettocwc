// src/__tests__/payment/verification-api.test.ts

import { POST, GET } from '@/app/api/payment-verifications/route';
import { validateScreenshotFile } from '@/lib/pinata';

describe('Payment Verifications API', () => {
  describe('POST /api/payment-verifications', () => {
    it('should create new payment verification', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

      const request = new Request('http://localhost/api/payment-verifications', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: 'pro-plan-id',
          screenshot_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          reference_number: 'GCASH-12345',
          notes: 'Payment completed via GCash'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.verification_id).toBeDefined();
    });

    it('should reject invalid file types', async () => {
      const request = new Request('http://localhost/api/payment-verifications', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: 'pro-plan-id',
          screenshot_base64: 'data:application/pdf;base64,JVBERi0xLjUK...'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('image');
    });
  });

  describe('GET /api/payment-verifications', () => {
    it('should return paginated verifications for admin', async () => {
      const request = new Request('http://localhost/api/payment-verifications?status=pending&limit=10', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verifications).toBeInstanceOf(Array);
      expect(data.total).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    it('should reject non-admin requests', async () => {
      // Mock session without admin role
      const request = new Request('http://localhost/api/payment-verifications', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('admin');
    });
  });
});