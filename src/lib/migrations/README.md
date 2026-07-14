# Company Product System Migration

This directory contains database migrations for the Concetto Window Coverings application.

## Migration: Company Product Definitions Table

### Overview
Applies the `company_product_definitions` table to enable multi-tenant product catalog management with admin promotion workflow.

### Table Structure
The migration creates a table with 11 columns:
- `id` (UUID) - Primary key
- `company_id` (UUID) - Foreign key to companies table  
- `code` (VARCHAR(50)) - Product code
- `collection` (VARCHAR(100)) - Product collection
- `description` (TEXT) - Product description
- `unit` (VARCHAR(20)) - Measurement unit (default: 'sqft')
- `submitted_by` (UUID) - Foreign key to users table
- `is_approved_for_global` (BOOLEAN) - Global catalog promotion status
- `global_product_id` (UUID) - Foreign key to products table
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

### Indexes Created (6 total)
1. Primary key index on `id`
2. Unique index on `company_id` and `UPPER(code)` for business logic
3. Performance index on `company_id`
4. Performance index on `code`
5. Performance index on `is_approved_for_global`
6. Performance index on `submitted_by`

### Foreign Key Constraints (3 total)
1. `company_id` → `companies(id)` with CASCADE delete
2. `submitted_by` → `users(id)` with CASCADE delete  
3. `global_product_id` → `products(id)` with SET NULL delete

### Documentation Comments
- Table comment describes purpose
- Column comments explain key business logic fields

## Running the Migration

### Standard Execution
```bash
npm run db:migrate:company-products
```

### Requiring Admin Permissions
If your database user lacks CREATE TABLE permissions, you can temporarily set an admin connection:

```bash
# Set temporary admin connection
export DATABASE_URL="postgresql://admin_user:password@host/database?sslmode=require"

# Run migration
npm run db:migrate:company-products

# Clear the admin connection
unset DATABASE_URL
```

### Verification
The migration script automatically verifies:
- Table creation
- All 11 columns with correct types and constraints
- All 6 indexes created successfully
- All 3 foreign key relationships established
- Documentation comments applied

## Status
✅ **Successfully applied to Database 1**

The migration has been completed and verified on the target database.

## Files
- `apply-company-product-system.ts` - Main migration script
- `check-database-permissions.ts` - Database permission verification utility

## Notes
- Uses `@neondatabase/serverless` library
- TypeScript with proper type safety
- Idempotent (uses IF NOT EXISTS clauses)
- Comprehensive verification after execution