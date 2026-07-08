# Product Lookup Improvements Design

**Date:** 2026-07-08
**Component:** QuoteWizard - MeasurementsStep
**Goal:** Enhance product lookup UX with loading states, better product display, and autocomplete fallback

## Problem Statement

The current product lookup system in the MeasurementsStep has several UX limitations:
1. **No loading state prevention** - Users can modify other fields during lookup, potentially causing state inconsistencies
2. **Limited product information display** - Only product description shown on successful lookup
3. **No fallback for product lookup** - Users who don't know product codes have no alternative way to search

## Design Overview

### 1. Loading State Enhancement
- Keep existing loading indicator ("Looking up product...")
- Add visual loading state on input field (spinner/border)
- Allow continued editing of other fields during lookup
- Show visual feedback when lookup completes (success/error)

### 2. Product Information Display
Enhance product details section to show:
- **Collection name** (prominent display)
- **Unit type** (in/cm)
- **Basic specs** from product data
- Keep existing description and pricing info
- Organize in clearer visual hierarchy

### 3. Product Code Autocomplete
- Add dropdown suggestions as user types
- Filter by product code prefixes
- Show collection name alongside suggestions
- Debounce API calls (300ms delay)
- Allow keyboard navigation (arrow keys + enter)
- Click to select suggestion

### 4. API Considerations
- Reuse existing `/api/products/lookup` endpoint
- Add new `/api/products/autocomplete` endpoint
- Minimal database query optimization
- Proper error handling and loading states

## Component Design

### 1. Enhanced ProductCodeInput Component
```
- Wraps the existing product code input
- Manages autocomplete state (suggestions, loading, selection)
- Debounces input changes (300ms)
- Renders autocomplete dropdown
- Handles keyboard navigation (arrows, enter, escape)
- Provides visual feedback (loading spinner, success/error states)
```

### 2. ProductDetails Display Enhancement
```
- Reorganizes existing product details section
- Shows: Collection name (prominent), Unit type, Specs, Description, Pricing
- Better visual hierarchy with clear sections
- Shows loading skeleton during product lookup
- Displays error state when lookup fails
```

### 3. API Layer
```
- Existing /api/products/lookup (code based)
- New /api/products/autocomplete endpoint:
  * Query param: ?q=partial_code
  * Returns: Array of {code, collection, description}
  * Limited to 10 results
  * Filters by active products for user's company
```

### 4. State Management
```
- Add autocompleteSuggestions state
- Add isAutocompleteLoading state
- Existing lookupStatus state works well
- No complex state management needed (React useState sufficient)
```

### 5. Error Handling
```
- Network failures: Show error message, allow retry
- No results found: Clear message, keep fallback to autocomplete
- API errors: Graceful degradation, maintain existing functionality
```

## Data Flow & Interaction Design

### User Flow 1: Autocomplete Selection
1. User types in product code field (e.g., "P5")
2. After 300ms debounce → API call to `/api/products/autocomplete?q=P5`
3. Loading indicator appears in dropdown
4. Results render: ["P5012 - Collection Name", "P5013 - Collection Name", ...]
5. User selects suggestion OR continues typing
6. On selection: Auto-fill product code → Trigger existing lookup flow

### User Flow 2: Direct Code Entry (Existing)
1. User types full product code
2. onBlur event → API call to `/api/products/lookup?code=P5012`
3. Loading state on input field (spinner)
4. Other fields remain editable during lookup
5. Success → Enhanced product details display (collection, unit, specs)
6. Error → "Product not found" + clear next steps

### Data Flow
```
User Input
  → debounce/input handler
  → API call (autocomplete or lookup)
  → response parsing
  → state update (row data + UI state)
  → re-render with enhanced display
```

### Loading States
- **Autocomplete**: Small spinner in dropdown
- **Lookup**: Border spinner on input field + "Looking up..." text
- **Both**: Non-blocking, user can continue editing other fields

### Error Recovery
- Autocomplete fails: Hide dropdown, show error icon
- Lookup fails: Clear error message, highlight input field, suggest using autocomplete
- Network error: Retry mechanism, timeout after 5 seconds

## Implementation Details

### File Changes
```
Modified: src/components/wizard/MeasurementsStep.tsx
  - Add autocomplete state management
  - Enhance product display section
  - Add loading indicators
  - Implement debouncing

New: src/app/api/products/autocomplete/route.ts
  - Query parameter: ?q=partial_code
  - Returns: [{code, collection, description}, ...]
  - Limit: 10 results
  - Filter by company_id and active=true
```

### Technical Specifications

#### Debounce Implementation
```javascript
const debouncedAutocomplete = useMemo(
  () => debounce(async (query: string) => {
    // API call logic
  }, 300),
  []
);
```

#### Enhanced Product Display
```tsx
<div className="product-details">
  <div className="collection-section">
    <span className="collection-name">{product_collection}</span>
    <span className="unit-type">{unit}</span>
  </div>
  <div className="specs">
    {product_description}
  </div>
  <div className="pricing">
    Retail: ${retail_price_sqft}/sq.ft
  </div>
</div>
```

#### Autocomplete Component
- Position absolute below input field
- z-index: 50
- Max-height: 200px with overflow-y: auto
- Keyboard navigation: arrow keys, enter, escape
- Click outside to dismiss

### API Performance
- Autocomplete queries indexed on product.code
- Lookup queries already optimized
- Response time target: <200ms

### Testing Strategy
- Unit tests for debounce function
- Integration tests for autocomplete API
- Manual testing for keyboard navigation
- Error handling tests for network failures

## Success Criteria
1. ✅ Loading indicators provide clear feedback without blocking interactions
2. ✅ Product information display shows collection, unit type, and specs clearly
3. ✅ Autocomplete provides efficient fallback for users who don't know codes
4. ✅ API performance remains under 200ms for both endpoints
5. ✅ Error handling provides clear next steps to users
6. ✅ Keyboard navigation works smoothly for power users
7. ✅ Build completes without errors
8. ✅ Changes successfully deployed to production