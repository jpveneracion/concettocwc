/**
 * Company Product Management Types
 * Multi-tenant product system with admin promotion workflow
 */

import type { ProductUnit } from './product';

/**
 * Company-specific product definition
 */
export interface CompanyProductDefinition {
  id: string;
  company_id: string;
  code: string;
  collection: string | null;
  description: string;
  unit: ProductUnit;
  submitted_by: string;
  is_approved_for_global: boolean;
  global_product_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request to create company product
 */
export interface CreateCompanyProductRequest {
  code: string;
  collection?: string;
  description: string;
  unit?: ProductUnit;
}

/**
 * Request to update company product
 */
export interface UpdateCompanyProductRequest {
  collection?: string;
  description?: string;
  unit?: ProductUnit;
}

/**
 * Request to promote company product to global catalog
 */
export interface PromoteProductRequest {
  company_product_id: string;
  review_notes: string;
}

/**
 * Request to reject product promotion
 */
export interface RejectPromotionRequest {
  company_product_id: string;
  review_notes: string;
}

/**
 * Company product list response
 */
export interface CompanyProductListResponse {
  products: CompanyProductDefinition[];
  total: number;
  has_unapproved: boolean;
}

/**
 * Product promotion result
 */
export interface ProductPromotionResult {
  company_product: CompanyProductDefinition;
  global_product: {
    id: string;
    code: string;
    collection: string | null;
    description: string;
    unit: string;
    active: boolean;
  };
  promoted_at: Date;
}

/**
 * Company product usage statistics
 */
export interface CompanyProductUsage {
  product_id: string;
  code: string;
  description: string;
  usage_count: number;
  last_used: Date | null;
}

/**
 * Company product with company name (for admin display)
 */
export interface CompanyProductWithCompanyName extends CompanyProductDefinition {
  company_name: string;
  company_code?: string;
}
