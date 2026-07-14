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
  ProductReviewStats,
  ProductUnit
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

  let query = `
    SELECT id, company_id, code, collection, description, unit, status,
           submitted_by, reviewed_by, review_notes,
           created_at, updated_at, reviewed_at
    FROM pending_products
    WHERE 1=1
  `;

  const params: (string | ProductStatus)[] = [];
  let paramIndex = 1;

  if (!canViewAll) {
    query += ` AND company_id = $${paramIndex}::uuid`;
    params.push(companyId);
    paramIndex++;
  }

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC`;

  const result = await sql(query.trim(), params);
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

  let query = `
    SELECT id, company_id, code, collection, description, unit, status,
           submitted_by, reviewed_by, review_notes,
           created_at, updated_at, reviewed_at
    FROM pending_products
    WHERE id = $1::uuid
  `;

  const params: string[] = [id];
  let paramIndex = 2;

  if (!canViewAll) {
    query += ` AND company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex++;
  }

  const result = await sql(query.trim(), params);
  return result.length > 0 ? result[0] as PendingProduct : null;
}

/**
 * Check if product code exists globally (in either products or pending_products)
 */
export async function productCodeExists(code: string): Promise<boolean> {
  const result = await sql(`
    SELECT COUNT(*) as count
    FROM (
      SELECT 1 FROM products WHERE UPPER(code) = UPPER($1)
      UNION ALL
      SELECT 1 FROM pending_products WHERE UPPER(code) = UPPER($1) AND status != 'rejected'
    ) AS combined
  `, [code]);

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
  const result = await sql(`
    INSERT INTO pending_products (code, collection, description, unit, company_id, submitted_by)
    VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid)
    RETURNING id, company_id, code, collection, description, unit, status,
              submitted_by, reviewed_by, review_notes,
              created_at, updated_at, reviewed_at
  `, [
    product.code.trim().toUpperCase(),
    product.collection?.trim() || null,
    product.description.trim(),
    product.unit || 'sqft',
    companyId,
    userId
  ]);

  return result[0] as PendingProduct;
}

/**
 * Find duplicate pending products (same code, different descriptions)
 */
export async function findDuplicateProducts(code: string): Promise<PendingProduct[]> {
  const result = await sql(`
    SELECT id, company_id, code, collection, description, unit, status,
           submitted_by, reviewed_by, review_notes,
           created_at, updated_at, reviewed_at
    FROM pending_products
    WHERE UPPER(code) = UPPER($1)
    AND status = 'pending'
    ORDER BY created_at ASC
  `, [code]);

  return result as unknown as PendingProduct[];
}

/**
 * Approve pending product and move to main products table
 * Removes ALL pending products with the same code (duplicate handling)
 */
export async function approvePendingProduct(
  pendingProductId: string,
  adminId: string,
  reviewNotes?: string
): Promise<{ id: string; code: string; collection: string; description: string; unit: string; active: boolean; created_at: string; updated_at: string }> {
  // Get pending product to approve
  const pendingProductResult = await sql(`
    SELECT id, company_id, code, collection, description, unit
    FROM pending_products
    WHERE id = $1::uuid AND status = 'pending'
  `, [pendingProductId]);

  const pendingProduct = pendingProductResult[0];

  if (!pendingProduct) {
    throw new Error('Pending product not found or already processed');
  }

  // Check for duplicates with same code
  const duplicates = await findDuplicateProducts(pendingProduct.code);
  const productCode = pendingProduct.code;

  // Create in main products table
  const approvedProductResult = await sql(`
    INSERT INTO products (code, collection, description, unit, active)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (code) DO UPDATE SET
      collection = EXCLUDED.collection,
      description = EXCLUDED.description,
      unit = EXCLUDED.unit,
      updated_at = NOW()
    RETURNING id, code, collection, description, unit, active, created_at, updated_at
  `, [
    pendingProduct.code,
    pendingProduct.collection,
    pendingProduct.description,
    pendingProduct.unit,
    true
  ]);

  const approvedProduct = approvedProductResult[0] as { id: string; code: string; collection: string; description: string; unit: string; active: boolean; created_at: string; updated_at: string };

  // Remove ALL pending products with this code (the approved one and any duplicates)
  await sql(`
    UPDATE pending_products
    SET status = 'approved',
        reviewed_by = $1::uuid,
        review_notes = CASE
          WHEN id = $2::uuid THEN $3
          ELSE CONCAT(COALESCE(review_notes, ''), ' [Duplicate removed - approved: ', $2::uuid, ']')
        END,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE UPPER(code) = UPPER($4)
    AND status = 'pending'
  `, [adminId, pendingProductId, reviewNotes || null, productCode]);

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
  await sql(`
    UPDATE pending_products
    SET status = 'rejected',
        reviewed_by = $1::uuid,
        review_notes = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = $3::uuid
  `, [adminId, reviewNotes || null, pendingProductId]);
}

/**
 * Search products combining global, approved, and company products
 */
export async function lookupProductsWithCompany(
  search: string,
  companyId: string,
  userRole: UserRole,
  limit = 20
): Promise<ProductLookupResult[]> {
  const searchTerm = `${search}%`;

  // Get approved global products
  const approvedProducts = await sql(`
    SELECT id, code, description, collection, unit
    FROM products
    WHERE active = true
    AND (
      code ILIKE $1
      OR description ILIKE $1
      OR collection ILIKE $1
    )
    ORDER BY code ASC
    LIMIT $2
  `, [searchTerm, limit]);

  // Get company-specific products (only user's own company)
  const companyProducts = await sql(`
    SELECT cpd.id, cpd.code, cpd.description, cpd.collection, cpd.unit
    FROM company_product_definitions cpd
    WHERE cpd.company_id = $1::uuid
    AND (
      cpd.code ILIKE $2
      OR cpd.description ILIKE $2
      OR cpd.collection ILIKE $2
    )
    ORDER BY cpd.code ASC
    LIMIT $3
  `, [companyId, searchTerm, limit]);

  // Combine and format results
  const approvedResults: ProductLookupResult[] = approvedProducts.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    code: p.code as string,
    description: p.description as string,
    collection: p.collection as string | null,
    unit: p.unit as ProductUnit,
    source: ProductSource.APPROVED
  }));

  const companyResults: ProductLookupResult[] = companyProducts.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    code: p.code as string,
    description: p.description as string,
    collection: p.collection as string | null,
    unit: p.unit as ProductUnit,
    source: ProductSource.PENDING
  }));

  return [...approvedResults, ...companyResults];
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
  return lookupProductsWithCompany(search, companyId, userRole, limit);
}

/**
 * Get product review statistics for admin dashboard
 */
export async function getProductReviewStats(): Promise<ProductReviewStats> {
  const stats = await sql(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as "pendingCount",
      COUNT(*) FILTER (WHERE status = 'approved') as "approvedCount",
      COUNT(*) FILTER (WHERE status = 'rejected') as "rejectedCount"
    FROM pending_products
  `);

  // Find duplicate codes
  const duplicates = await sql(`
    SELECT UPPER(code) as code
    FROM pending_products
    WHERE status = 'pending'
    GROUP BY UPPER(code)
    HAVING COUNT(*) > 1
    ORDER BY UPPER(code)
  `);

  return {
    pendingCount: parseInt(stats[0]?.pendingCount || '0'),
    approvedCount: parseInt(stats[0]?.approvedCount || '0'),
    rejectedCount: parseInt(stats[0]?.rejectedCount || '0'),
    duplicateCodes: duplicates.map((d: Record<string, any>) => d.code)
  };
}