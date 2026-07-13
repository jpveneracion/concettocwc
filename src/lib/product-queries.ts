/**
 * Type-safe database operations for product review system
 */

import { sql } from '@/lib/db';
import type {
  PendingProduct,
  CreatePendingProductRequest,
  ProductLookupResult,
  UserRole,
  ProductStatus,
  ProductReviewStats
} from '@/types/product';
import { ProductSource } from '@/types/product';

/**
 * Get pending products with role-based filtering
 */
export async function getPendingProducts(
  companyId: string,
  userRole: UserRole,
  status?: ProductStatus
): Promise<PendingProduct[]> {
  const canViewAll = userRole === 'admin' || userRole === 'superadmin';

  const result = await sql`
    SELECT id, company_id, code, collection, description, unit, status,
           submitted_by, reviewed_by, review_notes,
           created_at, updated_at, reviewed_at
    FROM pending_products
    WHERE 1=1
    ${!canViewAll ? sql`AND company_id = ${companyId}::uuid` : sql``}
    ${status ? sql`AND status = ${status}` : sql``}
    ORDER BY created_at DESC
  `;

  return result as unknown as PendingProduct[];
}

/**
 * Get single pending product by ID
 */
export async function getPendingProductById(
  id: string,
  companyId: string,
  userRole: UserRole
): Promise<PendingProduct | null> {
  const canViewAll = userRole === 'admin' || userRole === 'superadmin';

  const result = await sql`
    SELECT id, company_id, code, collection, description, unit, status,
           submitted_by, reviewed_by, review_notes,
           created_at, updated_at, reviewed_at
    FROM pending_products
    WHERE id = ${id}::uuid
    ${!canViewAll ? sql`AND company_id = ${companyId}` : sql``}
  `;

  return result.length > 0 ? result[0] as PendingProduct : null;
}

/**
 * Check if product code exists globally (in either products or pending_products)
 */
export async function productCodeExists(code: string): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM (
      SELECT 1 FROM products WHERE UPPER(code) = UPPER(${code})
      UNION ALL
      SELECT 1 FROM pending_products WHERE UPPER(code) = UPPER(${code}) AND status != 'rejected'
    ) AS combined
  `;

  return parseInt(result[0].count) > 0;
}

/**
 * Create pending product
 */
export async function createPendingProduct(
  product: CreatePendingProductRequest,
  companyId: string,
  userId: string
): Promise<PendingProduct> {
  const result = await sql`
    INSERT INTO pending_products (code, collection, description, unit, company_id, submitted_by)
    VALUES (
      ${product.code.trim().toUpperCase()},
      ${product.collection?.trim() || null},
      ${product.description.trim()},
      ${product.unit || 'sqft'},
      ${companyId}::uuid,
      ${userId}::uuid
    )
    RETURNING id, company_id, code, collection, description, unit, status,
              submitted_by, reviewed_by, review_notes,
              created_at, updated_at, reviewed_at
  `;

  return result[0] as PendingProduct;
}

/**
 * Find duplicate pending products (same code, different descriptions)
 */
export async function findDuplicateProducts(code: string): Promise<PendingProduct[]> {
  const result = await sql`
    SELECT id, company_id, code, collection, description, unit, status,
           submitted_by, reviewed_by, review_notes,
           created_at, updated_at, reviewed_at
    FROM pending_products
    WHERE UPPER(code) = UPPER(${code})
    AND status = 'pending'
    ORDER BY created_at ASC
  `;

  return result as PendingProduct[];
}

/**
 * Approve pending product and move to main products table
 * Removes ALL pending products with the same code (duplicate handling)
 */
export async function approvePendingProduct(
  pendingProductId: string,
  adminId: string,
  reviewNotes?: string
): Promise<any> {
  // Get pending product to approve
  const [pendingProduct] = await sql`
    SELECT id, company_id, code, collection, description, unit
    FROM pending_products
    WHERE id = ${pendingProductId}::uuid AND status = 'pending'
  `;

  if (!pendingProduct) {
    throw new Error('Pending product not found or already processed');
  }

  // Check for duplicates with same code
  const duplicates = await findDuplicateProducts(pendingProduct.code);
  const productCode = pendingProduct.code;

  // Create in main products table
  const [approvedProduct] = await sql`
    INSERT INTO products (code, collection, description, unit, active)
    VALUES (
      ${pendingProduct.code},
      ${pendingProduct.collection},
      ${pendingProduct.description},
      ${pendingProduct.unit},
      true
    )
    ON CONFLICT (code) DO UPDATE SET
      collection = EXCLUDED.collection,
      description = EXCLUDED.description,
      unit = EXCLUDED.unit,
      updated_at = NOW()
    RETURNING id, code, collection, description, unit, active, created_at, updated_at
  `;

  // Remove ALL pending products with this code (the approved one and any duplicates)
  await sql`
    UPDATE pending_products
    SET status = 'approved',
        reviewed_by = ${adminId}::uuid,
        review_notes = CASE
          WHEN id = ${pendingProductId}::uuid THEN ${reviewNotes || null}
          ELSE CONCAT(COALESCE(review_notes, ''), ' [Duplicate removed - approved: ', ${pendingProductId}::uuid, ']')
        END,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE UPPER(code) = UPPER(${productCode})
    AND status = 'pending'
  `;

  return approvedProduct;
}

/**
 * Reject pending product
 */
export async function rejectPendingProduct(
  pendingProductId: string,
  adminId: string,
  reviewNotes?: string
): Promise<void> {
  await sql`
    UPDATE pending_products
    SET status = 'rejected',
        reviewed_by = ${adminId}::uuid,
        review_notes = ${reviewNotes || null},
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${pendingProductId}::uuid
  `;
}

/**
 * Search products combining approved and pending
 */
export async function lookupProducts(
  search: string,
  companyId: string,
  userRole: UserRole,
  limit = 20
): Promise<ProductLookupResult[]> {
  const searchTerm = `${search}%`;

  // Get approved products
  const approvedProducts = await sql`
    SELECT id, code, description, collection, unit
    FROM products
    WHERE active = true
    AND (
      code ILIKE ${searchTerm}
      OR description ILIKE ${searchTerm}
      OR collection ILIKE ${searchTerm}
    )
    ORDER BY code ASC
    LIMIT ${limit}
  `;

  // Get pending products (only user's own)
  const pendingProducts = await sql`
    SELECT id, code, description, collection, unit
    FROM pending_products
    WHERE company_id = ${companyId}::uuid
    AND status = 'pending'
    AND (
      code ILIKE ${searchTerm}
      OR description ILIKE ${searchTerm}
      OR collection ILIKE ${searchTerm}
    )
    ORDER BY code ASC
    LIMIT ${limit}
  `;

  // Combine and format results
  const approvedResults = approvedProducts.map((p: any) => ({
    ...p,
    source: ProductSource.APPROVED
  }));

  const pendingResults = pendingProducts.map((p: any) => ({
    ...p,
    source: ProductSource.PENDING
  }));

  return [...approvedResults, ...pendingResults];
}

/**
 * Get product review statistics for admin dashboard
 */
export async function getProductReviewStats(): Promise<ProductReviewStats> {
  const stats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as "pendingCount",
      COUNT(*) FILTER (WHERE status = 'approved') as "approvedCount",
      COUNT(*) FILTER (WHERE status = 'rejected') as "rejectedCount"
    FROM pending_products
  `;

  // Find duplicate codes
  const duplicates = await sql`
    SELECT UPPER(code) as code
    FROM pending_products
    WHERE status = 'pending'
    GROUP BY UPPER(code)
    HAVING COUNT(*) > 1
    ORDER BY UPPER(code)
  `;

  return {
    pendingCount: parseInt(stats[0]?.pendingCount || '0'),
    approvedCount: parseInt(stats[0]?.approvedCount || '0'),
    rejectedCount: parseInt(stats[0]?.rejectedCount || '0'),
    duplicateCodes: duplicates.map((d: any) => d.code)
  };
}