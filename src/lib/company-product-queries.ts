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

// Company product error interface for better error handling
export interface CompanyProductError extends Error {
  code: 'NOT_FOUND' | 'DUPLICATE' | 'CANNOT_MODIFY' | 'VALIDATION_ERROR' | 'OPERATION_FAILED';
  mobileMessage: string;
  details?: Record<string, unknown>;
}

class CompanyProductErrorImpl extends Error implements CompanyProductError {
  code: CompanyProductError['code'];
  mobileMessage: string;
  details?: Record<string, unknown>;

  constructor(
    code: CompanyProductError['code'],
    message: string,
    mobileMessage: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CompanyProductError';
    this.code = code;
    this.mobileMessage = mobileMessage;
    this.details = details;
  }
}

/**
 * Get company products with filtering
 */
export async function getCompanyProducts(
  companyId: string,
  status?: 'all' | 'pending' | 'approved',
  search?: string
): Promise<CompanyProductDefinition[]> {
  try {
    const statusFilter = status || 'all';
    const searchTerm = search ? `%${search}%` : null;

    const result = await sql(`
      SELECT get_company_products($1::uuid, $2, $3) as product
    `, [companyId, statusFilter, searchTerm]);

    return result.map(row => row.product) as CompanyProductDefinition[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Failed to get company products: ${errorMessage}`,
      'Unable to load products - please try again',
      { companyId, status, search }
    );
  }
}

/**
 * Get single company product by ID
 */
export async function getCompanyProductById(
  id: string,
  companyId: string
): Promise<CompanyProductDefinition | null> {
  try {
    const result = await sql(`
      SELECT get_company_product_by_id($1::uuid, $2::uuid) as product
    `, [id, companyId]);

    return result.length > 0 ? result[0].product as CompanyProductDefinition : null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Failed to get company product: ${errorMessage}`,
      'Unable to load product details - please try again',
      { productId: id, companyId }
    );
  }
}

/**
 * Check if product code exists for company
 */
export async function companyProductCodeExists(companyId: string, code: string, excludeId?: string): Promise<boolean> {
  try {
    const query = excludeId
      ? `SELECT check_company_product_code_exists($1::uuid, $2, $3::uuid) as exists`
      : `SELECT check_company_product_code_exists($1::uuid, $2, NULL) as exists`;

    const params = excludeId
      ? [companyId, code, excludeId]
      : [companyId, code];

    const result = await sql(query, params);
    return result[0].exists === true;
  } catch (error) {
    // Return false on error for safe fallback
    console.warn('Failed to check product code existence:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Create company product
 */
export async function createCompanyProduct(
  product: CreateCompanyProductRequest,
  companyId: string,
  userId: string
): Promise<CompanyProductDefinition> {
  try {
    const result = await sql(`
      SELECT create_company_product_definition($1, $2, $3, $4, $5::uuid, $6::uuid) as product
    `, [
      product.code.trim().toUpperCase(),
      product.collection?.trim() || null,
      product.description.trim(),
      product.unit || 'sqft',
      companyId,
      userId
    ]);

    const productResult = result[0].product;

    if (productResult.error) {
      if (productResult.error === 'duplicate') {
        throw new CompanyProductErrorImpl(
          'DUPLICATE',
          'A product with this code already exists',
          'A product with this code already exists',
          { code: product.code, companyId }
        );
      }
      throw new CompanyProductErrorImpl(
        'OPERATION_FAILED',
        productResult.message || 'Product creation failed',
        'Failed to create product - please try again',
        { code: product.code, error: productResult.error }
      );
    }

    return productResult as CompanyProductDefinition;
  } catch (error) {
    if (error instanceof CompanyProductErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Product creation failed: ${errorMessage}`,
      'Failed to create product - please try again',
      { code: product.code, companyId, userId }
    );
  }
}

/**
 * Update company product
 */
export async function updateCompanyProduct(
  id: string,
  companyId: string,
  updates: UpdateCompanyProductRequest
): Promise<CompanyProductDefinition> {
  try {
    const result = await sql(`
      SELECT update_company_product_definition($1::uuid, $2::uuid, $3, $4, $5) as product
    `, [
      id,
      companyId,
      updates.collection?.trim() || null,
      updates.description?.trim() || null,
      updates.unit || null
    ]);

    const product = result[0].product;

    if (product.error) {
      if (product.error === 'not_found') {
        throw new CompanyProductErrorImpl(
          'NOT_FOUND',
          'Product not found',
          'Product not found - it may have been deleted',
          { productId: id, companyId }
        );
      } else if (product.error === 'cannot_update') {
        throw new CompanyProductErrorImpl(
          'CANNOT_MODIFY',
          'Cannot update promoted products',
          'This product cannot be modified - it has been promoted',
          { productId: id, companyId }
        );
      }
      throw new CompanyProductErrorImpl(
        'OPERATION_FAILED',
        product.message || 'Update failed',
        'Failed to update product - please try again',
        { productId: id, error: product.error }
      );
    }

    return product as CompanyProductDefinition;
  } catch (error) {
    if (error instanceof CompanyProductErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Product update failed: ${errorMessage}`,
      'Failed to update product - please try again',
      { productId: id, companyId }
    );
  }
}

/**
 * Delete company product
 */
export async function deleteCompanyProduct(id: string, companyId: string): Promise<void> {
  try {
    const result = await sql(`
      SELECT delete_company_product_definition($1::uuid, $2::uuid) as result
    `, [id, companyId]);

    const response = result[0].result;

    if (response.error) {
      if (response.error === 'not_found') {
        throw new CompanyProductErrorImpl(
          'NOT_FOUND',
          'Product not found',
          'Product not found - it may have been deleted',
          { productId: id, companyId }
        );
      } else if (response.error === 'cannot_delete') {
        throw new CompanyProductErrorImpl(
          'CANNOT_MODIFY',
          'Cannot delete promoted products',
          'This product cannot be deleted - it has been promoted',
          { productId: id, companyId }
        );
      }
      throw new CompanyProductErrorImpl(
        'OPERATION_FAILED',
        response.message || 'Delete failed',
        'Failed to delete product - please try again',
        { productId: id, error: response.error }
      );
    }
  } catch (error) {
    if (error instanceof CompanyProductErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Product deletion failed: ${errorMessage}`,
      'Failed to delete product - please try again',
      { productId: id, companyId }
    );
  }
}

/**
 * Get all company products awaiting admin promotion
 */
export async function getPendingPromotionProducts(): Promise<CompanyProductDefinition[]> {
  try {
    const result = await sql(`
      SELECT get_pending_promotion_products() as product
    `);

    return result.map(row => row.product) as CompanyProductDefinition[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Failed to get pending promotion products: ${errorMessage}`,
      'Unable to load pending products - please try again',
      { originalError: errorMessage }
    );
  }
}

/**
 * Promote company product to global catalog
 */
export async function promoteCompanyProduct(
  companyProductId: string,
  adminId: string
): Promise<ProductPromotionResult> {
  try {
    const result = await sql(`
      SELECT promote_company_product($1::uuid, $2::uuid) as promotion_result
    `, [companyProductId, adminId]);

    const promotionResult = result[0].promotion_result;

    if (promotionResult.error) {
      throw new CompanyProductErrorImpl(
        'OPERATION_FAILED',
        promotionResult.message || 'Promotion failed',
        'Failed to promote product - please try again',
        { productId: companyProductId, error: promotionResult.error }
      );
    }

    return {
      company_product: promotionResult.company_product as CompanyProductDefinition,
      global_product: promotionResult.global_product as {
        id: string;
        code: string;
        collection: string | null;
        description: string;
        unit: string;
        active: boolean;
      },
      promoted_at: new Date(promotionResult.promoted_at)
    };
  } catch (error) {
    if (error instanceof CompanyProductErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Product promotion failed: ${errorMessage}`,
      'Failed to promote product - please try again',
      { productId: companyProductId, adminId }
    );
  }
}

/**
 * Reject company product promotion (delete the company product)
 */
export async function rejectCompanyProduct(
  companyProductId: string,
  adminId: string,
  reviewNotes?: string
): Promise<void> {
  try {
    const result = await sql(`
      SELECT reject_company_product($1::uuid, $2::uuid) as result
    `, [companyProductId, adminId]);

    const response = result[0].result;

    if (response.error) {
      throw new CompanyProductErrorImpl(
        'OPERATION_FAILED',
        response.message || 'Rejection failed',
        'Failed to reject product - please try again',
        { productId: companyProductId, error: response.error }
      );
    }
  } catch (error) {
    if (error instanceof CompanyProductErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Product rejection failed: ${errorMessage}`,
      'Failed to reject product - please try again',
      { productId: companyProductId, adminId }
    );
  }
}

/**
 * Get company product usage statistics
 */
export async function getCompanyProductUsage(companyId: string): Promise<CompanyProductUsage[]> {
  try {
    const result = await sql(`
      SELECT get_company_product_usage($1::uuid) as usage
    `, [companyId]);

    return result.map(row => row.usage) as CompanyProductUsage[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new CompanyProductErrorImpl(
      'OPERATION_FAILED',
      `Failed to get company product usage: ${errorMessage}`,
      'Unable to load product usage - please try again',
      { companyId, originalError: errorMessage }
    );
  }
}