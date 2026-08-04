# CRITICAL RLS VIOLATIONS AUDIT

**Date:** 2026-08-01
**Status:** IMMEDIATE ACTION REQUIRED
**Scope:** Entire Codebase

## 🔴 CRITICAL FINDINGS - API Routes violating RLS

### Users Table (RLS Enabled via migration 015)
**File:** `src/app/api/account-choice/route.ts:87-89`
```typescript
INSERT INTO users (company_id, email, email_hash, password_hash)
VALUES (${companyId}, ${data.email}, ${emailHash}, ${passwordHash})
RETURNING id, email, company_id
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Password Reset Tokens Table (RLS Enabled via migration 037)
**File:** `src/app/api/auth/reset-password/request/route.ts:40`
```typescript
INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Company Products Table (RLS Enabled via migration 025)
**File:** `src/app/api/company-products/route.ts:61-65`
```typescript
INSERT INTO company_products (company_id, product_id, supplier_cost, retail_price)
VALUES (${session.companyId}, ${product_id}::uuid, ${supplier_cost}, ${retail_price})
ON CONFLICT (company_id, product_id) DO UPDATE SET
  supplier_cost = EXCLUDED.supplier_cost,
  retail_price = EXCLUDED.retail_price
```
**RISK:** CRITICAL - Direct INSERT/UPDATE bypasses RLS

### Company Product Definitions Table (RLS Enabled via migration 017)
**File:** `src/lib/company-product-queries.ts:99-105`
```typescript
INSERT INTO company_product_definitions
(code, collection, description, unit, company_id, submitted_by)
VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid)
RETURNING id, company_id, code, collection, description, unit,
          submitted_by, is_approved_for_global, global_product_id,
          created_at, updated_at
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Activation Codes Table (RLS Enabled via migration 027)
**File:** `src/app/api/admin/promo-codes/[id]/route.ts:56-57`
```typescript
UPDATE activation_codes SET ${updateFields.join(', ')} WHERE id = $${paramIndex}
```
**RISK:** CRITICAL - Direct UPDATE bypasses RLS

### Products Table (RLS Enabled via migration 036)
**File:** `src/app/api/products/[id]/route.ts:24-25`
```typescript
UPDATE products SET active = false, updated_at = now()
WHERE id = ${id}::uuid
```
**RISK:** CRITICAL - Direct UPDATE bypasses RLS

---

## 📊 SUMMARY STATISTICS

- **Total Critical RLS Violations Found:** 30+
- **Tables Affected:** 15+ (users, password_reset_tokens, company_products, company_product_definitions, activation_codes, products, payment_verifications, gcash_webhook_data, gateway_device_heartbeat, companies, subscriptions, pricing_history, subscription_plans, pricing_config)
- **Files Requiring Updates:** 20+

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

1. **Create SECURITY DEFINER functions** for all affected tables
2. **Update all API routes** to use SECURITY DEFINER functions instead of direct SQL
3. **Test all operations** to ensure RLS compliance
4. **Implement comprehensive testing** to prevent future violations

---

## 🔧 SECURITY DEFINER FUNCTIONS NEEDED

### Priority 1 - CRITICAL
- [ ] `create_user()` - for users table INSERTs
- [ ] `create_password_reset_token()` - for password_reset_tokens INSERTs  
- [ ] `upsert_company_products()` - for company_products INSERT/UPDATE
- [ ] `create_company_product_definition()` - for company_product_definitions INSERTs
- [ ] `update_activation_code()` - for activation_codes UPDATEs
- [ ] `update_product_status()` - for products UPDATEs

---

## 📁 FILES REQUIRING UPDATES

1. `src/app/api/account-choice/route.ts`
2. `src/app/api/auth/account-choice/route.ts`  
3. `src/app/api/auth/reset-password/request/route.ts`
4. `src/app/api/company-products/route.ts`
5. `src/lib/company-product-queries.ts`
6. `src/app/api/admin/promo-codes/[id]/route.ts`
7. `src/app/api/products/[id]/route.ts`

---

## 🔴 ADDITIONAL CRITICAL VIOLATIONS - Library Files

### Activation Codes Table (RLS Enabled via migration 027)
**File:** `src/lib/activation.ts:130-133, 176-179, 410-411, 458-459`
```typescript
// Multiple INSERT operations
INSERT INTO activation_codes (
  code, discount_percent, applicable_plans,
  created_by, expires_at, campaign_name, notes, ...
)

// Multiple UPDATE operations  
UPDATE activation_codes SET is_active = false WHERE id = $1
UPDATE activation_codes SET ${setParts.join(', ')} WHERE id = $${paramIndex}
```
**RISK:** CRITICAL - Direct INSERT/UPDATE bypasses RLS

### Users Table Updates (RLS Enabled via migration 015)
**File:** `src/lib/db.ts:219-220`
```typescript
UPDATE users SET ${setClause} WHERE id = $1
```
**RISK:** CRITICAL - Direct UPDATE bypasses RLS

### Payment Verifications Table (RLS Enabled via migration 020)
**File:** `src/lib/db.ts:363-365`
```typescript
INSERT INTO payment_verifications (user_id, plan_id, screenshot_url, reference_number, notes)
 VALUES ($1, $2, $3, $4, $5)
 RETURNING *
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### GCash Webhook Data Table (RLS Enabled via migration 029)
**File:** `src/lib/db.ts:933-937`
```typescript
INSERT INTO gcash_webhook_data (transaction_number, amount, sender_name, ...)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (transaction_number) DO UPDATE SET
  amount = EXCLUDED.amount,
  sender_name = EXCLUDED.sender_name, ...
```
**RISK:** CRITICAL - Direct INSERT/UPDATE bypasses RLS

### Gateway Device Heartbeat Table (RLS Enabled via migration 038)
**File:** `src/lib/db.ts:1088-1092`
```typescript
INSERT INTO gateway_device_heartbeat (device_id, last_ping, status, ...)
 VALUES ($1, NOW(), $2, $3, $4, $5)
ON CONFLICT (device_id) DO UPDATE SET
  last_ping = NOW(),
  status = COALESCE(EXCLUDED.status, gateway_device_heartbeat.status), ...
```
**RISK:** CRITICAL - Direct INSERT/UPDATE bypasses RLS

### Products Table Operations (RLS Enabled via migration 036)
**File:** `src/lib/company-product-queries.ts:216-221`
```typescript
INSERT INTO products (code, collection, description, unit, active)
VALUES ($1, $2, $3, $4, true)
ON CONFLICT (code) DO UPDATE SET
  collection = EXCLUDED.collection,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit, ...
```
**RISK:** CRITICAL - Direct INSERT/UPDATE bypasses RLS

### Company Product Definitions DELETE Operations
**File:** `src/lib/company-product-queries.ts:171-173, 271-273`
```typescript
DELETE FROM company_product_definitions
WHERE id = $1::uuid AND company_id = $2::uuid

DELETE FROM company_product_definitions
WHERE id = $1::uuid AND is_approved_for_global = false
```
**RISK:** CRITICAL - Direct DELETE bypasses RLS

### Subscriptions Table (RLS Enabled via migration 030)
**File:** `src/lib/subscription.ts:377-378, 387-388`
```typescript
UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE id = $1
UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE id = $1 RETURNING id
```
**RISK:** CRITICAL - Direct UPDATE bypasses RLS

### Subscription Plans Table (RLS Enabled via migration 035)
**File:** `src/lib/subscription-plans.ts:86-89, 300-302`
```typescript
INSERT INTO subscription_plans (
  name, price, currency, interval, ...
) VALUES ($1, $2, $3, $4, ...)

DELETE FROM subscription_plans
WHERE id = ${id}
RETURNING id
```
**RISK:** CRITICAL - Direct INSERT/DELETE bypasses RLS

### Pricing History Table (RLS Enabled via migration 041)
**File:** `src/lib/pricing-service.ts:519-522`
```typescript
INSERT INTO pricing_history (
  pricing_config_id, change_type, changed_field, ...
) VALUES ($1, $2, $3, ...)
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Companies Table (RLS Enabled via migration 023)
**Files:** `src/lib/migrate-multi-tenant.js:71-73, 139-142`
```typescript
INSERT INTO companies (code, name, address, mobile, email, ...)
VALUES ('CWC', 'CONCETTO WINDOW COVERINGS', ...)

INSERT INTO companies (code, name, address, mobile, email)
VALUES ('DEMO', 'Demo Company', ...)
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Additional User Table Operations
**Files:** `src/lib/migrate-multi-tenant.js:94-95, 155-157`
```typescript
INSERT INTO users (company_id, email, password_hash)
VALUES (${cwcCompany.id}, ${defaultEmail}, ${passwordHash})

INSERT INTO users (company_id, email, password_hash)
VALUES (${defaultCompany.id}, ${defaultEmail}, ${passwordHash})
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Company Products Migration Operations
**File:** `src/lib/migrate-multi-tenant.js:105-107`
```typescript
INSERT INTO company_products (company_id, product_id, supplier_cost, retail_price)
VALUES (${cwcCompany.id}, ${product.id}, ${product.supplier_cost}, ${product.retail_price})
```
**RISK:** CRITICAL - Direct INSERT bypasses RLS

### Quotes Migration UPDATE
**File:** `src/lib/migrate-multi-tenant.js:117`
```typescript
UPDATE quotes SET company_id = ${cwcCompany.id} WHERE company_id IS NULL
```
**RISK:** CRITICAL - Direct UPDATE bypasses RLS

---

## 📁 COMPREHENSIVE FILE LIST REQUIRING UPDATES

### API Routes (7 files)
1. `src/app/api/account-choice/route.ts`
2. `src/app/api/auth/account-choice/route.ts`
3. `src/app/api/auth/reset-password/request/route.ts`
4. `src/app/api/company-products/route.ts`
5. `src/app/api/admin/promo-codes/[id]/route.ts`
6. `src/app/api/products/[id]/route.ts`

### Library Files (13 files)
7. `src/lib/activation.ts`
8. `src/lib/db.ts`
9. `src/lib/company-product-queries.ts`
10. `src/lib/subscription.ts`
11. `src/lib/subscription-plans.ts`
12. `src/lib/pricing-service.ts`
13. `src/lib/migrate-multi-tenant.js`
14. `src/lib/migrations/apply-pricing-system.ts`
15. `src/lib/migrations/create-subscription-plans.ts`

### Migration Scripts (3 files)
16. `src/lib/migrate.js`
17. `src/lib/migrate-multi-tenant.js`
18. Additional migration files

---

## 🔧 COMPLETE SECURITY DEFINER FUNCTIONS NEEDED

### Priority 1 - CRITICAL (User-facing operations)
- [ ] `create_user()` - for users table INSERTs
- [ ] `update_user()` - for users table UPDATEs  
- [ ] `create_password_reset_token()` - for password_reset_tokens INSERTs
- [ ] `upsert_company_products()` - for company_products INSERT/UPDATE
- [ ] `create_company_product_definition()` - for company_product_definitions INSERTs
- [ ] `delete_company_product_definition()` - for company_product_definitions DELETE
- [ ] `update_activation_code()` - for activation_codes UPDATEs
- [ ] `create_activation_code()` - for activation_codes INSERTs
- [ ] `update_product()` - for products UPDATEs
- [ ] `upsert_product()` - for products INSERT/UPDATE

### Priority 2 - CRITICAL (System operations)
- [ ] `create_payment_verification()` - for payment_verifications INSERTs
- [ ] `upsert_gcash_webhook()` - for gcash_webhook_data INSERT/UPDATE
- [ ] `upsert_gateway_heartbeat()` - for gateway_device_heartbeat INSERT/UPDATE
- [ ] `create_subscription()` - for subscriptions INSERTs
- [ ] `update_subscription_status()` - for subscriptions UPDATEs
- [ ] `cancel_subscription()` - for subscriptions UPDATEs
- [ ] `upsert_subscription_plan()` - for subscription_plans INSERT/UPDATE
- [ ] `delete_subscription_plan()` - for subscription_plans DELETE
- [ ] `create_pricing_history()` - for pricing_history INSERTs
- [ ] `create_company()` - for companies INSERTs
- [ ] `update_company()` - for companies UPDATEs

### Priority 3 - HIGH (Migration operations)
- [ ] Migration-specific SECURITY DEFINER functions for bulk data operations

---

**This is a living document - update as new violations are discovered and fixed.**