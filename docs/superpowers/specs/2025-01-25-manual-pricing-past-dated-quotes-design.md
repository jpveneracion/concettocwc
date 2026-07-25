# Manual Pricing for Past-Dated Quotes - Design Document

**Date:** 2025-01-25  
**Status:** Approved  
**Author:** Claude (Subagent-Driven Development)  
**Purpose:** Enable manual price entry for past-dated quotes to ensure accurate income tracking

## Problem Statement

The system allows users to create quotes with past dates (date < now), even after the 3-day trial period. However, pricing is only set based on current product settings (`company_collections` table). If past orders had different pricing than current rates, income tracking on the dashboard becomes erroneous.

## User Requirements

1. **Past-dated quotes**: Users can enter quotes with dates in the past
2. **Manual price entry**: Users manually enter prices for each window when creating past-dated orders
3. **Flexible pricing**: Different windows can have different fabrics/collections with different pricing
4. **Both prices editable**: Users can manually enter both supplier cost and retail price independently
5. **Past-dated only**: Manual price entry only available when quote date < today
6. **Dashboard accuracy**: Dashboard uses actual stored prices from quotes for income calculations

## Solution Overview

**Approach:** Manual price entry for past-dated quotes with price override tracking

**Key Design Decisions:**
- No historical pricing database (users enter prices manually)
- Manual price entry only enabled for past-dated quotes (date < today)
- Both supplier cost and retail price independently editable
- Track which prices were manually overridden vs auto-filled
- Dashboard uses manual prices when available, falls back to auto-filled prices

## Architecture

### Database Schema Changes

**Table: `quote_items` (ALTER TABLE)**

```sql
ALTER TABLE quote_items 
ADD COLUMN price_manually_overridden BOOLEAN DEFAULT FALSE,
ADD COLUMN manual_retail_price DECIMAL(10,2),
ADD COLUMN manual_supplier_cost DECIMAL(10,2);
```

**Field Descriptions:**
- `price_manually_overridden`: Flags whether prices were manually entered
- `manual_retail_price`: Manually entered retail price per sq.ft.
- `manual_supplier_cost`: Manually entered supplier cost per sq.ft.

### Frontend Changes

**Component: `QuoteForm.tsx`**

**1. Date-Based Conditional Rendering**
```typescript
const isPastDatedQuote = new Date(date) < new Date();
```

**2. Editable Price Fields**
- Make `retail_price_sqft` and `supplier_cost_sqft` conditionally editable
- Editable only when `isPastDatedQuote === true`
- Add visual indicators for manually overridden prices

**3. UI Enhancements**
- "💰 Manual Pricing Enabled" badge when quote date is past
- Highlight manually overridden prices with different styling
- Show original auto-filled price for comparison when editing
- Clear visual distinction between auto-filled and manual prices

**4. Data Structure Changes**
```typescript
interface ItemRow {
  // ... existing fields
  retail_price_sqft: number;        // Auto-filled or manual
  supplier_cost_sqft: number;       // Auto-filled or manual
  price_manually_overridden: boolean; // Track manual override
  original_retail_price?: number;    // Store auto-filled for comparison
  original_supplier_cost?: number;  // Store auto-filled for comparison
}
```

### API Changes

**Endpoint: `POST /api/quotes` and `PUT /api/quotes/{id}`**

**Request Body Updates:**
```typescript
{
  // ... existing fields
  items: [{
    // ... existing item fields
    price_manually_overridden: boolean,
    manual_retail_price?: number,
    manual_supplier_cost?: number
  }]
}
```

**Backend Logic:**
1. Accept manual prices in request payload
2. Store in `quote_items` table
3. If `price_manually_overridden = true`, use manual prices for calculations
4. Dashboard queries use manual prices when available

## Data Flow

### Creating Past-Dated Quote

1. **User enters past date** → Form detects `date < today`
2. **Manual pricing badge appears** → "💰 Manual Pricing Enabled"
3. **Product lookup works normally** → Auto-fills initial prices
4. **Price fields become editable** → Both supplier cost and retail price
5. **User can override prices** → Enter manual values per window
6. **Visual feedback** → Highlighted manual prices, show original values
7. **Save with manual flags** → `price_manually_overridden = true`
8. **Dashboard uses manual prices** → Accurate historical income tracking

### Creating Current-Dated Quote

- **Behavior unchanged** → Prices remain read-only after product lookup
- **No manual pricing** → Standard workflow maintained

### Dashboard Calculations

**Query Logic:**
```sql
SELECT 
  COALESCE(manual_retail_price, retail_price_sqft) as effective_retail_price,
  COALESCE(manual_supplier_cost, supplier_cost_sqft) as effective_supplier_cost
FROM quote_items
```

**Priority:** Manual prices > Auto-filled prices

## Testing Strategy

### Unit Tests
1. **Date detection logic**
   - Test past date recognition
   - Test today date handling
   - Test future date handling

2. **Price override logic**
   - Test manual price storage
   - Test fallback to auto-filled prices
   - Test COALESCE behavior

### Integration Tests
1. **Quote creation flow**
   - Create past-dated quote with manual prices
   - Create current-dated quote (no manual prices)
   - Verify both workflows work correctly

2. **Dashboard accuracy**
   - Verify dashboard uses manual prices for past quotes
   - Verify dashboard uses auto-filled prices for current quotes
   - Test income calculation accuracy

### E2E Tests
1. **User workflow**
   - Navigate to quote creation
   - Enter past date
   - Verify manual pricing appears
   - Enter manual prices
   - Save and verify dashboard reflects correct amounts

## Implementation Phases

### Phase 1: Database Schema
1. Add new columns to `quote_items` table
2. Create migration script
3. Verify schema changes

### Phase 2: Backend API
1. Update quote creation/update endpoints
2. Handle manual price fields
3. Implement COALESCE logic for queries
4. Add validation for manual prices

### Phase 3: Frontend - QuoteForm
1. Add date detection logic
2. Make price fields conditionally editable
3. Add UI indicators and badges
4. Implement price comparison display
5. Test user interactions

### Phase 4: Dashboard Integration
1. Update dashboard queries to use manual prices
2. Verify income calculations
3. Test with mixed manual/auto-filled data

### Phase 5: Testing & Validation
1. Run all test suites
2. Manual testing workflows
3. Edge case validation
4. Performance testing

## Error Handling

**Validation:**
- Manual prices must be positive numbers
- Manual retail price should be >= manual supplier cost (warning)
- Prevent negative manual prices
- Handle missing manual price fields gracefully

**Edge Cases:**
- Quote date exactly today → treated as current (no manual pricing)
- Empty manual price fields → fall back to auto-filled
- Partial manual prices → allow independent supplier/retail entry
- Product lookup failure → manual entry still available

## Performance Considerations

**Database Impact:**
- Additional columns add minimal storage overhead
- COALESCE operation has negligible performance impact
- Indexes remain unchanged

**Frontend Performance:**
- Date comparison is client-side, negligible impact
- Additional state management for price tracking
- No significant rendering overhead

## Security Considerations

**Access Control:**
- Manual pricing available to all users (per requirements)
- No special permissions required
- Audit trail maintained via `price_manually_overridden` flag

**Data Integrity:**
- Manual prices stored alongside auto-filled prices
- Clear distinction between manual and auto-filled data
- Prevents accidental overwriting of historical data

## Mobile Optimization

**Touch Targets:**
- All price input fields maintain 44px minimum height
- Editable fields have clear tap targets
- Manual pricing badge clearly visible on mobile

**Responsive Design:**
- Price fields stack vertically on mobile
- Manual pricing indicators visible at all screen sizes
- Comparison view adapts to mobile layout

## Success Criteria

1. ✅ Past-dated quotes show editable price fields
2. ✅ Current-dated quotes maintain read-only prices
3. ✅ Both supplier cost and retail price independently editable
4. ✅ Manual prices stored and tracked correctly
5. ✅ Dashboard uses manual prices for accurate income tracking
6. ✅ Clear visual distinction between manual and auto-filled prices
7. ✅ All tests pass (unit, integration, E2E)
8. ✅ Mobile experience remains optimal
9. ✅ No regression in existing quote creation workflow

## Future Enhancements (Out of Scope)

- Historical pricing database with auto-detection
- Bulk price updates for multiple windows
- Price change notifications
- Historical pricing analytics
- Price approval workflows

## Implementation Notes

**Technical Stack:**
- Next.js frontend with TypeScript
- PostgreSQL database
- Existing quote management system

**Dependencies:**
- Existing QuoteForm component
- Existing quote API endpoints
- Existing dashboard queries
- No new external dependencies required

**Migration Strategy:**
- Forward-only approach (no existing quote migration needed)
- Schema changes are additive (no breaking changes)
- Existing functionality preserved
- Progressive enhancement for past-dated quotes