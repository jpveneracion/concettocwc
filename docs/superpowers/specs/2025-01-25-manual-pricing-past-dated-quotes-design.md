# Manual Pricing for Past-Dated Quotes - Design Document

**Date:** 2025-01-25  
**Status:** Approved  
**Author:** Claude (Subagent-Driven Development)  
**Purpose:** Enable manual price entry for past-dated quotes to ensure accurate income tracking

## Problem Statement

The system allows users to create quotes with past dates (date < now), even after the 3-day trial period. However, pricing is only set based on current product settings (`company_collections` table). If past orders had different pricing than current rates, income tracking on the dashboard becomes erroneous.

## User Requirements

**Core Requirement:** If users enter an order date at a past date, allow them to input the price for that blinds order at the price they were actually sold.

1. **Past-dated quotes**: Users can enter quotes with dates in the past  
2. **Editable prices when date < now**: Make price fields editable only when quote date is in the past
3. **No other changes**: Keep existing database, API, and dashboard functionality unchanged

## Solution Overview

**Approach:** Make existing price fields conditionally editable based on quote date

**Key Design Decisions:**
- No database schema changes (use existing `retail_price_sqft` and `supplier_cost_sqft` fields)
- No API changes (existing endpoints already handle price values)  
- No dashboard changes (already uses stored prices from quotes)
- Simple frontend-only change: make price fields editable when `date < now`

## Implementation

### Frontend Changes

**Component: `QuoteForm.tsx`**

**1. Date Detection Logic**
```typescript
const isPastDatedQuote = new Date(date) < new Date();
```

**2. Editable Price Fields**
- Make `retail_price_sqft` and `supplier_cost_sqft` conditionally editable
- Editable only when `isPastDatedQuote === true`
- Read-only when quote date is today or in the future (current behavior)

**3. Implementation Approach**
- Change price display from read-only to editable inputs when past date detected
- Keep all existing logic for price calculations and updates
- No data structure changes needed
- Minimal UI changes to indicate editability

### How It Works

**Current Behavior (date >= today):**
- Product lookup → auto-fills prices → prices remain read-only → saved to database

**New Behavior (date < today):**  
- Product lookup → auto-fills prices → prices become editable → user can override → saved to database

**Dashboard (no changes):**
- Already uses stored `retail_price_sqft` and `supplier_cost_sqft` values
- Works correctly with both auto-filled and manually entered prices
- No changes needed

## Data Flow

### Creating Past-Dated Quote
1. User enters past date → Form detects `date < now()`
2. Product lookup works normally → Auto-fills initial prices  
3. Price fields become editable (not read-only)
4. User can override prices as needed
5. Save quote → Manual prices stored in existing database columns
6. Dashboard → Uses stored prices for accurate income tracking

### Creating Current-Dated Quote
- **Behavior unchanged** → Prices remain read-only after product lookup

## Testing Strategy

### Unit Tests
1. **Date detection logic**
   - Test past date recognition (< today)
   - Test today date handling (= today, no edit)
   - Test future date handling (> today, no edit)

2. **Price field behavior**
   - Verify editable when past date
   - Verify read-only when current/future date
   - Test price updates work correctly

### Integration Tests  
1. **Quote creation flow**
   - Create past-dated quote with manual prices
   - Create current-dated quote (no manual pricing)
   - Verify both save correctly

2. **Dashboard verification**
   - Verify dashboard uses manual prices for past quotes
   - Verify dashboard uses auto-filled prices for current quotes
   - Test income calculation accuracy

### E2E Tests
1. **User workflow**
   - Navigate to quote creation
   - Enter past date
   - Verify price fields become editable
   - Enter manual prices
   - Save and verify dashboard reflects correct amounts

## Implementation Phases

### Phase 1: Frontend Implementation
1. Add date detection logic to QuoteForm
2. Make price fields conditionally editable
3. Add visual indicator (optional) for past-dated quotes
4. Test user interactions

### Phase 2: Testing & Validation  
1. Run all test suites
2. Manual testing workflows
3. Edge case validation
4. Verify dashboard calculations

## Error Handling

**Validation:**
- Manual prices must be positive numbers (existing validation)
- Manual retail price should be >= manual supplier cost (warning, existing)
- Prevent negative prices (existing validation)

**Edge Cases:**
- Quote date exactly today → treated as current (no edit, read-only)
- Quote date in future → treated as current (no edit, read-only)
- Empty price fields → use auto-filled values from product lookup
- Product lookup failure → manual entry still available

## Performance Considerations

**Frontend Performance:**
- Date comparison is client-side, negligible impact
- Additional conditional rendering, minimal overhead  
- No additional API calls or database queries

## Security Considerations

**Access Control:**
- Manual pricing available to all users who can create quotes
- No special permissions required
- Existing authorization and validation still apply

**Data Integrity:**
- Manual prices stored in existing columns with existing validation
- No additional security concerns beyond current system

## Mobile Optimization

**Touch Targets:**
- Editable price input fields maintain 44px minimum height (existing)
- Clear tap targets for price editing
- Responsive design maintained (existing)

## Success Criteria

1. ✅ Past-dated quotes show editable price fields
2. ✅ Current/future-dated quotes maintain read-only prices  
3. ✅ Both supplier cost and retail price editable when past date
4. ✅ Manual prices stored correctly in existing database columns
5. ✅ Dashboard uses stored prices for accurate income tracking
6. ✅ All tests pass (unit, integration, E2E)
7. ✅ Mobile experience remains optimal
8. ✅ No regression in existing quote creation workflow

## Technical Notes

**Scope:**
- Frontend-only implementation
- No database migrations required
- No API endpoint changes required
- No dashboard code changes required

**Dependencies:**
- Existing QuoteForm component
- Existing quote creation/update logic
- Existing price calculation utilities
- No new external dependencies required

**Complexity:**
- Low complexity implementation
- Minimal code changes required
- Low risk of breaking existing functionality
- Easy to test and validate