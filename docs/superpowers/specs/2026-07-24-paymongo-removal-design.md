# PayMongo Payment Integration Removal Design

**Date:** 2026-07-24  
**Author:** Claude Code  
**Status:** Approved  
**Type:** Technical Debt Cleanup  

## Overview

Remove all PayMongo payment gateway references from the codebase while maintaining the current manual payment verification system (GCash/GoTyme/USDC QR codes). The PayMongo integration has been replaced but legacy code remains, creating unnecessary complexity and potential confusion.

## Current State Analysis

### Payment Flow Architecture

**Confirmed Current Flow:**
1. User selects subscription plan on `/subscription/checkout`
2. Frontend calls `/api/subscriptions/create` with `payment_method: 'manual'`
3. **Backend makes unnecessary PayMongo API call** (lines 210-267 in route.ts)
4. **Frontend IGNORES PayMongo response** - redirects to `/subscription/payment-instructions?plan_id=${selectedPlan}`
5. User sees QR codes (GCash/GoTyme/USDC) from current payment config
6. User submits payment proof → `/api/payment-verifications`
7. Automatic verification via GCash webhook (`/api/payments/gcash-webhook`)
8. Admin approves verification → `/api/payment-verifications/[id]/approve` → subscription activated
9. **Real subscription creation happens via payment verification, NOT PayMongo**

### Key Findings

**Critical Discovery:** The PayMongo API call in `/api/subscriptions/create` is **100% dead code**. The frontend completely ignores the PayMongo response (checkout_url, session_id) and redirects to the payment instructions page regardless.

**Active System:** The current payment verification system (GCash/GoTyme/USDC QR codes with admin approval and automatic GCash webhook verification) is fully functional and has no PayMongo dependencies.

**Technical Debt:** PayMongo references exist in:
- API endpoint making unnecessary external API calls
- Type definitions no longer used by active code
- Database schema columns that serve no purpose
- Environment configuration variables
- Archived integration files

## Design Strategy

### Core Principle

**Maintain API Contract, Remove Dead Code**

Keep the same endpoint structure and response format to avoid breaking changes, but replace the PayMongo API call with lightweight validation that returns the same response structure the frontend expects.

### Target Architecture

**Simplified Flow:**
1. User selects plan → `/api/subscriptions/create` (lightweight validation only)
2. Frontend receives simple validation response → redirects to payment instructions
3. Manual QR payment → payment verification → admin approval → subscription activation

**No External Dependencies:** Remove dependency on PayMongo API keys and external service availability.

## Implementation Changes

### 1. API Endpoint Update (`src/app/api/subscriptions/create/route.ts`)

**Remove:** `createPayMongoCheckout()` function (lines 170-267)

**Replace With:** Lightweight validation response

```typescript
// NEW IMPLEMENTATION
async function createCheckoutValidation(params: {
  plan_id: string;
  company_id: string;
}): Promise<{
  success: boolean;
  plan_id: string;
  plan_name: string;
  amount: number;
  message: string;
}> {
  const { plan_id, company_id } = params;

  // Get plan details
  const plan = await getSubscriptionPlan(plan_id);
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Return validation response (no external API calls)
  return {
    success: true,
    plan_id: plan.id,
    plan_name: plan.name,
    amount: plan.amount,
    message: 'Proceed to payment instructions'
  };
}
```

**Response Structure Change:** Update response type to match new return value, but maintain JSON format that frontend can parse.

**Keep Unchanged:**
- All validation logic (authentication, plan existence, duplicate prevention)
- Error handling structure
- HTTP status codes
- Request validation

### 2. Type Definition Cleanup (`src/types/subscription.ts`)

**Remove:** Lines 36-334 (all PayMongo-specific interfaces)

**Specific Interfaces to Remove:**
- `PayMongoCheckoutRequest` (lines 272-278)
- `PayMongoCheckoutResponse` (lines 280-286)  
- `LegacyPaymentMethod` with `paymongo_payment_method_id` (lines 289-301)
- `WebhookEvent` with `paymongo_event_id` (lines 304-315)
- `Invoice` with `paymongo_invoice_id` (lines 318-334)

**Keep:** All active subscription types and interfaces used by current payment verification system.

### 3. Database Schema Migration

**Create Migration File:** `migrations/remove-paymongo-columns.sql`

**Columns to Drop:**
```sql
-- Remove PayMongo plan reference
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS paymongo_plan_id;

-- Remove PayMongo subscription reference  
ALTER TABLE subscriptions DROP COLUMN IF EXISTS paymongo_subscription_id;

-- Remove PayMongo invoice reference
ALTER TABLE invoices DROP COLUMN IF EXISTS paymongo_invoice_id;

-- Remove PayMongo payment method reference
ALTER TABLE payment_methods DROP COLUMN IF EXISTS paymongo_payment_method_id;

-- Remove PayMongo event reference
ALTER TABLE webhook_events DROP COLUMN IF EXISTS paymongo_event_id;

-- Remove unused index
DROP INDEX IF EXISTS idx_subscriptions_paymongo_id;
```

**Migration Strategy:**
1. Test migration on development database first
2. Create rollback migration in case of issues
3. Verify no active queries depend on these columns
4. Run during low-traffic period with proper backup

**Risk Mitigation:** Use `IF EXISTS` clauses to prevent failures if columns were already removed manually.

### 4. Environment Configuration Cleanup (`.env.example`)

**Remove Variables (Lines 4-7):**
```bash
# PAYMONGO_SECRET_KEY=sk_test_xxx
# PAYMONGO_PUBLIC_KEY=pk_test_xxx  
# PAYMONGO_WEBHOOK_SECRET=whsec_xxx
# PAYMONGO_API_URL=https://api.paymongo.com/v1
```

**Keep:** All current payment verification environment variables (GCASH_WEBHOOK_SECRET, etc.)

### 5. Archive Directory Removal

**Remove:** Entire `archive/paymongo/` directory

**Directory Structure:**
```
archive/paymongo/
├── README.md
├── documentation/ (5 files)
├── migration_files/
└── original_integration/ (4 archived API routes)
```

**Reason:** The archived integration is professionally documented and can be restored from git history if needed. No reason to maintain duplicate archived files in active codebase.

## Testing Strategy

### Unit Tests

**API Endpoint Tests:**
- Test authentication requirements
- Test plan validation logic
- Test duplicate subscription prevention
- Test error handling scenarios
- Test response format matches frontend expectations

**Type System Tests:**
- Verify no compilation errors after type removal
- Test that remaining types work correctly
- Ensure no broken imports/exports

### Integration Tests

**Payment Flow Tests:**
1. Complete checkout → payment instructions → payment verification → subscription activation flow
2. Test automatic GCash webhook verification
3. Test admin approval workflow
4. Test error scenarios (invalid plans, duplicate subscriptions, etc.)

**Database Migration Tests:**
1. Test migration on development database
2. Verify application works with new schema
3. Test rollback migration
4. Check for performance improvements

### End-to-End Tests

**User Journey Tests:**
1. New user signup → plan selection → payment → approval → subscription activation
2. Existing user with expired subscription → renewal flow
3. Admin payment verification workflow
4. Automatic verification via GCash webhook

## Risk Assessment

### Low Risk Changes

**API Endpoint Update:**
- **Risk:** Low - removing code that frontend already ignores
- **Impact:** Reduced latency, removed external dependency
- **Rollback:** Simple - revert endpoint code

**Type Definition Cleanup:**
- **Risk:** Low - removing unused interfaces
- **Impact:** Cleaner codebase, better type safety
- **Rollback:** Simple - revert type file

**Environment Variable Cleanup:**
- **Risk:** None - removing unused configuration
- **Impact:** Cleaner environment setup
- **Rollback:** Not needed

### Medium Risk Changes

**Database Schema Migration:**
- **Risk:** Medium - schema changes require careful execution
- **Impact:** Cleaner schema, potential performance improvement
- **Rollback:** Available - reversible migration
- **Mitigation:** Comprehensive testing, staged deployment

**Archive Directory Removal:**
- **Risk:** Low - files exist in git history
- **Impact:** Cleaner repository structure
- **Rollback:** Available - restore from git

### Risk Mitigation Strategy

1. **Staged Deployment:** Development → Staging → Production
2. **Database Backups:** Full backup before migration
3. **Monitoring:** Watch for errors during/after deployment
4. **Rollback Plan:** All changes reversible within 30 minutes

## Success Criteria

### Functional Requirements

✅ **Payment Flow:** Complete payment → verification → subscription flow works without PayMongo  
✅ **API Response:** Frontend receives expected response format from endpoint  
✅ **Database:** Application functions correctly with new schema  
✅ **Type Safety:** No TypeScript compilation errors  
✅ **Performance:** No degradation in response times  

### Technical Requirements

✅ **No External Dependencies:** PayMongo API keys no longer required  
✅ **Code Quality:** Reduced complexity, cleaner codebase  
✅ **Database Schema:** Unused columns removed  
✅ **Type Safety:** Active types match actual usage  
✅ **Documentation:** Code comments updated to reflect changes  

### Business Requirements

✅ **User Experience:** No visible changes to payment flow  
✅ **Admin Workflow:** Payment verification process unchanged  
✅ **Reliability:** Reduced dependency on external services  
✅ **Maintainability:** Easier to understand codebase  

## Implementation Timeline

**Phase 1: Code Changes** (2-3 hours)
- Update API endpoint
- Clean up type definitions
- Update environment configuration

**Phase 2: Database Migration** (1-2 hours)
- Create migration script
- Test on development database
- Prepare rollback plan

**Phase 3: Testing** (2-3 hours)
- Unit tests
- Integration tests  
- End-to-end tests

**Phase 4: Deployment** (1-2 hours)
- Deploy to staging
- Final testing
- Deploy to production
- Monitor for issues

**Total Estimated Time:** 6-10 hours

## Post-Implementation Verification

### Immediate Checks (Post-Deployment)

1. **Database:** Verify schema updated correctly
2. **API:** Test subscription creation endpoint
3. **Frontend:** Verify payment instructions page loads
4. **Webhooks:** Test GCash webhook processing
5. **Admin:** Test payment verification workflow

### Ongoing Monitoring (First 48 Hours)

1. **Error Logs:** Monitor for any PayMongo-related errors
2. **Performance:** Check API response times
3. **User Reports:** Watch for payment flow issues
4. **Database Performance:** Monitor query performance

### Success Metrics

- **Zero PayMongo-related errors** in logs
- **Maintained or improved** API response times
- **No increase** in payment verification failures
- **No user complaints** about payment process changes

## Conclusion

This design removes all PayMongo payment gateway references while maintaining the current manual payment verification system. The changes are conservative and low-risk, focusing on removing dead code rather than restructuring the active payment flow.

The key insight is that PayMongo integration was already replaced by the current payment verification system, but legacy code remained. This cleanup completes that migration by removing the technical debt.

**Next Steps:** Create detailed implementation plan with specific tasks and subagent assignments.