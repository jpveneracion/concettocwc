/**
 * Company Product Database Operations
 * Type-safe database operations for company product management
 */

import { sql } from '@/lib/db';
import type {
  CompanyProductDefinition,
  CreateCompanyProductRequest,
  UpdateCompanyProductRequest,
  CompanyProductUsage,
  ProductPromotionResult
} from '@/types/company-product';

/**
 * Get company products with filtering
 */
export async function getCompanyProducts(
  companyId: string,
  status?: 'all' | 'pending' | 'approved',
  search?: string
): Promise<CompanyProductDefinition[]> {
  let query = `
    SELECT id, company_id, code, collection, description, unit,
           submitted_by, is_approved_for_global, global_product_id,
           created_at, updated_at
    FROM company_product_definitions
    WHERE company_id = $1::uuid
  `;

  const params: (string | boolean)[] = [companyId];
  let paramIndex = 2;

  if (status === 'pending') {
    query += ` AND is_approved_for_global = false`;
  } else if (status === 'approved') {
    query += ` AND is_approved_for_global = true`;
  }

  if (search) {
    query += ` AND (code ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR collection ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC`;

  const result = await sql(query, params);
  return result as CompanyProductDefinition[];
}

/**
 * Get single company product by ID
 */
export async function getCompanyProductById(
  id: string,
  companyId: string
): Promise<CompanyProductDefinition | null> {
  const result = await sql(`
    SELECT id, company_id, code, collection, description, unit,
           submitted_by, is_approved_for_global, global_product_id,
           created_at, updated_at
    FROM company_product_definitions
    WHERE id = $1::uuid AND company_id = $2::uuid
  `, [id, companyId]);

  return result.length > 0 ? result[0] as CompanyProductDefinition : null;
}

/**
 * Check if product code exists for company
 */
export async function companyProductCodeExists(companyId: string, code: string, excludeId?: string): Promise<boolean> {
  let query = `
    SELECT COUNT(*) as count
    FROM company_product_definitions
    WHERE company_id = $1::uuid AND UPPER(code) = UPPER($2)
  `;

  const params: (string | number)[] = [companyId, code];

  if (excludeId) {
    query += ` AND id != $3::uuid`;
    params.push(excludeId);
  }

  const result = await sql(query, params);
  return parseInt(result[0].count) > 0;
}

/**
 * Create company product
 */
export async function createCompanyProduct(
  product: CreateCompanyProductRequest,
  companyId: string,
  userId: string
): Promise<CompanyProductDefinition> {
  const result = await sql(`
    INSERT INTO company_product_definitions
    (code, collection, description, unit, company_id, submitted_by)
    VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid)
    RETURNING id, company_id, code, collection, description, unit,
              submitted_by, is_approved_for_global, global_product_id,
              created_at, updated_at
  `, [
    product.code.trim().toUpperCase(),
    product.collection?.trim() || null,
    product.description.trim(),
    product.unit || 'sqft',
    companyId,
    userId
  ]);

  return result[0] as CompanyProductDefinition;
}

/**
 * Update company product
 */
export async function updateCompanyProduct(
  id: string,
  companyId: string,
  updates: UpdateCompanyProductRequest
): Promise<CompanyProductDefinition> {
  const currentProduct = await getCompanyProductById(id, companyId);
  if (!currentProduct) {
    throw new Error('Product not found');
  }

  if (currentProduct.is_approved_for_global) {
    throw new Error('Cannot update promoted products');
  }

  const result = await sql(`
    UPDATE company_product_definitions
    SET
      collection = COALESCE($2, collection),
      description = COALESCE($3, description),
      unit = COALESCE($4, unit),
      updated_at = NOW()
    WHERE id = $1::uuid AND company_id = $5::uuid
    RETURNING id, company_id, code, collection, description, unit,
              submitted_by, is_approved_for_global, global_product_id,
              created_at, updated_at
  `, [
    id,
    updates.collection?.trim() || null,
    updates.description?.trim() || null,
    updates.unit || null,
    companyId
  ]);

  return result[0] as CompanyProductDefinition;
}

/**
 * Delete company product
 */
export async function deleteCompanyProduct(id: string, companyId: string): Promise<void> {
  const product = await getCompanyProductById(id, companyId);
  if (!product) {
    throw new Error('Product not found');
  }

  if (product.is_approved_for_global) {
    throw new Error('Cannot delete promoted products');
  }

  await sql(`
    DELETE FROM company_product_definitions
    WHERE id = $1::uuid AND company_id = $2::uuid
  `, [id, companyId]);
}

/**
 * Get all company products awaiting admin promotion
 */
export async function getPendingPromotionProducts(): Promise<CompanyProductDefinition[]> {
  const result = await sql(`
    SELECT cpd.id, cpd.company_id, cpd.code, cpd.collection, cpd.description,
           cpd.unit, cpd.submitted_by, cpd.is_approved_for_global, cpd.global_product_id,
           cpd.created_at, cpd.updated_at,
           c.name as company_name,
           c.code as company_code
    FROM company_product_definitions cpd
    JOIN companies c ON cpd.company_id = c.id
    WHERE cpd.is_approved_for_global = false
    ORDER BY cpd.created_at ASC
  `);

  return result as CompanyProductDefinition[];
}

/**
 * Promote company product to global catalog
 */
export async function promoteCompanyProduct(
  companyProductId: string,
  adminId: string
): Promise<ProductPromotionResult> {
  // Get company product
  const companyProductResult = await sql(`
    SELECT id, company_id, code, collection, description, unit
    FROM company_product_definitions
    WHERE id = $1::uuid AND is_approved_for_global = false
  `, [companyProductId]);

  const companyProduct = companyProductResult[0];
  if (!companyProduct) {
    throw new Error('Company product not found or already promoted');
  }

  // Insert into global products table
  const globalProductResult = await sql(`
    INSERT INTO products (code, collection, description, unit, active)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (code) DO UPDATE SET
      collection = EXCLUDED.collection,
      description = EXCLUDED.description,
      unit = EXCLUDED.unit,
      updated_at = NOW()
    RETURNING id, code, collection, description, unit, active, created_at, updated_at
  `, [
    companyProduct.code,
    companyProduct.collection,
    companyProduct.description,
    companyProduct.unit
  ]);

  const globalProduct = globalProductResult[0];

  // Update company product with global reference
  const updatedResult = await sql(`
    UPDATE company_product_definitions
    SET
      is_approved_for_global = true,
      global_product_id = $1::uuid,
      updated_at = NOW()
    WHERE id = $2::uuid
    RETURNING id, company_id, code, collection, description, unit,
              submitted_by, is_approved_for_global, global_product_id,
              created_at, updated_at
  `, [globalProduct.id, companyProductId]);

  return {
    company_product: updatedResult[0] as CompanyProductDefinition,
    global_product: globalProduct as {
      id: string;
      code: string;
      collection: string | null;
      description: string;
      unit: string;
      active: boolean;
    },
    promoted_at: new Date()
  };
}

/**
 * Reject company product promotion (delete the company product)
 */
export async function rejectCompanyProduct(
  companyProductId: string,
  adminId: string,
  reviewNotes?: string
): Promise<void> {
  // For company products, rejection means deleting the product definition
  // since companies can recreate it if needed
  await sql(`
    DELETE FROM company_product_definitions
    WHERE id = $1::uuid AND is_approved_for_global = false
  `, [companyProductId]);
}

/**
 * Get company product usage statistics
 */
export async function getCompanyProductUsage(companyId: string): Promise<CompanyProductUsage[]> {
  const result = await sql(`
    SELECT
      cpd.id as product_id,
      cpd.code,
      cpd.description,
      COUNT(qi.id) as usage_count,
      MAX(qi.created_at) as last_used
    FROM company_product_definitions cpd
    LEFT JOIN quote_items qi ON qi.pending_product_id = cpd.id
    WHERE cpd.company_id = $1::uuid
    GROUP BY cpd.id, cpd.code, cpd.description
    ORDER BY usage_count DESC
  `, [companyId]);

  return result as CompanyProductUsage[];
}