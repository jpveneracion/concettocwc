// src/__tests__/lib/payment-verification.test.ts

import { checkAutomaticVerificationMatch } from '@/lib/payment-verification';
import { sql } from '@/lib/db';

// Mock the database
jest.mock('@/lib/db');

describe('checkAutomaticVerificationMatch', () => {
  let mockSql: jest.MockedFunction<typeof sql>;

  beforeEach(() => {
    mockSql = sql as jest.MockedFunction<typeof sql>;
    mockSql.mockClear();
  });

  test('rejects invalid reference number format', async () => {
    const verification = {
      id: '123',
      reference_number: 'ABC123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Invalid reference number format');
  });

  test('routes non-standard format to manual verification', async () => {
    const verification = {
      id: '123',
      reference_number: '1234567890', // 10 digits, not 13
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Non-standard format');
  });

  test('rejects when no webhook data found', async () => {
    mockSql.mockResolvedValue([]);

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('No matching webhook data');
  });

  test('rejects when amount mismatch', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 500.00,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    mockSql
      .mockResolvedValueOnce(webhookData)
      .mockResolvedValueOnce([{count: '0'}])
      .mockResolvedValueOnce([{amount: '999.00'}]);

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Amount mismatch');
    expect(result.reason).toContain('expected ₱999');
    expect(result.reason).toContain('got ₱500');
  });

  test('rejects when time window mismatch', async () => {
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 30); // 30 hours ago

    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.00,
      transaction_time: oldDate,
      received_at: new Date()
    }];

    mockSql
      .mockResolvedValueOnce(webhookData)
      .mockResolvedValueOnce([{count: '0'}])
      .mockResolvedValueOnce([{amount: '999.00'}]);

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Time window mismatch');
    expect(result.reason).toContain('hours difference');
  });

  test('rejects ambiguous matches (duplicates)', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.00,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    mockSql
      .mockResolvedValueOnce(webhookData)
      .mockResolvedValueOnce([{count: '1'}]) // Duplicate found
      .mockResolvedValueOnce([{amount: '999.00'}]);

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Multiple verifications with same reference number');
  });

  test('rejects when plan not found', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.00,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    // Simple sequential mock - no query string matching
    mockSql.mockReset();
    mockSql
      .mockResolvedValueOnce([webhookData])  // Call 1: webhook data lookup
      .mockResolvedValueOnce([{count: '0'}])  // Call 2: duplicate check
      .mockResolvedValueOnce([]);               // Call 3: plan lookup (empty = not found)

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Plan not found');
  });

  test('approves perfect match', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.00,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    // Use sequential approach
    let callCount = 0;
    mockSql.mockImplementation(() => {
      callCount++;
      switch (callCount) {
        case 1: // Webhook data lookup
          return Promise.resolve(webhookData);
        case 2: // Duplicate check
          return Promise.resolve([{count: '0'}]);
        case 3: // Plan lookup
          return Promise.resolve([{amount: '999.00'}]);
        default:
          return Promise.resolve([]);
      }
    });

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(true);
    expect(result.reason).toContain('Perfect match');
    expect(result.webhookData).toBeDefined();
    expect(result.webhookData?.id).toBe('webhook-123');
  });

  test('approves perfect match with exact amount (zero tolerance)', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.00,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    mockSql
      .mockResolvedValueOnce(webhookData)
      .mockResolvedValueOnce([{count: '0'}])
      .mockResolvedValueOnce([{amount: '999.00'}]);

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(true);
  });

  test('rejects tiny amount difference (0.02)', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.02,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    // Use sequential approach
    let callCount = 0;
    mockSql.mockImplementation(() => {
      callCount++;
      switch (callCount) {
        case 1: // Webhook data lookup
          return Promise.resolve(webhookData);
        case 2: // Duplicate check
          return Promise.resolve([{count: '0'}]);
        case 3: // Plan lookup
          return Promise.resolve([{amount: '999.00'}]);
        default:
          return Promise.resolve([]);
      }
    });

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    expect(result.shouldAutoApprove).toBe(false);
    expect(result.reason).toContain('Amount mismatch');
  });

  test('approves minimal amount difference (0.01)', async () => {
    const webhookData = [{
      id: 'webhook-123',
      transaction_number: '1234567890123',
      amount: 999.01,
      transaction_time: new Date(),
      received_at: new Date()
    }];

    // Use sequential approach
    let callCount = 0;
    mockSql.mockImplementation(() => {
      callCount++;
      switch (callCount) {
        case 1: // Webhook data lookup
          return Promise.resolve(webhookData);
        case 2: // Duplicate check
          return Promise.resolve([{count: '0'}]);
        case 3: // Plan lookup
          return Promise.resolve([{amount: '999.00'}]);
        default:
          return Promise.resolve([]);
      }
    });

    const verification = {
      id: '123',
      reference_number: '1234567890123',
      plan_id: 'plan-123',
      submitted_at: new Date(),
      created_at: new Date()
    };

    const result = await checkAutomaticVerificationMatch(verification as any);

    // Amount difference: |999.01 - 999.00| = 0.01, which is NOT > 0.01, so should pass
    expect(result.shouldAutoApprove).toBe(true);
  });
});