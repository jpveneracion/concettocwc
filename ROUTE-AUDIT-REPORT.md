# Route Audit Report
**Date:** 2026-07-23  
**Status:** CRITICAL MISALIGNMENTS FOUND

## Executive Summary
Your application has **two different pricing systems** that are not properly connected:

1. **Individual Subscription Plans System** (`subscription_plans` table)
2. **Pricing Calculation System** (`pricing_config` table)

The main issue: Client components use `/api/subscription-plans` while the proxy expects `/api/pricing` to be the primary checkout endpoint.

---

## Route Analysis

### ✅ WORKING: Individual Subscription Plans Routes

**Route:** `/api/subscription-plans`  
**File:** `src/app/api/subscription-plans/route.ts`  
**Method:** GET  
**Purpose:** Returns individual subscription plans from database with UUIDs  
**Currently Used By:** `PlanComparison.tsx:64`

**What it does:**
- Fetches all active plans from `subscription_plans` table
- Returns plans with UUID, name, price, discount_percent, features
- Used for displaying plan options in checkout

**Response Format:**
```json
{
  "plans": [
    {
      "id": "uuid-here",
      "name": "Quarterly",
      "description": "Save 10% with quarterly billing",
      "price": 1350.00,
      "currency": "PHP",
      "interval": "quarter",
      "discount_percent": 10,
      "features": ["feature1", "feature2"],
      "is_active": true
    }
  ],
  "count": 3
}
```

**Route:** `/api/subscription-plans/[id]`  
**File:** `src/app/api/subscription-plans/[id]/route.ts`  
**Method:** GET  
**Purpose:** Get single plan by UUID  
**Currently Used By:** `payment-instructions/page.tsx:77`

---

### ⚠️ UNUSED: Pricing Calculation Route

**Route:** `/api/pricing`  
**File:** `src/app/api/pricing/route.ts`  
**Method:** GET  
**Purpose:** Calculate itemized pricing breakdown based on billing period  
**Currently Used By:** **NOTHING** (only test files use this)

**What it does:**
- Calculates pricing from `pricing_config` table
- Takes query parameters: `plan` (monthly/quarterly/annual), `promo_percent`
- Returns detailed pricing breakdown with itemized discounts

**Query Parameters:**
- `plan`: 'monthly' | 'quarterly' | 'annual' (required)
- `promo_percent`: number 0-100 (optional)

**Response Format:**
```json
{
  "success": true,
  "pricing": {
    "base_price": 500,
    "period_months": 3,
    "base_total": 1500,
    "period_discount_percent": 10,
    "period_discount_amount": 150.00,
    "price_after_period_discount": 1350.00,
    "promo_discount_percent": 25,
    "promo_discount_amount": 337.50,
    "final_price": 1012.50,
    "billing_period": "quarterly",
    "calculated_at": "2026-07-23T..."
  }
}
```

**MISALIGNMENT:** This endpoint exists and is allowed in proxy.ts:58 but **no client component actually uses it**. Only test files (`test-pricing-calculations.js`, `test-pricing-direct.js`) use this endpoint.

---

### ✅ WORKING: Admin Pricing Routes

**Route:** `/api/admin/pricing`  
**File:** `src/app/api/admin/pricing/route.ts`  
**Methods:** GET, POST  
**Purpose:** Admin pricing configuration management  
**Currently Used By:** `PricingManager.tsx:32,129`

**What it does:**
- GET: Returns current pricing config and scheduled configs
- POST: Updates pricing configuration with audit trail
- Uses `pricing_config` table

**Route:** `/api/admin/pricing/history`  
**File:** `src/app/api/admin/pricing/history/route.ts`  
**Method:** GET  
**Purpose:** Paginated pricing change history  
**Currently Used By:** `PricingHistory.tsx:28`

**Route:** `/api/admin/pricing/rollback`  
**File:** `src/app/api/admin/pricing/rollback/route.ts`  
**Method:** POST  
**Purpose:** Rollback to previous pricing configuration  
**Currently Used By:** `PricingHistory.tsx:51`

---

### ✅ WORKING: Other Routes

**Route:** `/api/validate-promo-code`  
**File:** `src/app/api/validate-promo-code/route.ts`  
**Method:** POST  
**Purpose:** Validate promo codes with discount calculation  
**Currently Used By:** `payment-instructions/page.tsx:114`

**Note:** This endpoint correctly uses the pricing calculation system via `calculatePrice()` function.

---

## Core Problem: Two Disconnected Pricing Systems

### System 1: Individual Subscription Plans
- **Database Table:** `subscription_plans`
- **API Endpoint:** `/api/subscription-plans`
- **Used By:** `PlanComparison.tsx` (customer checkout UI)
- **Purpose:** Display plan options with fixed UUIDs for QR codes, payments, subscriptions
- **Data:** Individual plan records with name, price, discount_percent, interval

### System 2: Pricing Calculation Engine  
- **Database Table:** `pricing_config`
- **API Endpoint:** `/api/pricing`
- **Used By:** NOTHING in production (only tests)
- **Purpose:** Calculate dynamic pricing with billing period logic
- **Data:** Base rate, discount percentages, thresholds

### The Misalignment

**Problem 1:** The pricing calculation endpoint (`/api/pricing`) exists but no client uses it  
**Location:** `src/app/api/pricing/route.ts` exists but is not called by any component  
**Evidence:** Only found in test files, grep shows no production usage

**Problem 2:** Admin pricing updates don't sync to individual plans  
**Location:** `src/lib/pricing-service.ts:620-680`  
**Evidence:** The `updateSubscriptionPlans()` function exists to sync pricing_config → subscription_plans, but this only happens during admin pricing updates

**Problem 3:** Customers see static plans from subscription_plans table  
**Location:** `PlanComparison.tsx:64` calls `/api/subscription-plans`  
**Evidence:** Component fetches from subscription_plans, not from pricing calculation engine

**Problem 4:** Proxy expects pricing endpoint to be primary  
**Location:** `src/proxy.ts:58`  
**Evidence:** Code explicitly allows `/api/pricing` as public endpoint for checkout display

---

## Route Connection Matrix

| Client Component | Calls | Server Route | Status |
|-----------------|-------|--------------|---------|
| `PlanComparison.tsx` | `/api/subscription-plans` | ✅ Exists | **WORKING** |
| `payment-instructions/page.tsx` | `/api/subscription-plans/{id}` | ✅ Exists | **WORKING** |
| `payment-instructions/page.tsx` | `/api/validate-promo-code` | ✅ Exists | **WORKING** |
| `PricingManager.tsx` | `/api/admin/pricing` | ✅ Exists | **WORKING** |
| `PricingHistory.tsx` | `/api/admin/pricing/history` | ✅ Exists | **WORKING** |
| `PricingHistory.tsx` | `/api/admin/pricing/rollback` | ✅ Exists | **WORKING** |
| **NONE** | `/api/pricing` | ✅ Exists | **UNUSED** |
| Test files only | `/api/pricing` | ✅ Exists | **TESTS ONLY** |

---

## Data Flow Issues

### Current (Broken) Flow:
1. Admin updates pricing via `/api/admin/pricing` → Updates `pricing_config` table
2. System syncs to `subscription_plans` table via `updateSubscriptionPlans()`
3. Customer sees plans from `/api/subscription-plans` (subscription_plans table)
4. `/api/pricing` endpoint exists but is never called by customers

### Expected (Working) Flow:
1. Admin updates pricing via `/api/admin/pricing` → Updates `pricing_config` table
2. Customer checkout calls `/api/pricing?plan=quarterly&promo_percent=25`
3. System calculates price dynamically from current pricing config
4. OR: Keep using individual plans but ensure they stay in sync

---

## Surgical Fixes Needed

### Issue 1: Unused Pricing Endpoint
**Severity:** MEDIUM  
**Location:** `src/app/api/pricing/route.ts` exists but unused  
**Problem:** Endpoint created but not integrated into checkout flow  
**Evidence:** Only test files use this endpoint

**You need to decide:**
- Option A: Use `/api/pricing` for dynamic pricing in checkout
- Option B: Remove `/api/pricing` and stick with individual plans
- Option C: Keep both but make them work together properly

### Issue 2: Dual Pricing System Confusion  
**Severity:** HIGH  
**Location:** Two different pricing tables and endpoints  
**Problem:** Unclear which system should be the source of truth  
**Evidence:** `pricing_config` vs `subscription_plans`, `/api/pricing` vs `/api/subscription-plans`

**You need to decide:**
- Which system is the source of truth?
- Should pricing be dynamic (from pricing_config) or static (from subscription_plans)?
- How do QR codes and payments work with each approach?

### Issue 3: Admin Updates Sync Mechanism
**Severity:** HIGH  
**Location:** `src/lib/pricing-service.ts:620-680`  
**Problem:** Sync mechanism exists but may not be working correctly  
**Evidence:** `updateSubscriptionPlans()` function updates subscription_plans when pricing_config changes

**Current Status:** ⚠️ EXISTS BUT MAY NOT BE RELIABLE

---

## Component-to-Route Mapping

### Pricing Components
- `PlanComparison.tsx` → `/api/subscription-plans` ✅
- `PricingManager.tsx` → `/api/admin/pricing` ✅  
- `PricingHistory.tsx` → `/api/admin/pricing/history` ✅

### Payment Components
- `payment-instructions/page.tsx` → `/api/subscription-plans/{id}` ✅
- `payment-instructions/page.tsx` → `/api/validate-promo-code` ✅

### Missing Connections
- **NO component** → `/api/pricing` ❌ (exists but unused)

---

## Next Steps for Surgical Correction

1. **Decide on pricing architecture:**
   - Dynamic pricing from `pricing_config` via `/api/pricing`?
   - Static individual plans from `subscription_plans` via `/api/subscription-plans`?
   - Hybrid approach?

2. **If using `/api/pricing`:**
   - Update `PlanComparison.tsx` to call `/api/pricing?plan=quarterly` instead of `/api/subscription-plans`
   - Update checkout flow to use calculated pricing
   - Ensure QR codes and payments work with dynamic pricing

3. **If using `/api/subscription-plans`:**
   - Remove or repurpose `/api/pricing` endpoint
   - Ensure admin pricing updates properly sync to individual plans
   - Test that `updateSubscriptionPlans()` function works correctly

4. **Test the sync mechanism:**
   - Make admin pricing update
   - Verify subscription_plans table gets updated
   - Check that customer UI shows correct prices

---

## Navigation Menu Items vs Routes

### Desktop Navigation (AppLayout.tsx:9-26)

**Main Navigation:**
| Menu Item | Target Route | Route Status | Notes |
|-----------|--------------|--------------|-------|
| Dashboard | `/dashboard` | ✅ Page exists | Working |
| Orders | `/quotes` | ✅ Page exists | Working |
| New quote | `/quotes/new` | ✅ Page exists | Working |
| Products | `/products` | ✅ Page exists | Working |
| Company Products | `/company-products` | ✅ Page exists | Working |
| Settings | `/settings` | ✅ Page exists | Working |
| Plans & Pricing | `/subscription/checkout` | ✅ Page exists | Working |

**Admin Navigation:**
| Menu Item | Target Route | Route Status | Notes |
|-----------|--------------|--------------|-------|
| Admin Dashboard | `/admin/dashboard` | ✅ Page exists | Working |
| Pending Products | `/admin/pending-products` | ✅ Page exists | Working |
| Company Products | `/admin/company-products` | ✅ Page exists | Working |
| Activation Codes | `/admin/activation-codes` | ✅ Page exists | Working |
| Subscription Plans | `/admin/plans` | ✅ Page exists | Working |
| Revenue Analytics | `/admin/revenue` | ✅ Page exists | Working |

### Mobile Navigation (MobileNav.tsx:11-23)

**Main Navigation:**
| Menu Item | Target Route | Route Status | Notes |
|-----------|--------------|--------------|-------|
| Dashboard | `/dashboard` | ✅ Page exists | Working |
| Orders | `/quotes` | ✅ Page exists | Working |
| New quote | `/quotes/new` | ✅ Page exists | 🔒 Trial restricted |
| Products | `/products` | ✅ Page exists | Working |
| Settings | `/settings` | ✅ Page exists | Working |

**⚠️ MISALIGNMENT:** Mobile nav missing items compared to desktop:
- Missing: `/company-products` 
- Missing: `/subscription/checkout` (Plans & Pricing)

**Admin Navigation (Mobile):**
| Menu Item | Target Route | Route Status | Notes |
|-----------|--------------|--------------|-------|
| Admin Dashboard | `/admin/dashboard` | ✅ Page exists | Working |
| Pending Products | `/admin/pending-products` | ✅ Page exists | Working |
| Activation Codes | `/admin/activation-codes` | ✅ Page exists | Working |

**⚠️ MISALIGNMENT:** Mobile admin nav missing items compared to desktop:
- Missing: `/admin/company-products`
- Missing: `/admin/plans` 
- Missing: `/admin/revenue`

### Admin Header Quick Actions (AdminHeader.tsx:32-54)

| Menu Item | Target Route | Route Status | Notes |
|-----------|--------------|--------------|-------|
| Generate Code | `/admin/activation-codes` | ✅ Page exists | Working |
| Promo Codes | `/admin/promo-codes` | ✅ Page exists | Working |
| Pricing | `/admin/pricing` | ✅ Page exists | Working |
| Pending Products | `/admin/pending-products` | ✅ Page exists | Badged with count |

---

## Navigation Inconsistencies Found

### Issue 1: Mobile vs Desktop Navigation Mismatch
**Severity:** MEDIUM  
**Location:** `MobileNav.tsx` vs `AppLayout.tsx`  
**Problem:** Mobile users can't access all features that desktop users can

**Missing from mobile:**
- Company Products (`/company-products`)
- Plans & Pricing (`/subscription/checkout`)

**Missing from mobile admin:**
- Admin Company Products (`/admin/company-products`)
- Subscription Plans (`/admin/plans`)
- Revenue Analytics (`/admin/revenue`)

### Issue 2: Inconsistent Admin Navigation
**Severity:** LOW  
**Location:** Multiple admin navigation sources  
**Problem:** Different admin sections show different menu items

**AppLayout admin nav:** 6 items  
**MobileNav admin nav:** 3 items  
**AdminHeader quick actions:** 4 items

### Issue 3: No Navigation to Key Admin Pages
**Severity:** MEDIUM  
**Location:** Various navigation components  
**Problem:** Some important admin pages exist but aren't in main navigation

**Pages not in main navigation:**
- `/admin/promo-codes` (only in AdminHeader)
- `/admin/pricing` (only in AdminHeader)
- `/admin/payment-settings` (not in any nav)
- `/admin/verifications` (not in any nav)

---

**END OF AUDIT REPORT**

All findings are based on actual code inspection. No assumptions were made about fixes - only current state analysis.