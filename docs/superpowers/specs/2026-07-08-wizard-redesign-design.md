# Wizard Redesign Design Specification

**Date:** 2026-07-08
**Project:** Concetto Window Coverings - Quote Wizard Enhancement
**Status:** Approved Design

## Overview

Redesign the new order wizard to improve user experience by consolidating steps and implementing responsive layout. The product code lookup will be moved from step 3 to step 2, and steps 3 and 4 will be merged into a single review step.

## Current Architecture

**Existing Wizard Flow (4 steps):**
1. CustomerStep - Customer information entry
2. MeasurementsStep - Window measurements only
3. ProductsStep - Product selection + pricing + service charges
4. ReviewStep - Final review before submission

## New Architecture

**Enhanced Wizard Flow (3 steps):**
1. **CustomerStep** - Customer information entry (unchanged)
2. **MeasurementsStep** - Window measurements + Product code lookup (enhanced)
3. **ReviewStep** - Combined review + pricing + service charges (expanded)

## Component Changes

### QuoteWizard.tsx
**Changes:**
- Update `STEP_ORDER` from 4 steps to 3 steps: `['customer', 'measurements', 'review']`
- Update `STEP_LABELS` to reflect new step names
- Remove `ProductsStep` from imports and `STEP_COMPONENTS` mapping
- Adjust navigation logic for 3-step flow
- Update progress indicator to show 3 steps instead of 4

**Data Structure:**
```typescript
type WizardStep = 'customer' | 'measurements' | 'review';

const STEP_ORDER: WizardStep[] = ['customer', 'measurements', 'review'];

const STEP_LABELS: Record<WizardStep, string> = {
  customer: 'Customer',
  measurements: 'Measurements & Products',
  review: 'Review & Pricing',
};
```

### MeasurementsStep.tsx
**Enhancements:**
- Add product code input field to each window row
- Implement product lookup API call (reuse `/api/products/lookup`)
- Display minimal product info after lookup (description + collection only)
- Hide supplier costs and pricing details (no retail/supplier amounts)
- Implement responsive layout:
  - **Mobile (< 768px)**: Single column, stacked fields
  - **Desktop (≥ 768px)**: Side-by-side layout (measurements | product selection)

**Responsive Layout Structure:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Left: Measurements */}
  <div>Location, Unit, Type, Width, Drop fields</div>
  {/* Right: Product Selection */}
  <div>Product Code input + lookup results</div>
</div>
```

**Product Lookup Logic:**
```typescript
const lookupCode = async (index: number, code: string) => {
  if (!code.trim()) return;
  
  const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`);
  if (res.ok) {
    const product = await res.json();
    // Update item with product details, but don't show pricing
    updateItem(index, {
      product_id: product.id,
      product_code: product.code,
      product_collection: product.collection,
      product_description: product.description,
    });
  }
};
```

**Mobile Layout:**
```
┌─────────────────────────────────┐
│ Window #1        [🗑️ Remove]    │
├─────────────────────────────────┤
│ Location: [Living Room________]│
│ Unit: [inches ▼] Type: [fixed▼]│
│ Width: [24.0]    Drop: [36.0]   │
│ Product Code: [P5012___________]│
│ ✓ Cellular Shade               │
├─────────────────────────────────┤
│ Results:                        │
│ Final: 24" × 36"  Area: 6.00...│
└─────────────────────────────────┘
```

**Desktop Layout:**
```
┌───────────────────────────────────────────────────────────┐
│ Window #1                          [🗑️ Remove]           │
├───────────────────┬───────────────────────────────────────┤
│ Measurements      │  Product Selection                     │
│ ┌───────────────┐│  ┌─────────────────────────────────────┐│
│ Location: [__] ││  Product Code: [P5012____________]      ││
│ Unit: [inches▼]││  ✓ Cellular Shade                      ││
│ Width: [24.0]  ││                                         ││
│ Drop: [36.0]   ││  └─────────────────────────────────────┘│
└────────────────┘│                                         │
├───────────────────┴───────────────────────────────────────┤
│ Results: 24" × 36"  Area: 6.00 sq.ft.                     │
└───────────────────────────────────────────────────────────┘
```

### ReviewStep.tsx
**Expansion:**
- Include service charges section (installation + delivery fee inputs)
- Add full quote summary with customer info, window items, and pricing
- Hide supplier costs from display (show only retail amounts to end user)
- Combine functionality from ProductsStep + existing ReviewStep

**New Sections:**
```jsx
<div className="space-y-4">
  {/* Customer Information Summary */}
  <CustomerInfoSection />
  
  {/* Window Items with Full Product Details */}
  <WindowItemsSection />
  
  {/* Service Charges Input */}
  <ServiceChargesSection />
  
  {/* Final Pricing Summary */}
  <PricingSummarySection />
  
  {/* Submit Confirmation */}
  <SubmitConfirmation />
</div>
```

**Service Charges Section:**
```jsx
<div className="border border-gray-200 rounded-xl p-4 bg-white">
  <h4 className="text-sm font-medium text-gray-700 mb-3">Service Charges</h4>
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label>Installation Fee (₱)</label>
      <input type="number" value={installation} onChange={...} />
    </div>
    <div>
      <label>Delivery Fee (₱)</label>
      <input type="number" value={delivery} onChange={...} />
    </div>
  </div>
</div>
```

### ProductsStep.tsx
**Action:** Remove this file entirely (functionality merged into other steps)

## Data Flow

**Wizard Context Structure:**
```typescript
interface WizardContextType {
  currentStep: WizardStep;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  setStepData: (step: WizardStep, data: unknown) => void;
  getStepData: (step: WizardStep) => unknown;
}
```

**Step Data Structures:**
```typescript
// Customer Step Data
interface CustomerData {
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string;
  status: string;
}

// Measurements Step Data (enhanced)
interface MeasurementData {
  items: QuoteItem[];  // Now includes product_id, product_code, etc.
}

// Review Step Data (combined)
interface ReviewData {
  customer: CustomerData;      // From step 1
  items: QuoteItem[];           // From step 2 (with products)
  installation_fee: number;     // Service charges
  delivery_fee: number;         // Service charges
}
```

**Data Flow Sequence:**
1. **CustomerStep** → Saves customer data to wizard context via `setStepData('customer', data)`
2. **MeasurementsStep** → Saves measurements + product lookup results via `setStepData('measurements', data)`
3. **ReviewStep** → Reads all data via `getStepData()`, adds service charges, prepares final submission

## Implementation Approach

### Phase 1: QuoteWizard Updates
- Update `STEP_ORDER` array to 3 steps
- Modify `STEP_LABELS` for new step names
- Remove `ProductsStep` imports and references
- Adjust navigation logic and progress indicator
- Update `getStepProps()` method for new step structure

### Phase 2: MeasurementsStep Enhancement
- Add product code input field to window rows
- Implement product lookup functionality
- Add product description display after lookup
- Implement responsive layout with CSS grid
- Ensure supplier costs remain hidden
- Update validation to require valid product lookup

### Phase 3: ReviewStep Expansion
- Merge ProductsStep service charges functionality
- Add customer information summary section
- Combine window items display with full product details
- Implement service charges input section
- Add final pricing summary (retail only)
- Ensure supplier costs remain hidden

### Phase 4: Cleanup
- Remove `ProductsStep.tsx` file
- Update all imports and references
- Remove unused CSS classes and utilities

## Error Handling & Edge Cases

### Product Lookup Scenarios
- **Product not found**: Display error message "Product code not found", allow retry
- **API failure**: Show "Unable to lookup product" error, enable manual retry
- **Empty product code**: Skip lookup (no error triggered)
- **Duplicate lookups**: Allow re-lookup if user changes product code

### Validation Rules
- **CustomerStep**: All required fields must be populated (existing validation)
- **MeasurementsStep**: At least one window with measurements AND valid product lookup
- **ReviewStep**: Always valid if previous steps completed successfully

### Data Protection
- **Supplier costs**: Never displayed in MeasurementsStep or ReviewStep UI
- **Product lookup API**: Returns full data but UI filters out supplier costs
- **Database storage**: Continues to store supplier costs for internal use

### Navigation Edge Cases
- **User goes back and changes measurements**: Re-calculate area, preserve product if still valid
- **User changes product code**: Re-lookup new product, update calculations
- **Multiple windows with same product**: Each lookup independent
- **Wizard navigation**: Maintain existing back/forward functionality

## Testing Strategy

### Manual Testing Checklist

#### Mobile Testing (< 768px)
- [ ] Verify stacked layout for measurements + product lookup
- [ ] Test product code input and lookup functionality
- [ ] Check navigation between steps on mobile
- [ ] Verify touch targets and form usability

#### Desktop Testing (≥ 768px)
- [ ] Test side-by-side layout responsiveness
- [ ] Verify visual hierarchy and spacing
- [ ] Check service charges input in review step
- [ ] Test breakpoint transitions

#### Wizard Flow Testing
- [ ] Complete full quote from start to submission
- [ ] Test navigation (back/forward) between all steps
- [ ] Verify data persistence across step changes
- [ ] Test validation at each step

#### Product Lookup Testing
- [ ] Valid product codes (successful lookup)
- [ ] Invalid product codes (error handling)
- [ ] Empty product codes (no lookup triggered)
- [ ] Re-lookup scenarios (changing product codes)

#### Pricing Validation
- [ ] Verify supplier costs hidden in UI
- [ ] Check retail pricing calculations
- [ ] Test service charge impact on final total
- [ ] Verify total calculation accuracy

### Build Verification
- [ ] Run `npm run build` with no errors
- [ ] Check for TypeScript compilation errors
- [ ] Verify no console warnings in browser
- [ ] Test production build locally

## Technical Specifications

### Responsive CSS Classes
```jsx
// Responsive grid layout
className="grid grid-cols-1 md:grid-cols-2 gap-4"

// Mobile-first approach with breakpoints:
// sm: 640px, md: 768px, lg: 1024px, xl: 1280px
```

### API Integration
- **Product Lookup Endpoint**: `/api/products/lookup?code={product_code}`
- **Method**: GET request on blur event
- **Response**: Product object with id, code, collection, description, retail_price, supplier_cost
- **Error Handling**: Try-catch with user feedback

### TypeScript Types
```typescript
// QuoteItem structure (existing)
interface QuoteItem {
  id: string;
  quote_id: string;
  sort_order: number;
  location: string;
  product_id: string | null;
  product_code: string;
  product_collection: string;
  product_description: string;
  unit: MeasureUnit;
  is_fixed: boolean;
  measured_width: number;
  measured_drop: number;
  final_width: number;
  final_drop: number;
  area_sqft: number;
  retail_price_sqft: number;
  supplier_cost_sqft: number;
  retail_amount: number;
  supplier_amount: number;
}
```

## Success Criteria

### User Experience
- ✅ Wizard reduced from 4 steps to 3 steps
- ✅ Product lookup available in measurements step
- ✅ Responsive layout works on mobile and desktop
- ✅ Supplier costs hidden from end-user display
- ✅ Service charges integrated into review step

### Functionality
- ✅ Product lookup works correctly for valid codes
- ✅ Error handling for invalid product codes
- ✅ Complete wizard flow from start to submission
- ✅ Data persistence across step navigation
- ✅ Validation prevents incomplete submissions

### Technical
- ✅ No TypeScript compilation errors
- ✅ Build succeeds without warnings
- ✅ Existing functionality preserved
- ✅ Code follows existing patterns and conventions

## Timeline

- **Design & Specification**: Complete (2026-07-08)
- **Implementation**: ~2-3 hours
- **Testing & Validation**: ~1 hour
- **Total Estimated Time**: 3-4 hours

## Notes

- This is a minimal change approach that preserves existing functionality while improving UX
- Product lookup API already exists and will be reused
- Responsive design uses existing Tailwind CSS breakpoints
- No database schema changes required
- Existing validation patterns will be maintained