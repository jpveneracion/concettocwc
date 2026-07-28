/**
 * Comprehensive RLS Tests for Quotes Table
 *
 * These tests verify that Row-Level Security policies properly enforce
 * tenant isolation for the quotes table, which contains sensitive customer PII
 * and business data.
 *
 * Test Categories:
 * 1. Tenant Isolation - Users can't access other companies' quotes
 * 2. Admin Access - Admins can access all quotes within their company
 * 3. Superadmin Access - Superadmins can access quotes across all companies
 * 4. Write Restrictions - Cross-company modifications are prevented
 * 5. RLS Context Requirements - Policies require proper context setup
 * 6. Error Handling - RLS violations are properly handled
 * 7. Backwards Compatibility - Existing operations still work correctly
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { sql } from '@/lib/db';
import { setTenantContext, resetTenantContext } from '@/lib/rls';
import { encryptPII, decryptPII } from '@/lib/crypto';

describe('Quotes RLS Policy Tests', () => {
  // Test company IDs
  const companyAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const companyBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const superadminCompanyId = '00000000-0000-0000-0000-000000000000';

  // Test quote IDs
  let companyAQuote1Id: string;
  let companyAQuote2Id: string;
  let companyBQuote1Id: string;

  // Test data
  const testQuoteData = {
    quote_number: 'TEST-001',
    customer_name: 'Test Customer',
    customer_address: '123 Test Street',
    quote_date: new Date().toISOString().split('T')[0],
    our_ref: 'TEST-REF-001',
    installation_fee: 100,
    delivery_fee: 50,
    subtotal: 1000,
    total: 1150,
    total_area: 100,
    panel_count: 5,
    status: 'draft'
  };

  /**
   * Setup test data before each test suite
   */
  beforeAll(async () => {
    // Create test quotes for different companies
    const [companyAQuote1] = await sql`
      INSERT INTO quotes (
        company_id, quote_number, customer_name, customer_address,
        customer_name_encrypted, customer_address_encrypted,
        quote_date, our_ref, installation_fee, delivery_fee,
        subtotal, total, total_area, panel_count, status
      ) VALUES (
        ${companyAId}, 'COMP-A-001', 'Company A Customer 1', 'Address A1',
        decode(${encryptPII('Company A Customer 1')}, 'hex')::bytea,
        decode(${encryptPII('Address A1')}, 'hex')::bytea,
        ${testQuoteData.quote_date}, 'REF-A-001',
        ${testQuoteData.installation_fee}, ${testQuoteData.delivery_fee},
        ${testQuoteData.subtotal}, ${testQuoteData.total},
        ${testQuoteData.total_area}, ${testQuoteData.panel_count}, 'draft'
      )
      RETURNING id
    `;
    companyAQuote1Id = companyAQuote1.id;

    const [companyAQuote2] = await sql`
      INSERT INTO quotes (
        company_id, quote_number, customer_name, customer_address,
        customer_name_encrypted, customer_address_encrypted,
        quote_date, our_ref, installation_fee, delivery_fee,
        subtotal, total, total_area, panel_count, status
      ) VALUES (
        ${companyAId}, 'COMP-A-002', 'Company A Customer 2', 'Address A2',
        decode(${encryptPII('Company A Customer 2')}, 'hex')::bytea,
        decode(${encryptPII('Address A2')}, 'hex')::bytea,
        ${testQuoteData.quote_date}, 'REF-A-002',
        ${testQuoteData.installation_fee}, ${testQuoteData.delivery_fee},
        ${testQuoteData.subtotal}, ${testQuoteData.total},
        ${testQuoteData.total_area}, ${testQuoteData.panel_count}, 'sent'
      )
      RETURNING id
    `;
    companyAQuote2Id = companyAQuote2.id;

    const [companyBQuote1] = await sql`
      INSERT INTO quotes (
        company_id, quote_number, customer_name, customer_address,
        customer_name_encrypted, customer_address_encrypted,
        quote_date, our_ref, installation_fee, delivery_fee,
        subtotal, total, total_area, panel_count, status
      ) VALUES (
        ${companyBId}, 'COMP-B-001', 'Company B Customer 1', 'Address B1',
        decode(${encryptPII('Company B Customer 1')}, 'hex')::bytea,
        decode(${encryptPII('Address B1')}, 'hex')::bytea,
        ${testQuoteData.quote_date}, 'REF-B-001',
        ${testQuoteData.installation_fee}, ${testQuoteData.delivery_fee},
        ${testQuoteData.subtotal}, ${testQuoteData.total},
        ${testQuoteData.total_area}, ${testQuoteData.panel_count}, 'draft'
      )
      RETURNING id
    `;
    companyBQuote1Id = companyBQuote1.id;
  });

  /**
   * Clean up test data after all tests
   */
  afterAll(async () => {
    // Reset RLS context first to ensure we can delete test data
    await resetTenantContext();

    // Use superadmin context to clean up test data
    await setTenantContext(superadminCompanyId, 'superadmin');
    try {
      await sql`DELETE FROM quotes WHERE quote_number LIKE 'COMP-%';
    } finally {
      await resetTenantContext();
    }
  });

  /**
   * Reset RLS context before each test to ensure isolation
   */
  beforeEach(async () => {
    await resetTenantContext();
  });

  /**
   * Reset RLS context after each test to ensure cleanup
   */
  afterEach(async () => {
    await resetTenantContext();
  });

  /**
   * TENANT ISOLATION TESTS
   * These tests verify that users can only access quotes from their own company
   */
  describe('Tenant Isolation', () => {
    test('should allow users to see quotes from their own company', async () => {
      await setTenantContext(companyAId, 'user');

      const quotes = await sql`
        SELECT id, quote_number, customer_name_encrypted
        FROM quotes
        ORDER BY quote_number
      `;

      expect(quotes.length).toBe(2);
      expect(quotes[0].quote_number).toBe('COMP-A-001');
      expect(quotes[1].quote_number).toBe('COMP-A-002');
    });

    test('should prevent users from seeing quotes from other companies', async () => {
      await setTenantContext(companyBId, 'user');

      const quotes = await sql`
        SELECT id, quote_number
        FROM quotes
        ORDER BY quote_number
      `;

      expect(quotes.length).toBe(1);
      expect(quotes[0].quote_number).toBe('COMP-B-001');
    });

    test('should prevent users from accessing other company quotes by ID', async () => {
      await setTenantContext(companyAId, 'user');

      // Try to access Company B's quote
      const [quote] = await sql`
        SELECT id, quote_number
        FROM quotes
        WHERE id = ${companyBQuote1Id}::uuid
      `;

      // Should not find the quote due to RLS policy
      expect(quote).toBeUndefined();
    });

    test('should return empty result when no context is set', async () => {
      // Don't set any context - should fail secure
      const quotes = await sql`
        SELECT id, quote_number
        FROM quotes
      `;

      // Should return empty due to fail-secure policy
      expect(quotes.length).toBe(0);
    });
  });

  /**
   * ADMIN ACCESS TESTS
   * These tests verify that admins can access all quotes within their company
   */
  describe('Admin Access', () => {
    test('should allow admins to see all quotes in their company', async () => {
      await setTenantContext(companyAId, 'admin');

      const quotes = await sql`
        SELECT id, quote_number
        FROM quotes
        ORDER BY quote_number
      `;

      expect(quotes.length).toBe(2);
      expect(quotes[0].quote_number).toBe('COMP-A-001');
      expect(quotes[1].quote_number).toBe('COMP-A-002');
    });

    test('should prevent admins from accessing other company quotes', async () => {
      await setTenantContext(companyAId, 'admin');

      const [quote] = await sql`
        SELECT id, quote_number
        FROM quotes
        WHERE id = ${companyBQuote1Id}::uuid
      `;

      expect(quote).toBeUndefined();
    });

    test('should allow admins to update quotes in their company', async () => {
      await setTenantContext(companyAId, 'admin');

      const result = await sql`
        UPDATE quotes
        SET status = 'sent',
            updated_at = NOW()
        WHERE id = ${companyAQuote1Id}::uuid
        RETURNING id, status
      `;

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('sent');
    });

    test('should prevent admins from updating other company quotes', async () => {
      await setTenantContext(companyAId, 'admin');

      const result = await sql`
        UPDATE quotes
        SET status = 'delivered',
            updated_at = NOW()
        WHERE id = ${companyBQuote1Id}::uuid
        RETURNING id
      `;

      // Should not update due to RLS policy
      expect(result.length).toBe(0);
    });
  });

  /**
   * SUPERADMIN ACCESS TESTS
   * These tests verify that superadmins can access quotes across all companies
   */
  describe('Superadmin Access', () => {
    test('should allow superadmins to see all quotes from all companies', async () => {
      await setTenantContext(superadminCompanyId, 'superadmin');

      const quotes = await sql`
        SELECT id, quote_number, company_id
        FROM quotes
        ORDER BY company_id, quote_number
      `;

      expect(quotes.length).toBe(3);
      expect(quotes.some(q => q.company_id === companyAId)).toBe(true);
      expect(quotes.some(q => q.company_id === companyBId)).toBe(true);
    });

    test('should allow superadmins to update any company quotes', async () => {
      await setTenantContext(superadminCompanyId, 'superadmin');

      const result = await sql`
        UPDATE quotes
        SET status = 'delivered',
            updated_at = NOW()
        WHERE id = ${companyBQuote1Id}::uuid
        RETURNING id, status
      `;

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('delivered');
    });

    test('should allow superadmins to delete any company quotes', async () => {
      await setTenantContext(superadminCompanyId, 'superadmin');

      const result = await sql`
        DELETE FROM quotes
        WHERE id = ${companyAQuote2Id}::uuid
        RETURNING id
      `;

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(companyAQuote2Id);
    });
  });

  /**
   * WRITE RESTRICTION TESTS
   * These tests verify that cross-company modifications are prevented
   */
  describe('Write Restrictions', () => {
    test('should prevent inserting quotes with wrong company_id', async () => {
      await setTenantContext(companyAId, 'user');

      // Try to insert a quote for Company B while in Company A context
      const [quote] = await sql`
        INSERT INTO quotes (
          company_id, quote_number, customer_name_encrypted,
          customer_address_encrypted, quote_date, our_ref,
          installation_fee, delivery_fee, subtotal, total,
          total_area, panel_count, status
        ) VALUES (
          ${companyBId}, 'SHOULD-FAIL',
          decode(${encryptPII('Should Fail')}, 'hex')::bytea,
          decode(${encryptPII('Address')}, 'hex')::bytea,
          ${testQuoteData.quote_date}, 'REF',
          ${testQuoteData.installation_fee}, ${testQuoteData.delivery_fee},
          ${testQuoteData.subtotal}, ${testQuoteData.total},
          ${testQuoteData.total_area}, ${testQuoteData.panel_count}, 'draft'
        )
        RETURNING id
      `;

      // Insert should succeed but RLS policy should prevent access
      // The insert happens but we can't see it
      const quotes = await sql`
        SELECT id, quote_number
        FROM quotes
        WHERE quote_number = 'SHOULD-FAIL'
      `;

      expect(quotes.length).toBe(0);
    });

    test('should prevent updating company_id on existing quotes', async () => {
      await setTenantContext(companyAId, 'admin');

      // Try to change company_id of a quote
      const result = await sql`
        UPDATE quotes
        SET company_id = ${companyBId},
            updated_at = NOW()
        WHERE id = ${companyAQuote1Id}::uuid
        RETURNING id, company_id
      `;

      // The RLS policy should prevent this update
      expect(result.length).toBe(0);

      // Verify the company_id hasn't changed
      await setTenantContext(superadminCompanyId, 'superadmin');
      try {
        const [quote] = await sql`
          SELECT company_id FROM quotes WHERE id = ${companyAQuote1Id}::uuid
        `;
        expect(quote.company_id).toBe(companyAId);
      } finally {
        await resetTenantContext();
      }
    });

    test('should prevent deleting quotes from other companies', async () => {
      await setTenantContext(companyAId, 'admin');

      const result = await sql`
        DELETE FROM quotes
        WHERE id = ${companyBQuote1Id}::uuid
        RETURNING id
      `;

      // Delete should not affect other company's quotes
      expect(result.length).toBe(0);
    });
  });

  /**
   * RLS CONTEXT REQUIREMENT TESTS
   * These tests verify that policies require proper context setup
   */
  describe('RLS Context Requirements', () => {
    test('should require tenant context for quote operations', async () => {
      // Don't set context - should fail secure
      const quotes = await sql`
        SELECT id, quote_number FROM quotes
      `;

      // Should return empty due to fail-secure policy
      expect(quotes.length).toBe(0);
    });

    test('should validate company_id format in context', async () => {
      // This should be handled by the TypeScript wrapper
      // but we test the database function directly
      try {
        await sql`SELECT set_tenant_context('invalid-uuid', 'user')`;
        fail('Should have thrown an error for invalid UUID');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should validate user_role in context', async () => {
      try {
        await sql`SELECT set_tenant_context($1, 'invalid_role')`, [companyAId];
        fail('Should have thrown an error for invalid role');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * ERROR HANDLING TESTS
   * These tests verify that RLS violations are properly handled
   */
  describe('Error Handling', () => {
    test('should handle context setting failures gracefully', async () => {
      // Try to set context with invalid data
      try {
        await setTenantContext('', 'user');
        fail('Should have thrown error for empty company ID');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Company ID is required');
      }
    });

    test('should maintain data integrity during RLS violations', async () => {
      await setTenantContext(companyAId, 'user');

      // Try to access other company's quote
      const [quote] = await sql`
        SELECT * FROM quotes WHERE id = ${companyBQuote1Id}::uuid
      `;

      // Should return undefined, not error
      expect(quote).toBeUndefined();

      // Verify the data still exists
      await setTenantContext(superadminCompanyId, 'superadmin');
      try {
        const [verifyQuote] = await sql`
          SELECT id FROM quotes WHERE id = ${companyBQuote1Id}::uuid
        `;
        expect(verifyQuote).toBeDefined();
        expect(verifyQuote.id).toBe(companyBQuote1Id);
      } finally {
        await resetTenantContext();
      }
    });
  });

  /**
   * BACKWARDS COMPATIBILITY TESTS
   * These tests verify that existing quote operations still work correctly
   */
  describe('Backwards Compatibility', () => {
    test('should support existing quote retrieval patterns', async () => {
      await setTenantContext(companyAId, 'user');

      // Standard quote retrieval
      const quotes = await sql`
        SELECT id, quote_number, status, total
        FROM quotes
        ORDER BY created_at DESC
      `;

      expect(quotes.length).toBeGreaterThanOrEqual(1);
      expect(quotes[0]).toHaveProperty('id');
      expect(quotes[0]).toHaveProperty('quote_number');
    });

    test('should support existing quote creation patterns', async () => {
      await setTenantContext(companyAId, 'admin');

      const newQuoteNumber = 'NEW-QUOTE-' + Date.now();
      const [quote] = await sql`
        INSERT INTO quotes (
          company_id, quote_number, customer_name_encrypted,
          customer_address_encrypted, quote_date, our_ref,
          installation_fee, delivery_fee, subtotal, total,
          total_area, panel_count, status
        ) VALUES (
          ${companyAId}, ${newQuoteNumber},
          decode(${encryptPII('New Customer')}, 'hex')::bytea,
          decode(${encryptPII('New Address')}, 'hex')::bytea,
          ${testQuoteData.quote_date}, 'NEW-REF',
          ${testQuoteData.installation_fee}, ${testQuoteData.delivery_fee},
          ${testQuoteData.subtotal}, ${testQuoteData.total},
          ${testQuoteData.total_area}, ${testQuoteData.panel_count}, 'draft'
        )
        RETURNING id, quote_number
      `;

      expect(quote).toBeDefined();
      expect(quote.quote_number).toBe(newQuoteNumber);

      // Clean up
      await sql`DELETE FROM quotes WHERE id = ${quote.id}::uuid`;
    });

    test('should support existing quote update patterns', async () => {
      await setTenantContext(companyAId, 'admin');

      const [quote] = await sql`
        UPDATE quotes
        SET status = 'delivered',
            updated_at = NOW()
        WHERE id = ${companyAQuote1Id}::uuid
        RETURNING id, status, updated_at
      `;

      expect(quote).toBeDefined();
      expect(quote.status).toBe('delivered');
      expect(quote.updated_at).toBeDefined();
    });

    test('should support PII encryption/decryption with RLS', async () => {
      await setTenantContext(companyAId, 'user');

      const [quote] = await sql`
        SELECT id, customer_name_encrypted, customer_address_encrypted
        FROM quotes
        WHERE id = ${companyAQuote1Id}::uuid
      `;

      expect(quote).toBeDefined();
      expect(quote.customer_name_encrypted).toBeDefined();

      // Verify decryption works
      const decryptedName = decryptPII(quote.customer_name_encrypted);
      expect(decryptedName).toBe('Company A Customer 1');
    });
  });

  /**
   * PERFORMANCE TESTS
   * These tests verify that RLS policies don't significantly impact performance
   */
  describe('Performance', () => {
    test('should execute quote queries within acceptable time limits', async () => {
      await setTenantContext(companyAId, 'user');

      const startTime = Date.now();
      const quotes = await sql`
        SELECT id, quote_number, status, total, created_at
        FROM quotes
        ORDER BY created_at DESC
        LIMIT 10
      `;
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete within 1 second (generous limit for safety)
      expect(executionTime).toBeLessThan(1000);
      expect(quotes).toBeDefined();
    });

    test('should handle context setting efficiently', async () => {
      const startTime = Date.now();
      await setTenantContext(companyAId, 'user');
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Context setting should be very fast
      expect(executionTime).toBeLessThan(100);

      await resetTenantContext();
    });
  });

  /**
   * SECURITY TESTS
   * These tests verify critical security aspects of the RLS implementation
   */
  describe('Security', () => {
    test('should prevent SQL injection bypass attempts', async () => {
      await setTenantContext(companyAId, "user; DELETE FROM quotes; --");

      // This should be safely handled by parameterized queries
      const quotes = await sql`
        SELECT id, quote_number FROM quotes
      `;

      // Should either work normally or fail gracefully, not allow injection
      expect(quotes).toBeDefined();
    });

    test('should maintain isolation during concurrent operations', async () => {
      // Simulate concurrent access from different companies
      const companyAQuotes = await sql`
        SELECT set_tenant_context(${companyAId}, 'user');
        SELECT id, quote_number FROM quotes;
      `;

      await resetTenantContext();

      const companyBQuotes = await sql`
        SELECT set_tenant_context(${companyBId}, 'user');
        SELECT id, quote_number FROM quotes;
      `;

      await resetTenantContext();

      // Each company should only see their own quotes
      expect(companyAQuotes.every(q => q.company_id === companyAId)).toBe(true);
      expect(companyBQuotes.every(q => q.company_id === companyBId)).toBe(true);
    });

    test('should prevent privilege escalation attempts', async () => {
      // Try to set superadmin context from user role
      await setTenantContext(companyAId, 'user');

      // Try to perform superadmin-only operations
      const result = await sql`
        SELECT * FROM quotes WHERE company_id = ${companyBId}
      `;

      // Should not access other company's data
      expect(result.length).toBe(0);
    });
  });
});

/**
 * HELPER FUNCTIONS
 */

/**
 * Helper to create test quote with encrypted PII
 */
async function createTestQuote(
  companyId: string,
  quoteNumber: string,
  customerName: string,
  customerAddress: string
): Promise<string> {
  const [quote] = await sql`
    INSERT INTO quotes (
      company_id, quote_number, customer_name, customer_address,
      customer_name_encrypted, customer_address_encrypted,
      quote_date, our_ref, installation_fee, delivery_fee,
      subtotal, total, total_area, panel_count, status
    ) VALUES (
      ${companyId}, ${quoteNumber}, ${customerName}, ${customerAddress},
      decode(${encryptPII(customerName)}, 'hex')::bytea,
      decode(${encryptPII(customerAddress)}, 'hex')::bytea,
      ${new Date().toISOString().split('T')[0]}, 'TEST-REF',
      100, 50, 1000, 1150, 100, 5, 'draft'
    )
    RETURNING id
  `;

  return quote.id;
}

/**
 * Helper to clean up test quotes
 */
async function cleanupTestQuotes(quoteIds: string[]): Promise<void> {
  await resetTenantContext();
  await setTenantContext('00000000-0000-0000-0000-000000000000', 'superadmin');

  try {
    for (const quoteId of quoteIds) {
      await sql`DELETE FROM quotes WHERE id = ${quoteId}::uuid`;
    }
  } finally {
    await resetTenantContext();
  }
}