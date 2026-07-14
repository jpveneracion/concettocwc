# Tenant Product Management System Design

**Date:** 2025-01-14  
**Status:** Approved  
**Type:** Feature Implementation  

## Overview

Multi-tenant product system where users can create products and use them immediately in their own tenant catalog, while admins control promotion to the global shared catalog.

## Workflow Summary

1. **Tenant creates product** → Immediate availability in company catalog
2. **Tenant uses product** → Can use in quotes right away (company-only)
3. **Admin reviews** → Approves products for global catalog promotion
4. **Promoted products** → Available to all tenants in global catalog

## Architecture Design

### System Components
- **Database Layer**: New `company_product_definitions` table + existing `products` table
- **API Layer**: Company product CRUD endpoints + Admin promotion endpoints  
- **UI Layer**: Company product management page + Admin promotion interface
- **Type Layer**: Strict TypeScript interfaces for all data structures

### Design Principles
- ✅ Clean separation: Company products vs Global products
- ✅ Immediate availability: Company products usable instantly
- ✅ Admin-controlled promotion: Quality gate for global catalog
- ✅ Type safety: Zero `any` types, strict TypeScript throughout
- ✅ Mobile-first: Responsive design following existing patterns
- ✅ Auth integration: Uses existing session validation, no auth file modifications

## Database Schema

### New Table: company_product_definitions

```sql
CREATE TABLE company_product_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  collection VARCHAR(100),
  description TEXT NOT NULL,
  unit VARCHAR(20) DEFAULT 'sqft',
  submitted_by UUID NOT NULL REFERENCES users(id),
  is_approved_for_global BOOLEAN DEFAULT FALSE,
  global_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, UPPER(code))
);

CREATE INDEX idx_company_products_company_id ON company_product_definitions(company_id);
CREATE INDEX idx_company_products_code ON company_product_definitions(UPPER(code));
CREATE INDEX idx_company_products_approval_status ON company_product_definitions(is_approved_for_global);
CREATE INDEX idx_company_products_submitted_by ON company_product_definitions(submitted_by);
```

## TypeScript Types

### New File: src/types/company-product.ts

```typescript
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
 * Request to promote company product to global catalog
 */
export interface PromoteProductRequest {
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
  global_product: Product;
  promoted_at: Date;
}
```

## API Endpoints

### Company Product Management (Tenant Users)

**GET `/api/company-products/definitions`**
- List company's own products (tenant-specific catalog)
- Query params: `status`, `search`
- Returns: Company-specific product list with usage counts

**POST `/api/company-products/definitions`**
- Create new company product
- Body: `{ code, collection, description, unit }`
- Returns: Created company product (immediately usable)

**GET `/api/company-products/definitions/[id]`**
- Get single company product details
- Returns: Full product details with usage statistics

**PUT `/api/company-products/definitions/[id]`**
- Update company product (before global promotion)
- Body: `{ collection, description, unit }`
- Restriction: Cannot edit promoted products

**DELETE `/api/company-products/definitions/[id]`**
- Delete company product (if not promoted)
- Validation: Check if used in existing quotes

### Admin Promotion Workflow

**GET `/api/admin/company-products/pending-promotion`**
- List company products awaiting global promotion
- Returns: All unapproved company products across all tenants

**POST `/api/admin/company-products/promote`**
- Promote company product to global catalog
- Body: `{ company_product_id, review_notes }`
- Returns: Promoted product with global reference

**POST `/api/admin/company-products/reject-promotion`**
- Reject global promotion (product stays company-specific)
- Body: `{ company_product_id, review_notes }`

## UI Components

### Tenant Interface: Company Products Page
**Location:** `/app/company-products/page.tsx`

**Features:**
- Product list with usage stats
- Add/edit/delete company products
- Status indicators (pending/approved/rejected)
- Mobile-first responsive design
- Real-time validation

### Admin Interface: Product Promotion Page  
**Location:** `/app/admin/company-products/page.tsx`

**Features:**
- Pending products queue
- Product details with submitting company info
- Promote/reject actions
- Required review notes
- Multi-tenant view with filtering

## Data Flow

### Tenant Creates Product:
```
User → POST /api/company-products/definitions
     → Insert into company_product_definitions
     → Immediate availability in company catalog
     → Can use in quotes right away
```

### Admin Promotes Product:
```
Admin → POST /api/admin/company-products/promote
      → Insert into products (global catalog)
      → Update company_product_definitions.global_product_id
      → Set is_approved_for_global = true
      → Now available to all tenants
```

## Integration Points

- **Session Management**: Uses existing `getSession()` from auth
- **Company Context**: Uses `session.companyId` for scoping
- **Quote System**: Extended product lookup to include company products
- **Admin Permissions**: Uses existing admin role checks
- **UI Patterns**: Follows existing AppLayout/AdminLayout patterns

## Error Handling

### Input Validation:
- Code uniqueness per company
- Required field validation
- Length limits (Code: 50, Description: 1000)
- Unit enum validation

### Business Logic:
- Edit restrictions for promoted products
- Delete restrictions for products used in quotes
- Promotion restrictions for duplicate global codes
- Company-scoped access control

### Error Responses:
- 400: Validation errors
- 401: Unauthorized
- 403: Forbidden (wrong company, already promoted)
- 409: Conflict (duplicate code, usage in quotes)
- 500: Server errors

## Implementation Checklist

### Database Layer:
- [ ] Create migration for `company_product_definitions` table
- [ ] Add performance indexes
- [ ] Test migration and rollback

### TypeScript Layer:
- [ ] Create `src/types/company-product.ts` with strict typing
- [ ] Ensure zero `any` types
- [ ] Add comprehensive documentation

### API Layer:
- [ ] Create `src/lib/company-product-queries.ts`
- [ ] Create API routes for company products
- [ ] Create API routes for admin promotion
- [ ] Add comprehensive error handling

### UI Layer:
- [ ] Create company products page
- [ ] Create admin promotion page
- [ ] Add navigation links
- [ ] Implement mobile-first responsive design

### Integration:
- [ ] Update quote system product lookup
- [ ] Add company products to search/autocomplete
- [ ] Test end-to-end workflows

### Verification:
- [ ] Test tenant product creation workflow
- [ ] Test admin promotion workflow
- [ ] Test quote integration
- [ ] Test mobile responsiveness
- [ ] Verify naming conventions alignment
- [ ] Run `npm run build` successfully

## Success Criteria

- Tenants can create products and use them immediately
- Admins can promote products to global catalog
- No auth file modifications
- Zero `any` types in implementation
- Mobile-first responsive design
- Clean separation of company vs global products
- No breaking changes to existing functionality
