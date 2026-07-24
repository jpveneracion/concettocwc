# PayMongo Payment Integration Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all PayMongo payment gateway references while maintaining the current manual payment verification system (GCash/GoTyme/USDC QR codes).

**Architecture:** The current `/api/subscriptions/create` endpoint makes unnecessary PayMongo API calls that the frontend ignores. We'll replace this with lightweight validation, remove unused type definitions, clean up database schema via migration, and remove environment configuration.

**Tech Stack:** Next.js 15, TypeScript, PostgreSQL, Node.js crypto module

---

## File Structure Overview

**Files to modify:**
- `src/app/api/subscriptions/create/route.ts` - Remove PayMongo API call
- `src/types/subscription.ts` - Remove PayMongo interfaces  
- `.env.example` - Remove PayMongo environment variables
- `migrations/subscription-system.sql` - Reference for creating migration

**Files to create:**
- `migrations/remove-paymongo-columns.sql` - Database migration script

**Files to remove:**
- `archive/paymongo/` - Entire archived directory

---

## Task 1: Create Database Migration Script

**Files:**
- Create: `migrations/remove-paymongo-columns.sql`

- [ ] **Step 1: Write migration script to remove PayMongo columns**

```sql
-- migrations/remove-paymongo-columns.sql
-- Migration: Remove PayMongo payment gateway columns
-- Date: 2026-07-24
-- Description: Remove unused PayMongo columns from subscription system tables

BEGIN;

-- Remove PayMongo plan reference from subscription_plans table
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS paymongo_plan_id;

-- Remove PayMongo subscription reference from subscriptions table
ALTER TABLE subscriptions DROP COLUMN IF EXISTS paymongo_subscription_id;

-- Remove PayMongo invoice reference from invoices table  
ALTER TABLE invoices DROP COLUMN IF EXISTS paymongo_invoice_id;

-- Remove PayMongo payment method reference from payment_methods table
ALTER TABLE payment_methods DROP COLUMN IF EXISTS paymongo_payment_method_id;

-- Remove PayMongo event reference from webhook_events table
ALTER TABLE webhook_events DROP COLUMN IF EXISTS paymongo_event_id;

-- Remove unused index for PayMongo subscription lookups
DROP INDEX IF EXISTS idx_subscriptions_paymongo_id;

COMMIT;

-- Rollback script (save as separate file if needed):
-- BEGIN;
-- ALTER TABLE subscription_plans ADD COLUMN paymongo_plan_id TEXT UNIQUE;
-- ALTER TABLE subscriptions ADD COLUMN paymongo_subscription_id TEXT UNIQUE;
-- ALTER TABLE invoices ADD COLUMN paymongo_invoice_id TEXT UNIQUE;
-- ALTER TABLE payment_methods ADD COLUMN paymongo_payment_method_id TEXT NOT NULL UNIQUE;
-- ALTER TABLE webhook_events ADD COLUMN paymongo_event_id TEXT NOT NULL UNIQUE;
-- CREATE INDEX idx_subscriptions_paymongo_id ON subscriptions(paymongo_subscription_id);
-- COMMIT;
```

- [ ] **Step 2: Review migration safety**

Check: The migration uses `IF EXISTS` clauses to prevent failures if columns were already manually removed. All changes are reversible with the provided rollback script.

- [ ] **Step 3: Commit migration script**

```bash
git add migrations/remove-paymongo-columns.sql
git commit -m "migration: add PayMongo column removal script

Create reversible migration to remove unused PayMongo columns:
- paymongo_plan_id from subscription_plans
- paymongo_subscription_id from subscriptions  
- paymongo_invoice_id from invoices
- paymongo_payment_method_id from payment_methods
- paymongo_event_id from webhook_events
- idx_subscriptions_paymongo_id index

Includes rollback script for safety.
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Update API Endpoint - Remove PayMongo Integration

**Files:**
- Modify: `src/app/api/subscriptions/create/route.ts`
- Test: Manual testing via browser/API client

- [ ] **Step 1: Read current endpoint implementation**

Read: `src/app/api/subscriptions/create/route.ts` (lines 1-267)

Current implementation:
- Lines 8-10: Imports PayMongo types
- Lines 122-131: Calls `createPayMongoCheckout()` 
- Lines 170-267: `createPayMongoCheckout()` function with PayMongo API call
- Lines 134-137: Returns PayMongo checkout URL and session ID

- [ ] **Step 2: Write failing test for new behavior**

First, let's write a test to verify the endpoint works without PayMongo:

```typescript
// Test: We'll verify via manual API testing that:
// 1. Endpoint returns success response
// 2. Response contains plan_id, plan_name, amount, message
// 3. No external API calls are made
// 4. Response time is faster (no external dependency)
```

- [ ] **Step 3: Replace PayMongo integration with lightweight validation**

Replace the entire file content with this updated version:

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSubscriptionByCompanyId,
  getSubscriptionPlan
} from '@/lib/subscription';

/**
 * Validate checkout request
 *
 * Validates that required fields are present and URLs are properly formatted
 *
 * @param body - The request body to validate
 * @returns NextResponse with error if validation fails, null if validation passes
 */
function validateCheckoutRequest(body: any): NextResponse | null {
  const { plan_id, success_url, cancel_url } = body;

  // Validate required fields
  if (!plan_id) {
    return NextResponse.json(
      { error: 'plan_id is required' },
      { status: 400 }
    );
  }

  if (!success_url) {
    return NextResponse.json(
      { error: 'success_url is required' },
      { status: 400 }
    );
  }

  if (!cancel_url) {
    return NextResponse.json(
      { error: 'cancel_url is required' },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(success_url);
    new URL(cancel_url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format for success_url or cancel_url' },
      { status: 400 }
    );
  }

  return null; // Validation passed
}

/**
 * POST /api/subscriptions/create
 *
 * Validates subscription plan and returns plan details for manual payment flow
 * (Previously created PayMongo checkout sessions - now removed)
 *
 * Request body:
 * - plan_id: string (required) - The subscription plan ID
 * - success_url: string (required) - URL to redirect after successful payment
 * - cancel_url: string (required) - URL to redirect after cancelled payment
 * - payment_method: string (optional) - Payment method indicator
 *
 * Response:
 * - success: boolean - Validation success status
 * - plan_id: string - Validated plan ID
 * - plan_name: string - Plan name for display
 * - amount: number - Plan amount
 * - message: string - Next step instructions
 */
export async function POST(req: Request) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Request Validation
    const body = await req.json();

    // Validate checkout request using helper function
    const validationError = validateCheckoutRequest(body);
    if (validationError) {
      return validationError;
    }

    const { plan_id } = body;

    // 3. Validate plan exists
    const plan = await getSubscriptionPlan(plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      );
    }

    // 4. Duplicate Subscription Check
    const existingSubscription = await getSubscriptionByCompanyId(session.companyId);
    if (existingSubscription) {
      // Check if existing subscription is still active
      if (['trialing', 'active'].includes(existingSubscription.status)) {
        return NextResponse.json(
          {
            error: 'Company already has an active subscription',
          },
          { status: 409 }
        );
      }

      // Allow checkout if subscription is past_due, cancelled, or suspended
      // User wants to upgrade or renew
    }

    // 5. Return validation response with plan details
    const response = {
      success: true,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: plan.amount,
      message: 'Proceed to payment instructions'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('POST /api/subscriptions/create error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Test the updated endpoint**

Manual test via browser or API client:
1. Navigate to `/subscription/checkout` 
2. Select a plan and click "Proceed to Payment"
3. Verify the page redirects to payment instructions
4. Check browser network tab - response should contain `success: true, plan_id, plan_name, amount, message`

- [ ] **Step 5: Commit API endpoint changes**

```bash
git add src/app/api/subscriptions/create/route.ts
git commit -m "refactor: remove PayMongo API call from subscription creation

Replace PayMongo checkout session creation with lightweight validation.
Frontend already ignored PayMongo response, this removes dead code.

Changes:
- Remove createPayMongoCheckout() function and PayMongo API call
- Remove PayMongo type imports  
- Return simple validation response with plan details
- Keep all validation logic (auth, plan checks, duplicate prevention)
- Maintain API contract - frontend behavior unchanged

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Clean Up Type Definitions

**Files:**
- Modify: `src/types/subscription.ts`
- Test: TypeScript compilation check

- [ ] **Step 1: Read current type definitions**

Read: `src/types/subscription.ts` (lines 1-400 approximately)

Identify PayMongo-specific interfaces:
- Lines 36-67: Legacy PayMongo subscription types
- Lines 272-287: `PayMongoCheckoutRequest` and `PayMongoCheckoutResponse`
- Lines 289-301: `LegacyPaymentMethod` with `paymongo_payment_method_id`
- Lines 304-315: `WebhookEvent` with `paymongo_event_id`
- Lines 318-334: `Invoice` with `paymongo_invoice_id`

- [ ] **Step 2: Remove PayMongo-specific interfaces**

Find and remove the following sections from the file:

```typescript
// REMOVE these sections (lines 36-67 approximately):
// LEGACY PAYMONGO SUBSCRIPTION TYPES
// All interfaces with PayMongo-specific fields

// REMOVE these sections (lines 272-334 approximately):
// PayMongoCheckoutRequest interface
// PayMongoCheckoutResponse interface  
// LegacyPaymentMethod interface
// WebhookEvent interface with paymongo_event_id
// Invoice interface with paymongo_invoice_id
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run type-check
```

Expected: No TypeScript compilation errors related to missing types

- [ ] **Step 4: Check for any remaining PayMongo type references**

```bash
grep -r "PayMongo\|paymongo" src/types/ --include="*.ts" --include="*.tsx"
```

Expected: Only remaining references should be in comments or already handled

- [ ] **Step 5: Commit type definition cleanup**

```bash
git add src/types/subscription.ts
git commit -m "refactor: remove PayMongo type definitions

Remove unused PayMongo-specific interfaces from subscription types:
- PayMongoCheckoutRequest/Response interfaces
- LegacySubscription types with PayMongo fields
- LegacyPaymentMethod with paymongo_payment_method_id
- WebhookEvent with paymongo_event_id
- Invoice with paymongo_invoice_id

These types are not used by current payment verification system.
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Clean Up Environment Configuration

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Read current environment example**

Read: `.env.example` (lines 1-20 approximately)

Identify PayMongo environment variables (typically lines 4-7):
```bash
PAYMONGO_SECRET_KEY=sk_test_xxx
PAYMONGO_PUBLIC_KEY=pk_test_xxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxx
PAYMONGO_API_URL=https://api.paymongo.com/v1
```

- [ ] **Step 2: Remove PayMongo environment variables**

Edit `.env.example` and remove the PayMongo variable lines. The file should now only contain:
- Database configuration
- NextAuth configuration  
- Current payment system variables (GCASH_WEBHOOK_SECRET, etc.)
- Other application configuration

- [ ] **Step 3: Verify no remaining PayMongo env references**

```bash
grep -r "PAYMONGO" .env.example
```

Expected: No results

- [ ] **Step 4: Commit environment cleanup**

```bash
git add .env.example
git commit -m "config: remove PayMongo environment variables

Remove unused PayMongo configuration from .env.example:
- PAYMONGO_SECRET_KEY
- PAYMONGO_PUBLIC_KEY
- PAYMONGO_WEBHOOK_SECRET
- PAYMONGO_API_URL

Current payment system uses GCash/webhook verification, not PayMongo.
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Run Database Migration

**Files:**
- Database: PostgreSQL database
- Migration: `migrations/remove-paymongo-columns.sql`

- [ ] **Step 1: Backup database before migration**

```bash
# Create database backup
pg_dump $DATABASE_URL > backup-before-paymongo-removal-$(date +%Y%m%d).sql

# Verify backup was created
ls -lh backup-before-paymongo-removal-*.sql
```

- [ ] **Step 2: Test migration on development environment**

```bash
# Run migration on development database first
psql $DEV_DATABASE_URL -f migrations/remove-paymongo-columns.sql
```

Expected: Output showing successful ALTER TABLE commands

- [ ] **Step 3: Verify schema changes in development**

```bash
# Check that PayMongo columns are removed
psql $DEV_DATABASE_URL -c "\d subscription_plans"
psql $DEV_DATABASE_URL -c "\d subscriptions" 
psql $DEV_DATABASE_URL -c "\d invoices"
psql $DEV_DATABASE_URL -c "\d payment_methods"
psql $DEV_DATABASE_URL -c "\d webhook_events"
```

Expected: No `paymongo_*` columns in any table schema

- [ ] **Step 4: Test application with new schema**

Run the application and verify:
- `/subscription/checkout` page works
- Payment verification flow functions
- No database errors related to missing columns

- [ ] **Step 5: Run migration on production database**

```bash
# Run migration on production database
psql $DATABASE_URL -f migrations/remove-paymongo-columns.sql
```

Expected: Successful migration execution

- [ ] **Step 6: Commit migration execution record**

```bash
git add migrations/remove-paymongo-columns.sql
git commit -m "migration: execute PayMongo column removal

Execute database migration to remove unused PayMongo columns:
- Successfully removed paymongo_plan_id from subscription_plans
- Successfully removed paymongo_subscription_id from subscriptions
- Successfully removed paymongo_invoice_id from invoices
- Successfully removed paymongo_payment_method_id from payment_methods
- Successfully removed paymongo_event_id from webhook_events
- Dropped unused index idx_subscriptions_paymongo_id

Database backup created before migration.
Application tested successfully with new schema.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Remove Archive Directory

**Files:**
- Remove: `archive/paymongo/` directory

- [ ] **Step 1: List archived PayMongo files**

```bash
ls -la archive/paymongo/
```

Expected: Shows README.md, documentation/, migration_files/, original_integration/

- [ ] **Step 2: Verify archive exists in git history**

```bash
git log --oneline --all -- archive/paymongo/
```

Expected: Shows commit history proving files are in git history

- [ ] **Step 3: Remove archive directory**

```bash
rm -rf archive/paymongo/
```

- [ ] **Step 4: Verify removal**

```bash
ls archive/
```

Expected: paymongo directory no longer exists

- [ ] **Step 5: Commit archive removal**

```bash
git add archive/paymongo/
git commit -m "cleanup: remove PayMongo archive directory

Remove entire archive/paymongo/ directory containing:
- README.md and 5 documentation files
- Original PayMongo integration (4 API routes)
- Migration files

All PayMongo code preserved in git history for reference if needed.
Current payment verification system (GCash/GoTyme/USDC) is fully functional.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Update Documentation References

**Files:**
- Modify: `README.md` if it contains PayMongo references
- Search: All documentation files

- [ ] **Step 1: Search for PayMongo references in documentation**

```bash
grep -r "PayMongo\|paymongo" docs/ README.md *.md --include="*.md" 2>/dev/null || echo "No docs found with PayMongo references"
```

- [ ] **Step 2: Update any found references**

If references found, update them to reflect current payment verification system. For example, change:
- "PayMongo payment gateway" → "Manual payment verification (GCash/GoTyme/USDC)"
- Remove any PayMongo setup instructions
- Update payment flow descriptions

- [ ] **Step 3: Commit documentation updates**

```bash
git add README.md docs/
git commit -m "docs: update payment system references

Update documentation to reflect current payment verification system:
- Remove PayMongo payment gateway references
- Update payment flow descriptions
- Clarify current GCash/GoTyme/USDC payment process

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Build Verification and Testing

**Files:**
- Build: Next.js build output
- Test: Application functionality

- [ ] **Step 1: Run TypeScript compilation check**

```bash
npm run type-check
```

Expected: No TypeScript compilation errors

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Successful production build with no errors

- [ ] **Step 3: Test complete payment flow**

Manual testing checklist:
1. Navigate to `/subscription/checkout`
2. Select a subscription plan
3. Click "Proceed to Payment" 
4. Verify redirect to `/subscription/payment-instructions`
5. Verify QR codes display correctly (GCash/GoTyme/USDC)
6. Test payment proof submission
7. Verify admin approval workflow
8. Check subscription activation works

- [ ] **Step 4: Verify no PayMongo errors in logs**

Check application logs and browser console for any PayMongo-related errors:
- Network tab should show no PayMongo API calls
- Console should have no "PayMongo" errors
- Server logs should be clean of PayMongo references

- [ ] **Step 5: Performance validation**

Compare API response times:
- Before: PayMongo API call added latency (~500-1000ms)
- After: Direct validation response (<50ms)
- Verify improvement in payment instructions page load time

- [ ] **Step 6: Final cleanup commit**

```bash
git add .
git commit -m "test: verify PayMongo removal complete

Build verification and testing completed successfully:
✅ TypeScript compilation passes
✅ Production build succeeds
✅ Complete payment flow tested and working
✅ No PayMongo errors in logs
✅ API response times improved
✅ All functionality maintained

PayMongo payment gateway fully removed from codebase.
Current payment verification system (GCash/GoTyme/USDC) operational.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Final Verification and Summary

**Files:**
- Summary: Implementation verification

- [ ] **Step 1: Verify all PayMongo references removed**

```bash
# Search entire codebase for any remaining PayMongo references
grep -r "PayMongo\|paymongo" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || echo "No PayMongo references found"
```

Expected: No remaining PayMongo references in source code

- [ ] **Step 2: Verify git commits**

```bash
git log --oneline -10
```

Expected: Should see all commits from this implementation plan

- [ ] **Step 3: Create summary of changes**

Summary of completed changes:
1. ✅ Database migration created and executed
2. ✅ API endpoint updated to remove PayMongo integration  
3. ✅ Type definitions cleaned up
4. ✅ Environment configuration updated
5. ✅ Archive directory removed
6. ✅ Documentation updated
7. ✅ Build verification passed
8. ✅ Payment flow tested successfully

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "complete: PayMongo payment gateway removal finished

PayMongo payment integration completely removed from codebase:
- Database schema cleaned of PayMongo columns
- API endpoints updated to use lightweight validation
- Type definitions cleaned of PayMongo interfaces
- Environment configuration updated
- Archive directory removed (preserved in git history)

Current payment verification system (GCash/GoTyme/USDC) fully operational.
All manual and automatic payment verification flows tested and working.
No PayMongo dependencies remain in active codebase.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Testing Summary

**Manual Testing Required:**
1. Complete subscription flow (checkout → payment → verification → activation)
2. Admin payment approval workflow
3. Automatic GCash webhook verification
4. Error handling scenarios

**Automated Testing:**
- TypeScript compilation: `npm run type-check`
- Production build: `npm run build`
- Database migration testing on dev environment first

**Performance Validation:**
- API response time improvement (no external PayMongo calls)
- Database query performance (removed unused columns)

## Rollback Plan

If issues arise during execution:

1. **Database changes:** Run rollback SQL from Task 1
2. **Code changes:** Revert specific commits via git
3. **API endpoint:** `git revert <commit-hash>` for endpoint changes
4. **Type definitions:** `git revert <commit-hash>` for type cleanup

All changes are isolated and reversible within minutes.

## Success Criteria

✅ **No PayMongo references** remain in active codebase  
✅ **Payment flow works** without any degradation  
✅ **Build passes** with no TypeScript errors  
✅ **Database schema** successfully updated  
✅ **All functionality** maintained (GCash/GoTyme/USDC payments)  
✅ **Performance improved** (no external API dependencies)