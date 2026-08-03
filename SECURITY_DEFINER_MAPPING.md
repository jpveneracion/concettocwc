# Neon-SQL Helpers to SECURITY DEFINER Functions Mapping

## Overview
This document maps the neon-sql helper functions from `src/lib/db.ts` to their appropriate SECURITY DEFINER database functions or RLS-aware query patterns.

## Key Functions Requiring Rewiring

### 1. getUser Function (line 297)
**Current Implementation:** Direct SQL query with app.role context
**Target Function:** `find_user_by_id(p_user_id uuid) RETURNS json`
**Rewiring Strategy:** Replace direct SQL with SECURITY DEFINER function call
**Benefits:** Removes app.role dependency, leverages existing SECURITY DEFINER bypass

### 2. Payment Verification Functions

#### getPaymentVerificationById (line 491)
**Current Implementation:** Direct SQL query  
**Target Strategy:** Use `query()` with automatic RLS context
**Reasoning:** Payment verifications need RLS scoping to user's company
**Benefits:** Proper tenant isolation, no SECURITY DEFINER needed

#### getPaymentVerificationsByUserId (line 515)
**Current Implementation:** Direct SQL with optional status filtering
**Target Strategy:** Use `query()` with automatic RLS context
**Reasoning:** Company-scoped payment verification access
**Benefits:** Proper RLS isolation, maintains filtering capability

#### createPaymentVerification (line 397)
**Current Implementation:** Raw SQL INSERT with app.role context
**Target Strategy:** Keep raw SQL but rely on automatic RLS context from query()
**Benefits:** Simpler implementation, proper tenant scoping

#### updatePaymentVerificationStatus (line 775)
**Current Implementation:** Complex UPDATE query
**Target Strategy:** Use `update_payment_verification` SECURITY DEFINER function
**Available Function:** `update_payment_verification(uuid, uuid, text, timestamp with time zone, uuid, text) RETURNS json`
**Benefits:** Controlled access, proper validation

### 3. RLS Context Functions (Already Correct)
These functions already use proper patterns:
- `withRLSContext` (line 1466) ✅
- `withAdminRLSContext` (line 1571) ✅  
- `withSuperadminRLSContext` (line 1593) ✅
- `hasRLSContext` (line 1614) ✅
- `getRLSContext` (line 1635) ✅

### 4. queryWithRLSBypass Function (line 1678)
**Status:** MARKED FOR DELETION
**Reasoning:** No longer needed with transaction-scoped RLS context
**Action:** Remove completely in Task 5.1

## Available SECURITY DEFINER Functions for Reference

### User Management Functions
- `find_user_by_id(p_user_id uuid) RETURNS json` - Primary user lookup
- `find_user_by_email(p_email text) RETURNS json` - Email-based lookup
- `find_user_by_email_hash(p_email_hash text) RETURNS json` - Hash-based lookup (OAuth)
- `get_user_admin_status(p_user_id uuid) RETURNS json` - Admin status check
- `get_user_company(p_user_id uuid) RETURNS uuid` - User company resolution

### Context Management Functions
- `set_tenant_context(company_id UUID, user_role TEXT)` - Transaction-scoped context
- `reset_tenant_context()` - Context cleanup
- `set_complete_user_context(p_user_id uuid, p_company_id uuid, p_role text)` - Full context

### Company/Product Functions
- `get_company_products(p_company_id uuid) RETURNS json` - Company products
- `get_company_product_by_id(p_product_id uuid) RETURNS json` - Single product lookup
- `get_active_products() RETURNS json` - Active products list
- `check_company_has_products(p_company_id uuid) RETURNS boolean` - Product availability check

### Payment Functions
- `get_payment_verifications(p_company_id uuid) RETURNS json` - Company payment verifications
- `update_payment_verification(p_verification_id uuid, p_user_id uuid, p_status text, p_processed_at timestamp with time zone, p_processed_by uuid, p_notes text) RETURNS json` - Payment verification updates
- `get_pending_payment_verifications_by_reference(p_cleaned_reference_number VARCHAR(50)) RETURNS json` - Webhook matching

### Subscription Functions
- `get_subscription_plans() RETURNS json` - Active subscription plans
- `get_subscription_plan(p_plan_id uuid) RETURNS json` - Single plan details
- `get_subscription_plan_by_id(p_plan_id uuid) RETURNS json` - Plan lookup by ID

### Admin Functions
- `get_revenue_by_payment_method(p_start_date timestamp with time zone) RETURNS json` - Revenue analytics
- `get_dashboard_payment_method_stats(p_start_date timestamp with time zone) RETURNS json` - Dashboard stats
- `get_all_payment_settings() RETURNS json` - All payment settings

## Rewiring Priority Order

### High Priority (Core Authentication)
1. **getUser** → Use `find_user_by_id` SECURITY DEFINER
2. **getPaymentVerificationById** → Use `query()` with RLS context
3. **createPaymentVerification** → Use `query()` with RLS context

### Medium Priority (Business Logic)
4. **getPaymentVerificationsByUserId** → Use `query()` with RLS context  
5. **updatePaymentVerificationStatus** → Use `update_payment_verification` SECURITY DEFINER
6. **getPendingVerifications** → Use `query()` with RLS context

### Low Priority (Admin/Analytics)
7. **getAllPaymentVerifications** → Keep as-is (admin function)
8. **getVerificationStats** → Keep as-is (admin function)
9. **getPendingVerificationCount** → Keep as-is (admin function)

## Functions Not Requiring Changes

These functions already follow proper patterns or are purely internal:
- `query`, `querySQL` - Core database connection functions ✅
- `updateUser` - Uses RLS context correctly ✅
- RLS context wrappers - Already implement proper patterns ✅
- Admin analytics functions - Designed for cross-company access ✅

## Implementation Strategy

### Phase 1: Core User Functions
- Rewrite `getUser` to use `find_user_by_id` SECURITY DEFINER
- Test authentication flow still works
- Verify no app.role dependency remains

### Phase 2: Payment Functions
- Rewrite payment verification functions to use `query()` with RLS context
- Update payment status function to use SECURITY DEFINER
- Test payment verification flow

### Phase 3: Cleanup
- Remove `queryWithRLSBypass` function completely
- Verify all functions work without app.role
- Final testing and validation

## Security Considerations

### RLS Context Leaks Prevention
- All functions using `query()` automatically get transaction-scoped RLS context
- No session pollution between requests
- Connection pool safe

### SECURITY DEFINER Benefits
- Controlled RLS bypass for specific operations
- Input validation at database level
- Consistent security model

### Migration Path
- Each function rewritten independently
- Testing after each change
- No breaking changes to function signatures
- Backward compatible with existing code