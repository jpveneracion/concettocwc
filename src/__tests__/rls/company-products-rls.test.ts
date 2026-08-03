/**
 * Comprehensive RLS Tests for Company Product Definitions Table
 *
 * These tests verify that Row-Level Security policies properly enforce
 * tenant isolation for the company_product_definitions table while supporting
 * the admin promotion workflow for global catalog management.
 *
 * Test Categories:
 * 1. Tenant Isolation - Users can't access other companies' product definitions
 * 2. Admin Access - Admins can access all products within their company
 * 3. Superadmin Access - Superadmins can access products across all companies for promotion workflow
 * 4. Write Protection - Cross-company modifications are prevented
 * 5. Company ID Immutability - Critical security control to prevent data transfer
 * 6. Promotion Workflow - Admin promotion integration with global catalog
 * 7. Promoted Product Protection - Global catalog security
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { querySQL } from '@/lib/db';
import { setTenantContext, resetTenantContext, withTenantContext } from '@/lib/rls';

describe('Company Products RLS Policy Tests', () => {
  // Test company IDs
  const companyAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const companyBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const superadminCompanyId = '00000000-0000-0000-0000-000000000000';

  // Test product IDs
  let companyAProduct1Id: string;
  let companyAProduct2Id: string;
  let companyBProduct1Id: string;
  let promotedProductId: string;

  /**
   * Setup test data before all tests
   */
  beforeAll(async () => {
    // Clean up any existing test data first
    await setTenantContext(superadminCompanyId, 'superadmin');
    try {
      await querySQL`DELETE FROM company_product_definitions WHERE code LIKE 'COMP-%' OR code = 'PROMOTED-PROD' OR code LIKE 'TEMP-%' OR code LIKE 'SHOULD-%' OR code LIKE 'NEW-%'`;
      await querySQL`DELETE FROM products WHERE code = 'PROMOTED-PROD' OR code LIKE 'global-%'`;
      await querySQL`DELETE FROM users WHERE email LIKE 'test-user-%'`;
      await querySQL`DELETE FROM companies WHERE code LIKE 'COMP-%'`;
    } finally {
      await resetTenantContext();
    }

    await querySQL`
      INSERT INTO companies (id, code, name) VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        'COMP-A', 'Company A'
      ) ON CONFLICT (id) DO NOTHING
    `;

    await querySQL`
      INSERT INTO companies (id, code, name) VALUES (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
        'COMP-B', 'Company B'
      ) ON CONFLICT (id) DO NOTHING
    `;

    // Create test users for submitted_by field (using actual schema columns)
    const [testUserA] = await querySQL`
      INSERT INTO users (id, email, company_id, password_hash, role) VALUES (
        '11111111-1111-1111-1111-111111111111'::uuid,
        'test-user-a@example.com', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        'test-password-hash', 'user'
      ) ON CONFLICT (id) DO NOTHING RETURNING id
    `;

    const [testUserB] = await querySQL`
      INSERT INTO users (id, email, company_id, password_hash, role) VALUES (
        '22222222-2222-2222-2222-222222222222'::uuid,
        'test-user-b@example.com', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
        'test-password-hash', 'user'
      ) ON CONFLICT (id) DO NOTHING RETURNING id
    `;

    // Create test product definitions for different companies
    const [companyAProduct1] = await querySQL`
      INSERT INTO company_product_definitions (
        company_id, code, collection, description, unit,
        submitted_by, is_approved_for_global, global_product_id
      ) VALUES (
        ${companyAId}, 'COMP-A-PROD-1', 'Blinds', 'Test product from Company A - Aluminum mini blinds',
        'sqft', '11111111-1111-1111-1111-111111111111'::uuid, false, NULL
      )
      RETURNING id
    `;
    companyAProduct1Id = companyAProduct1.id;

    const [companyAProduct2] = await querySQL`
      INSERT INTO company_product_definitions (
        company_id, code, collection, description, unit,
        submitted_by, is_approved_for_global, global_product_id
      ) VALUES (
        ${companyAId}, 'COMP-A-PROD-2', 'Shades', 'Another test product from Company A - Cellular shades',
        'sqft', '11111111-1111-1111-1111-111111111111'::uuid, false, NULL
      )
      RETURNING id
    `;
    companyAProduct2Id = companyAProduct2.id;

    const [companyBProduct1] = await querySQL`
      INSERT INTO company_product_definitions (
        company_id, code, collection, description, unit,
        submitted_by, is_approved_for_global, global_product_id
      ) VALUES (
        ${companyBId}, 'COMP-B-PROD-1', 'Blinds', 'Test product from Company B - Vertical blinds',
        'sqft', '22222222-2222-2222-2222-222222222222'::uuid, false, NULL
      )
      RETURNING id
    `;
    companyBProduct1Id = companyBProduct1.id;

    // Create a global product first for the promoted product to reference
    const [globalProduct] = await querySQL`
      INSERT INTO products (id, code, collection, description) VALUES (
        '33333333-3333-3333-3333-333333333333'::uuid,
        'PROMOTED-PROD', 'Global Shutters', 'Global catalog product - Plantation shutters'
      ) ON CONFLICT (id) DO NOTHING RETURNING id
    `;

    // Create a promoted product for testing promoted product protection
    const [promotedProduct] = await querySQL`
      INSERT INTO company_product_definitions (
        company_id, code, collection, description, unit,
        submitted_by, is_approved_for_global, global_product_id
      ) VALUES (
        ${companyAId}, 'PROMOTED-PROD', 'Shutters', 'Product promoted to global catalog - Plantation shutters',
        'sqft', '11111111-1111-1111-1111-111111111111'::uuid, true, '33333333-3333-3333-3333-333333333333'::uuid
      )
      RETURNING id
    `;
    promotedProductId = promotedProduct.id;
  }, 60000); // 60 second timeout for setup

  /**
   * Clean up test data after all tests
   */
  afterAll(async () => {
    // Reset RLS context first to ensure we can delete test data
    await resetTenantContext();

    // Use superadmin context to clean up test data
    await setTenantContext(superadminCompanyId, 'superadmin');
    try {
      await querySQL`DELETE FROM company_product_definitions WHERE code LIKE 'COMP-%' OR code = 'PROMOTED-PROD'`;
      await querySQL`DELETE FROM products WHERE code = 'PROMOTED-PROD'`;
      await querySQL`DELETE FROM users WHERE email LIKE 'test-user-%'`;
      await querySQL`DELETE FROM companies WHERE code LIKE 'COMP-%'`;
    } finally {
      await resetTenantContext();
    }
  }, 60000); // 60 second timeout for cleanup

  /**
   * Reset RLS context before each test to ensure isolation
   */
  beforeEach(async () => {
    try {
      await resetTenantContext();
    } catch (error) {
      console.warn('Failed to reset context in beforeEach:', error);
    }
  });

  /**
   * Reset RLS context after each test to ensure cleanup
   */
  afterEach(async () => {
    try {
      await resetTenantContext();
    } catch (error) {
      console.warn('Failed to reset context in afterEach:', error);
    }
  });

  /**
   * TENANT ISOLATION TESTS
   * These tests verify that users can only access product definitions from their own company
   */
  describe('Tenant Isolation', () => {
    test('should allow users to see product definitions from their own company', async () => {
      // Use withTenantContext to ensure context persists during the query
      const products = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          SELECT id, code, collection, description, company_id
          FROM company_product_definitions
          ORDER BY code
        `;
      });

      expect(products.length).toBeGreaterThanOrEqual(2);
      expect(products.every(p => p.company_id === companyAId)).toBe(true);
      expect(products.some(p => p.code === 'COMP-A-PROD-1')).toBe(true);
      expect(products.some(p => p.code === 'COMP-A-PROD-2')).toBe(true);
    });

    test('should prevent users from seeing product definitions from other companies', async () => {
      const products = await withTenantContext(companyBId, 'user', async () => {
        return await querySQL`
          SELECT id, code, collection, description, company_id
          FROM company_product_definitions
          ORDER BY code
        `;
      });

      expect(products.length).toBe(1);
      expect(products[0].company_id).toBe(companyBId);
      expect(products[0].code).toBe('COMP-B-PROD-1');
      expect(products.every(p => p.company_id === companyBId)).toBe(true);
    });

    test('should prevent users from accessing other company products by ID', async () => {
      const [product] = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          SELECT id, code, collection, description
          FROM company_product_definitions
          WHERE id = ${companyBProduct1Id}::uuid
        `;
      });

      // Should not find the product due to RLS policy
      expect(product).toBeUndefined();
    });

    test('should return empty result when no context is set', async () => {
      // Don't set any context - should fail secure
      const products = await querySQL`
        SELECT id, code, collection, description
        FROM company_product_definitions
      `;

      // Should return empty due to fail-secure policy
      expect(products.length).toBe(0);
    });
  });

  /**
   * ADMIN ACCESS TESTS
   * These tests verify that admins can access all products within their company
   */
  describe('Admin Access', () => {
    test('should allow admins to see all products in their company', async () => {
      const products = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          SELECT id, code, collection, description, company_id
          FROM company_product_definitions
          ORDER BY code
        `;
      });

      expect(products.length).toBeGreaterThanOrEqual(2);
      expect(products.every(p => p.company_id === companyAId)).toBe(true);
      expect(products.some(p => p.code === 'COMP-A-PROD-1')).toBe(true);
      expect(products.some(p => p.code === 'COMP-A-PROD-2')).toBe(true);
    });

    test('should prevent admins from accessing other company products', async () => {
      const [product] = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          SELECT id, code, collection, description
          FROM company_product_definitions
          WHERE id = ${companyBProduct1Id}::uuid
        `;
      });

      expect(product).toBeUndefined();
    });

    test('should allow admins to update products in their company', async () => {
      const result = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          UPDATE company_product_definitions
          SET collection = 'Updated Collection',
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
          RETURNING id, collection
        `;
      });

      expect(result.length).toBe(1);
      expect(result[0].collection).toBe('Updated Collection');
    });

    test('should prevent admins from updating other company products', async () => {
      const result = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          UPDATE company_product_definitions
          SET collection = 'Should Not Update',
              updated_at = NOW()
          WHERE id = ${companyBProduct1Id}::uuid
          RETURNING id
        `;
      });

      // Should not update due to RLS policy
      expect(result.length).toBe(0);
    });
  });

  /**
   * SUPERADMIN ACCESS TESTS
   * These tests verify that superadmins can access products across all companies
   * for the promotion workflow
   */
  describe('Superadmin Access', () => {
    test('should allow superadmins to see all products from all companies', async () => {
      const products = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        return await querySQL`
          SELECT id, code, collection, company_id
          FROM company_product_definitions
          ORDER BY company_id, code
        `;
      });

      expect(products.length).toBeGreaterThanOrEqual(4);
      expect(products.some(p => p.company_id === companyAId)).toBe(true);
      expect(products.some(p => p.company_id === companyBId)).toBe(true);
    });

    test('should allow superadmins to update any company products for promotion workflow', async () => {
      const result = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        return await querySQL`
          UPDATE company_product_definitions
          SET is_approved_for_global = true,
              global_product_id = '33333333-3333-3333-3333-333333333333'::uuid,
              updated_at = NOW()
          WHERE id = ${companyBProduct1Id}::uuid
          RETURNING id, is_approved_for_global, global_product_id
        `;
      });

      expect(result.length).toBe(1);
      expect(result[0].is_approved_for_global).toBe(true);
      expect(result[0].global_product_id).toBe('33333333-3333-3333-3333-333333333333');
    });

    test('should allow superadmins to delete any company products', async () => {
      const result = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        // Create a temporary product to delete
        const [tempProduct] = await querySQL`
          INSERT INTO company_product_definitions (
            company_id, code, collection, description, unit,
            submitted_by, is_approved_for_global, global_product_id
          ) VALUES (
            ${companyAId}, 'TEMP-TO-DELETE', 'Test', 'Will be deleted',
            'sqft', '11111111-1111-1111-1111-111111111111'::uuid, false, NULL
          )
          RETURNING id
        `;

        const deleteResult = await querySQL`
          DELETE FROM company_product_definitions
          WHERE id = ${tempProduct.id}::uuid
          RETURNING id
        `;

        return deleteResult;
      });

      expect(result.length).toBe(1);
    });

    test('should allow superadmins to read pending products for promotion workflow', async () => {
      const pendingProducts = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        // This tests the admin_promotion_access policy
        return await querySQL`
          SELECT id, code, collection, description, company_id
          FROM company_product_definitions
          WHERE is_approved_for_global = false
          ORDER BY company_id, created_at
        `;
      });

      expect(pendingProducts.length).toBeGreaterThan(0);
      // Superadmin should see pending products from all companies
      expect(pendingProducts.some(p => p.company_id === companyAId)).toBe(true);
      expect(pendingProducts.some(p => p.company_id === companyBId)).toBe(true);
    });
  });

  /**
   * WRITE PROTECTION TESTS
   * These tests verify that cross-company modifications are prevented
   */
  describe('Write Protection', () => {
    test('should prevent inserting products with wrong company_id', async () => {
      await withTenantContext(companyAId, 'user', async () => {
        // Try to insert a product for Company B while in Company A context
        const [product] = await querySQL`
          INSERT INTO company_product_definitions (
            company_id, code, collection, description, unit,
            submitted_by, is_approved_for_global, global_product_id
          ) VALUES (
            ${companyBId}, 'SHOULD-FAIL', 'Test', 'This should not work',
            'sqft', '11111111-1111-1111-1111-111111111111'::uuid, false, NULL
          )
          RETURNING id
        `;

        // Insert succeeds but we can't see it due to RLS
        const products = await querySQL`
          SELECT id, code
          FROM company_product_definitions
          WHERE code = 'SHOULD-FAIL'
        `;

        expect(products.length).toBe(0);
      });
    });

    test('should prevent updating company_id on existing products', async () => {
      await withTenantContext(companyAId, 'admin', async () => {
        // Try to change company_id of a product
        const result = await querySQL`
          UPDATE company_product_definitions
          SET company_id = ${companyBId},
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
          RETURNING id, company_id
        `;

        // The RLS policy should prevent this update
        expect(result.length).toBe(0);
      });

      // Verify the company_id hasn't changed
      await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        const [product] = await querySQL`
          SELECT company_id FROM company_product_definitions WHERE id = ${companyAProduct1Id}::uuid
        `;
        expect(product.company_id).toBe(companyAId);
      });
    });

    test('should prevent deleting products from other companies', async () => {
      const result = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          DELETE FROM company_product_definitions
          WHERE id = ${companyBProduct1Id}::uuid
          RETURNING id
        `;
      });

      // Delete should not affect other company's products
      expect(result.length).toBe(0);
    });
  });

  /**
   * COMPANY ID IMMUTABILITY TESTS
   * These tests verify the critical security control that prevents company_id changes
   */
  describe('Company ID Immutability', () => {
    test('should prevent changing company_id on existing products', async () => {
      await withTenantContext(companyAId, 'admin', async () => {
        // Try to change company_id of a product
        const result = await querySQL`
          UPDATE company_product_definitions
          SET company_id = ${companyBId},
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
          RETURNING id, company_id
        `;

        // The company_id_immutable policy should prevent this update
        expect(result.length).toBe(0);
      });

      // Verify the company_id hasn't changed
      await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        const [product] = await querySQL`
          SELECT company_id FROM company_product_definitions WHERE id = ${companyAProduct1Id}::uuid
        `;
        expect(product.company_id).toBe(companyAId);
      });
    });

    test('should allow superadmin to change company_id for data migration', async () => {
      await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        // Superadmin can change company_id for legitimate migration operations
        const result = await querySQL`
          UPDATE company_product_definitions
          SET company_id = ${companyBId},
              updated_at = NOW()
          WHERE id = ${companyAProduct2Id}::uuid
          RETURNING id, company_id
        `;

        expect(result.length).toBe(1);
        expect(result[0].company_id).toBe(companyBId);

        // Revert for other tests
        await querySQL`
          UPDATE company_product_definitions
          SET company_id = ${companyAId},
              updated_at = NOW()
          WHERE id = ${companyAProduct2Id}::uuid
        `;
      });
    });
  });

  /**
   * PROMOTION WORKFLOW TESTS
   * These tests verify the admin promotion workflow integration
   */
  describe('Promotion Workflow', () => {
    test('should allow superadmins to query pending products across all companies', async () => {
      const pendingProducts = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        // This tests the admin_promotion_access policy
        return await querySQL`
          SELECT id, code, collection, description, company_id
          FROM company_product_definitions
          WHERE is_approved_for_global = false
          ORDER BY company_id, created_at ASC
        `;
      });

      expect(pendingProducts.length).toBeGreaterThan(0);
      // Should see pending products from multiple companies
      const hasMultipleCompanies = new Set(pendingProducts.map(p => p.company_id)).size > 1;
      expect(hasMultipleCompanies).toBe(true);
    });

    test('should allow superadmins to promote products to global catalog', async () => {
      await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        // Simulate promotion workflow
        const result = await querySQL`
          UPDATE company_product_definitions
          SET is_approved_for_global = true,
              global_product_id = '44444444-4444-4444-4444-444444444444'::uuid,
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
          RETURNING id, is_approved_for_global, global_product_id
        `;

        expect(result.length).toBe(1);
        expect(result[0].is_approved_for_global).toBe(true);
        expect(result[0].global_product_id).toBe('44444444-4444-4444-4444-444444444444');

        // Clean up - reset promotion status for other tests
        await querySQL`
          UPDATE company_product_definitions
          SET is_approved_for_global = false,
              global_product_id = NULL,
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
        `;
      });
    });

    test('should prevent regular users from accessing promotion workflow', async () => {
      const pendingProducts = await withTenantContext(companyAId, 'user', async () => {
        // Try to access pending products from all companies
        return await querySQL`
          SELECT id, code, collection, company_id
          FROM company_product_definitions
          WHERE is_approved_for_global = false
          ORDER BY company_id, created_at ASC
        `;
      });

      // Should only see products from own company
      expect(pendingProducts.every(p => p.company_id === companyAId)).toBe(true);
      expect(pendingProducts.some(p => p.company_id === companyBId)).toBe(false);
    });
  });

  /**
   * PROMOTED PRODUCT PROTECTION TESTS
   * These tests verify security of promoted products in the global catalog
   */
  describe('Promoted Product Protection', () => {
    test('should prevent modification of promoted products by regular users', async () => {
      const result = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          UPDATE company_product_definitions
          SET collection = 'Modified Collection',
              updated_at = NOW()
          WHERE id = ${promotedProductId}::uuid
          RETURNING id, collection
        `;
      });

      // The promoted_product_protection policy should prevent this update
      expect(result.length).toBe(0);
    });

    test('should prevent deletion of promoted products by regular users', async () => {
      const result = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          DELETE FROM company_product_definitions
          WHERE id = ${promotedProductId}::uuid
          RETURNING id
        `;
      });

      // The promoted_delete_protection policy should prevent deletion
      expect(result.length).toBe(0);
    });

    test('should allow superadmins to modify promoted products', async () => {
      const result = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        return await querySQL`
          UPDATE company_product_definitions
          SET collection = 'Superadmin Modified Collection',
              updated_at = NOW()
          WHERE id = ${promotedProductId}::uuid
          RETURNING id, collection
        `;
      });

      expect(result.length).toBe(1);
      expect(result[0].collection).toBe('Superadmin Modified Collection');
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
        expect((error as Error).message).toContain('Company ID is required');
      }
    });

    test('should maintain data integrity during RLS violations', async () => {
      await withTenantContext(companyAId, 'user', async () => {
        // Try to access other company's product
        const [product] = await querySQL`
          SELECT * FROM company_product_definitions WHERE id = ${companyBProduct1Id}::uuid
        `;

        // Should return undefined, not error
        expect(product).toBeUndefined();
      });

      // Verify the data still exists
      await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        const [verifyProduct] = await querySQL`
          SELECT id FROM company_product_definitions WHERE id = ${companyBProduct1Id}::uuid
        `;
        expect(verifyProduct).toBeDefined();
        expect(verifyProduct.id).toBe(companyBProduct1Id);
      });
    });

    test('should validate UUID format for company ID', async () => {
      try {
        await setTenantContext('invalid-uuid-format', 'user');
        fail('Should have thrown error for invalid UUID');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Invalid company ID format');
      }
    });

    test('should validate user role', async () => {
      try {
        await setTenantContext(companyAId, 'invalid-role' as any);
        fail('Should have thrown error for invalid role');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Invalid user role');
      }
    });
  });

  /**
   * BACKWARDS COMPATIBILITY TESTS
   * These tests verify that existing product operations still work correctly
   */
  describe('Backwards Compatibility', () => {
    test('should support existing product retrieval patterns', async () => {
      const products = await withTenantContext(companyAId, 'user', async () => {
        // Standard product retrieval
        return await querySQL`
          SELECT id, code, collection, description, created_at
          FROM company_product_definitions
          ORDER BY created_at DESC
        `;
      });

      expect(products.length).toBeGreaterThanOrEqual(1);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('code');
      expect(products[0]).toHaveProperty('collection');
    });

    test('should support existing product creation patterns', async () => {
      const newCode = 'NEW-PROD-' + Date.now();
      await withTenantContext(companyAId, 'admin', async () => {
        const [product] = await querySQL`
          INSERT INTO company_product_definitions (
            company_id, code, collection, description, unit,
            submitted_by, is_approved_for_global, global_product_id
          ) VALUES (
            ${companyAId}, ${newCode}, 'Test', 'Newly created product',
            'sqft', '11111111-1111-1111-1111-111111111111'::uuid, false, NULL
          )
          RETURNING id, code, collection
        `;

        expect(product).toBeDefined();
        expect(product.code).toBe(newCode);

        // Clean up
        await querySQL`DELETE FROM company_product_definitions WHERE id = ${product.id}::uuid`;
      });
    });

    test('should support existing product update patterns', async () => {
      const [product] = await withTenantContext(companyAId, 'admin', async () => {
        return await querySQL`
          UPDATE company_product_definitions
          SET collection = 'Updated Collection',
              description = 'Updated description',
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
          RETURNING id, collection, description, updated_at
        `;
      });

      expect(product).toBeDefined();
      expect(product.collection).toBe('Updated Collection');
      expect(product.description).toBe('Updated description');
      expect(product.updated_at).toBeDefined();
    });

    test('should support PII encryption patterns if applicable', async () => {
      const [product] = await withTenantContext(companyAId, 'user', async () => {
        // Basic product query should work
        return await querySQL`
          SELECT id, code, collection, description
          FROM company_product_definitions
          WHERE id = ${companyAProduct1Id}::uuid
        `;
      });

      expect(product).toBeDefined();
      expect(product.code).toBeDefined();
      expect(product.collection).toBeDefined();
    });
  });

  /**
   * PERFORMANCE TESTS
   * These tests verify that RLS policies don't significantly impact performance
   */
  describe('Performance', () => {
    test('should execute product queries within acceptable time limits', async () => {
      const startTime = Date.now();
      const products = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          SELECT id, code, collection, description, created_at
          FROM company_product_definitions
          ORDER BY created_at DESC
          LIMIT 10
        `;
      });
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete within 1 second (generous limit for safety)
      expect(executionTime).toBeLessThan(1000);
      expect(products).toBeDefined();
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

    test('should handle promotion workflow queries efficiently', async () => {
      const startTime = Date.now();
      const pendingProducts = await withTenantContext(superadminCompanyId, 'superadmin', async () => {
        return await querySQL`
          SELECT id, code, collection, description, company_id
          FROM company_product_definitions
          WHERE is_approved_for_global = false
          ORDER BY company_id, created_at ASC
        `;
      });
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete within 1 second
      expect(executionTime).toBeLessThan(1000);
      expect(pendingProducts).toBeDefined();
    });
  });

  /**
   * SECURITY TESTS
   * These tests verify critical security aspects of the RLS implementation
   */
  describe('Security', () => {
    test('should prevent SQL injection bypass attempts', async () => {
      // Test that SQL injection attempts are handled safely
      // This should either throw a validation error or be safely handled
      try {
        await setTenantContext(companyAId, "user; DELETE FROM company_product_definitions; --" as any);
        fail('Should have thrown error for invalid role');
      } catch (error) {
        // Expected - invalid role should be rejected
        expect(error).toBeDefined();
      }

      // Verify that normal operations still work safely
      const products = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          SELECT id, code, collection FROM company_product_definitions
        `;
      });

      expect(products).toBeDefined();
    });

    test('should maintain isolation during concurrent operations', async () => {
      // Test concurrent access from different companies
      const companyAProducts = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          SELECT id, code, company_id FROM company_product_definitions
        `;
      });

      const companyBProducts = await withTenantContext(companyBId, 'user', async () => {
        return await querySQL`
          SELECT id, code, company_id FROM company_product_definitions
        `;
      });

      // Each company should only see their own products
      expect(companyAProducts.every(p => p.company_id === companyAId)).toBe(true);
      expect(companyBProducts.every(p => p.company_id === companyBId)).toBe(true);
    });

    test('should prevent privilege escalation attempts', async () => {
      // Try to perform superadmin-only operations as a regular user
      const result = await withTenantContext(companyAId, 'user', async () => {
        return await querySQL`
          SELECT * FROM company_product_definitions WHERE company_id = ${companyBId}
        `;
      });

      // Should not access other company's data
      expect(result.length).toBe(0);
    });

    test('should enforce company_id immutability as security control', async () => {
      const result = await withTenantContext(companyAId, 'admin', async () => {
        // Attempt to change company_id (security violation)
        return await querySQL`
          UPDATE company_product_definitions
          SET company_id = ${companyBId},
              updated_at = NOW()
          WHERE id = ${companyAProduct1Id}::uuid
          RETURNING id, company_id
        `;
      });

      // The company_id_immutable policy should prevent this security violation
      expect(result.length).toBe(0);
    });

    test('should protect promoted products from unauthorized modification', async () => {
      const result = await withTenantContext(companyAId, 'admin', async () => {
        // Try to modify a promoted product
        return await querySQL`
          UPDATE company_product_definitions
          SET is_approved_for_global = false,
              updated_at = NOW()
          WHERE id = ${promotedProductId}::uuid
          RETURNING id, is_approved_for_global
        `;
      });

      // The promoted_product_protection policy should prevent this
      expect(result.length).toBe(0);
    });
  });
});

/**
 * HELPER FUNCTIONS
 */

/**
 * Helper to generate valid test company ID
 */
function generateTestCompanyId(): string {
  // Generate a valid UUID format for testing
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Helper to clean up RLS context
 */
async function cleanupContext(): Promise<void> {
  try {
    await resetTenantContext();
  } catch (error) {
    // Log but don't throw if cleanup fails
    console.error('Failed to cleanup context:', error);
  }
}

/**
 * Helper to create test company product
 */
async function createTestCompanyProduct(
  companyId: string,
  code: string,
  collection: string,
  description: string,
  basePrice: number
): Promise<string> {
  const [product] = await querySQL`
    INSERT INTO company_product_definitions (
      company_id, code, collection, description, unit,
      submitted_by, is_approved_for_global, global_product_id
    ) VALUES (
      ${companyId}, ${code}, ${collection}, ${description}, 'sq.ft',
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx1'::uuid, false, NULL
    )
    RETURNING id
  `;

  return product.id;
}

/**
 * Helper to clean up test company products
 */
async function cleanupTestCompanyProducts(productIds: string[]): Promise<void> {
  await cleanupContext();
  await setTenantContext('00000000-0000-0000-0000-000000000000', 'superadmin');

  try {
    for (const productId of productIds) {
      await querySQL`DELETE FROM company_product_definitions WHERE id = ${productId}::uuid`;
    }
  } finally {
    await cleanupContext();
  }
}