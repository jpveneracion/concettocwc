# Wizard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the quote wizard from 4 steps to 3 steps by moving product lookup to the measurements step and merging service charges into the review step.

**Architecture:** Update QuoteWizard to use 3-step flow, enhance MeasurementsStep with responsive product lookup, expand ReviewStep to include service charges, and remove ProductsStep.

**Tech Stack:** React, TypeScript, Tailwind CSS, Next.js

---

## File Structure

**Modified Files:**
- `src/components/QuoteWizard.tsx` - Update wizard step structure from 4 to 3 steps
- `src/components/wizard/MeasurementsStep.tsx` - Add product lookup + responsive layout
- `src/components/wizard/ReviewStep.tsx` - Merge service charges + full review functionality

**Removed Files:**
- `src/components/wizard/ProductsStep.tsx` - Functionality merged into other steps

**Key Changes:**
- Wizard step array reduced from 4 to 3 steps
- Product lookup moved from ProductsStep to MeasurementsStep
- Service charges moved from ProductsStep to ReviewStep
- Responsive layout using CSS grid with Tailwind breakpoints

---

### Task 1: Update QuoteWizard Step Structure

**Files:**
- Modify: `src/components/QuoteWizard.tsx:10-51`

- [ ] **Step 1: Update WizardStep type and STEP_ORDER**

```typescript
// Change from 4 steps to 3 steps
type WizardStep = 'customer' | 'measurements' | 'review';

// Update the step order array
const STEP_ORDER: WizardStep[] = ['customer', 'measurements', 'review'];

// Update step labels
const STEP_LABELS: Record<WizardStep, string> = {
  customer: 'Customer',
  measurements: 'Measurements & Products',
  review: 'Review & Pricing',
};
```

- [ ] **Step 2: Remove ProductsStep imports and component mapping**

```typescript
// Remove this import (line 34)
// import ProductsStep from './wizard/ProductsStep';

// Update STEP_COMPONENTS mapping (lines 37-42)
const STEP_COMPONENTS: Record<WizardStep, React.ComponentType<any>> = {
  customer: CustomerStep,
  measurements: MeasurementsStep,
  review: ReviewStep,
  // Remove: products: ProductsStep,
};
```

- [ ] **Step 3: Update initial state and getStepProps method**

```typescript
// Update stepData state initialization (lines 55-60)
const [stepData, setStepDataState] = useState<Record<WizardStep, unknown>>({
  customer: null,
  measurements: null,
  review: null,  // Changed from 'products' to 'review'
  // Remove: products: null,
});

// Update getStepProps method (lines 110-136)
const getStepProps = (): any => {
  switch (currentStep) {
    case 'customer':
      return {
        quoteNumber,
        existingData: existingData ? {
          customer_name: existingData.customer_name,
          customer_address: existingData.customer_address,
          quote_date: existingData.quote_date,
          our_ref: existingData.our_ref,
          status: existingData.status,
        } : undefined,
      };
    case 'measurements':
      return {
        existingData: stepData.measurements as any,
      };
    case 'review':  // Changed from 'products' and 'review' cases
      return {
        existingData: stepData.review as any,
      };
    default:
      return {};
  }
};
```

- [ ] **Step 4: Test wizard loads without errors**

Open: `http://localhost:3000/quotes/new`
Expected: Page loads successfully, no console errors, wizard shows 3 steps in progress indicator

- [ ] **Step 5: Commit changes**

```bash
git add src/components/QuoteWizard.tsx
git commit -m "refactor: update wizard structure from 4 to 3 steps

- Update WizardStep type to remove 'products' step
- Modify STEP_ORDER array for 3-step flow
- Update STEP_LABELS for new step names
- Remove ProductsStep imports and component mapping
- Adjust getStepProps for new structure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Add Product Lookup to MeasurementsStep

**Files:**
- Modify: `src/components/wizard/MeasurementsStep.tsx:17-38`

- [ ] **Step 1: Add product lookup state and types**

```typescript
// Add these interfaces after line 7
interface ProductLookupResult {
  id: string;
  code: string;
  collection: string;
  description: string;
  retail_price: number;
  supplier_cost: number;
}

interface LookupStatus {
  [key: string]: 'loading' | 'found' | 'notfound' | '';
}
```

- [ ] **Step 2: Update ItemRow type to include product fields**

```typescript
// Update the newRow function (lines 17-38) to ensure product fields exist
function newRow(order: number): ItemRow {
  return {
    _key: crypto.randomUUID(),
    sort_order: order,
    location: '',
    product_id: null,
    product_code: '',
    product_collection: '',
    product_description: '',
    unit: 'in' as MeasureUnit,
    is_fixed: true,
    measured_width: 0,
    measured_drop: 0,
    final_width: 0,
    final_drop: 0,
    area_sqft: 0,
    retail_price_sqft: 0,
    supplier_cost_sqft: 0,
    retail_amount: 0,
    supplier_amount: 0,
  };
}
```

- [ ] **Step 3: Add product lookup state in component**

```typescript
// Add after line 72 (after [errors, setErrors])
const [lookupStatus, setLookupStatus] = useState<LookupStatus>({});
```

- [ ] **Step 4: Implement product lookup function**

```typescript
// Add this function after the removeRow function (after line 120)
const lookupCode = async (key: string, code: string) => {
  if (!code.trim()) return;

  setLookupStatus((prev) => ({ ...prev, [key]: 'loading' }));

  try {
    const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      const product = await res.json();

      // Find the row index
      const rowIndex = rows.findIndex((r) => r._key === key);
      if (rowIndex !== -1) {
        updateRow(key, {
          product_id: product.id,
          product_code: product.code,
          product_collection: product.collection,
          product_description: product.description,
          retail_price_sqft: product.retail_price,
          supplier_cost_sqft: product.supplier_cost,
          retail_amount: rows[rowIndex].area_sqft * product.retail_price,
          supplier_amount: rows[rowIndex].area_sqft * product.supplier_cost,
        });
      }

      setLookupStatus((prev) => ({ ...prev, [key]: 'found' }));
    } else {
      setLookupStatus((prev) => ({ ...prev, [key]: 'notfound' }));
    }
  } catch (error) {
    console.error('Product lookup failed:', error);
    setLookupStatus((prev) => ({ ...prev, [key]: 'notfound' }));
  }
};
```

- [ ] **Step 5: Add product code input to window rows**

```typescript
// Add this section after the "Drop" input field (around line 208)
{/* Product Code */}
<div>
  <label className="block text-sm text-gray-600 mb-1">Product Code</label>
  <input
    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
    value={row.product_code}
    onChange={(e) => {
      updateRow(row._key, { product_code: e.target.value.toUpperCase() });
      setLookupStatus((prev) => ({ ...prev, [row._key]: '' }));
    }}
    onBlur={(e) => lookupCode(row._key, e.target.value)}
    placeholder="e.g. P5012"
  />
  {lookupStatus[row._key] === 'found' && (
    <p className="text-xs text-green-600 mt-1">✓ {row.product_description}</p>
  )}
  {lookupStatus[row._key] === 'notfound' && (
    <p className="text-xs text-red-500 mt-1">Product code not found</p>
  )}
  {lookupStatus[row._key] === 'loading' && (
    <p className="text-xs text-gray-400 mt-1">Looking up product...</p>
  )}
</div>
```

- [ ] **Step 6: Update validation to require product lookup**

```typescript
// Update the validate function (lines 85-94)
function validate(): boolean {
  const newErrors: Record<string, string> = {};

  // Check for at least one window with measurements AND product
  const validWindows = rows.filter((r) => r.area_sqft > 0 && r.product_id);
  if (validWindows.length === 0) {
    newErrors.items = 'Add at least one window with measurements and a valid product code';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}
```

- [ ] **Step 7: Test product lookup functionality**

Open: `http://localhost:3000/quotes/new`
Expected: Product code input appears in measurement rows, lookup triggers on blur, shows success/error messages

- [ ] **Step 8: Commit changes**

```bash
git add src/components/wizard/MeasurementsStep.tsx
git commit -m "feat: add product lookup to measurements step

- Add product lookup state and status tracking
- Implement lookupCode function with API integration
- Add product code input field to window rows
- Update validation to require valid product lookup
- Display lookup status messages (success/error/loading)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Implement Responsive Layout in MeasurementsStep

**Files:**
- Modify: `src/components/wizard/MeasurementsStep.tsx:130-230`

- [ ] **Step 1: Restructure window row layout for responsive design**

```typescript
// Replace the existing grid layout (lines 144-228) with responsive structure
{/* Mobile: Single column, Desktop: Side-by-side */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Left Column: Measurements */}
  <div className="space-y-3">
    <div>
      <label className="block text-sm text-gray-600 mb-1">Location</label>
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        value={row.location}
        onChange={(e) => updateRow(row._key, { location: e.target.value })}
        placeholder="e.g. Living Room"
      />
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Unit</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={row.unit}
          onChange={(e) => updateRow(row._key, { unit: e.target.value as MeasureUnit })}
        >
          <option value="in">Inches</option>
          <option value="cm">Centimeters</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Type</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={row.is_fixed ? 'yes' : 'no'}
          onChange={(e) => updateRow(row._key, { is_fixed: e.target.value === 'yes' })}
        >
          <option value="yes">Fixed (as-is)</option>
          <option value="no">Non-fixed (+{row.unit === 'cm' ? '15cm' : '6in'} overlap)</option>
        </select>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Width ({row.unit})</label>
        <input
          type="number"
          min="0"
          step="0.1"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={row.measured_width || ''}
          onChange={(e) => updateRow(row._key, { measured_width: parseFloat(e.target.value) || 0 })}
          placeholder="0.0"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Drop ({row.unit})</label>
        <input
          type="number"
          min="0"
          step="0.1"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={row.measured_drop || ''}
          onChange={(e) => updateRow(row._key, { measured_drop: parseFloat(e.target.value) || 0 })}
          placeholder="0.0"
        />
      </div>
    </div>
  </div>

  {/* Right Column: Product Selection */}
  <div className="space-y-3">
    <div>
      <label className="block text-sm text-gray-600 mb-1">Product Code</label>
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
        value={row.product_code}
        onChange={(e) => {
          updateRow(row._key, { product_code: e.target.value.toUpperCase() });
          setLookupStatus((prev) => ({ ...prev, [row._key]: '' }));
        }}
        onBlur={(e) => lookupCode(row._key, e.target.value)}
        placeholder="e.g. P5012"
      />
      {lookupStatus[row._key] === 'found' && (
        <p className="text-xs text-green-600 mt-1">✓ {row.product_description}</p>
      )}
      {lookupStatus[row._key] === 'notfound' && (
        <p className="text-xs text-red-500 mt-1">Product code not found</p>
      )}
      {lookupStatus[row._key] === 'loading' && (
        <p className="text-xs text-gray-400 mt-1">Looking up product...</p>
      )}
    </div>

    {/* Product Details (minimal display) */}
    {row.product_id && (
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500">Collection</p>
            <p className="text-sm text-gray-700">{row.product_collection || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Description</p>
            <p className="text-sm text-gray-700">{row.product_description || '-'}</p>
          </div>
        </div>
      </div>
    )}
  </div>
</div>

{/* Results display */}
<div className="bg-gray-50 rounded-lg p-3">
  <div className="grid grid-cols-2 gap-2">
    <div>
      <p className="text-xs text-gray-500">Final Width ({row.unit})</p>
      <p className="text-sm font-medium text-blue-700">{row.final_width.toFixed(1)}</p>
    </div>
    <div>
      <p className="text-xs text-gray-500">Final Drop ({row.unit})</p>
      <p className="text-sm font-medium text-blue-700">{row.final_drop.toFixed(1)}</p>
    </div>
    <div>
      <p className="text-xs text-gray-500">Area (sq.ft.)</p>
      <p className="text-sm font-medium">{row.area_sqft.toFixed(2)}</p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Test responsive layout on different screen sizes**

Open: `http://localhost:3000/quotes/new`
Resize browser window:
- Mobile (< 768px): Fields stack vertically in single column
- Desktop (≥ 768px): Measurements and product selection side-by-side

- [ ] **Step 3: Commit responsive layout changes**

```bash
git add src/components/wizard/MeasurementsStep.tsx
git commit -m "feat: implement responsive layout in measurements step

- Restructure window rows with CSS grid for responsive design
- Mobile: Single column stacked layout
- Desktop: Side-by-side measurements and product selection
- Add visual grouping with background sections
- Maintain all existing functionality with improved UX

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Expand ReviewStep with Service Charges

**Files:**
- Modify: `src/components/wizard/ReviewStep.tsx:1-189`

- [ ] **Step 1: Add service charges state and types**

```typescript
// Update interface after line 19
interface ReviewData {
  customer: CustomerData;
  items: QuoteItem[];
  installation_fee: number;
  delivery_fee: number;
}

// Add state in component (after line 21)
const [installation, setInstallation] = useState(0);
const [delivery, setDelivery] = useState(0);
```

- [ ] **Step 2: Update data retrieval logic**

```typescript
// Replace the existing data retrieval (lines 24-32)
const customerData = getStepData('customer') as CustomerData | undefined;
const measurementsData = getStepData('measurements') as { items: QuoteItem[] } | undefined;

const [items, setItems] = useState<QuoteItem[]>(
  measurementsData?.items?.map((item, index) => ({
    ...item,
    id: '',
    quote_id: '',
    sort_order: index,
  })) || []
);

// Update total calculations to use local state
const validItems = items.filter((item) => item.area_sqft > 0);
const totalArea = validItems.reduce((sum, item) => sum + item.area_sqft, 0);
const subtotal = validItems.reduce((sum, item) => sum + item.retail_amount, 0);
const total = subtotal + installation + delivery;
```

- [ ] **Step 3: Add service charges section**

```typescript
// Add this section after the Window Items section (before line 130)
{/* Service Charges */}
{validItems.length > 0 && (
  <div className="border border-gray-200 rounded-xl p-4 bg-white">
    <h4 className="text-sm font-medium text-gray-700 mb-3">Service Charges</h4>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Installation Fee (₱)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={installation || ''}
          onChange={(e) => setInstallation(parseFloat(e.target.value) || 0)}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Delivery Fee (₱)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={delivery || ''}
          onChange={(e) => setDelivery(parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Update financial summary to include service charges**

```typescript
// Replace the existing Financial Summary section (lines 131-157)
{/* Financial Summary */}
{validItems.length > 0 && (
  <div className="border border-gray-200 rounded-xl p-4 bg-white">
    <h4 className="text-sm font-medium text-gray-700 mb-3">Financial Summary</h4>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Total Area:</span>
        <span className="text-sm font-medium">{totalArea.toFixed(2)} sq.ft.</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Subtotal:</span>
        <span className="text-sm font-medium">₱{subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Installation Fee:</span>
        <span className="text-sm font-medium">₱{installation.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Delivery Fee:</span>
        <span className="text-sm font-medium">₱{delivery.toFixed(2)}</span>
      </div>
      <div className="border-t border-gray-200 pt-2 mt-2">
        <div className="flex justify-between">
          <span className="text-base font-semibold text-gray-800">Total:</span>
          <span className="text-lg font-bold text-blue-700">₱{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Ensure supplier costs are hidden from display**

```typescript
// In the Window Items section, ensure only retail amounts are shown
// The existing code already shows only retail_amount (line 121), which is correct
<span className="text-gray-600">Retail Amount:</span>
<span className="ml-2 font-medium text-blue-700">{phpFormat(item.retail_amount)}</span>
// Do NOT display supplier_amount or supplier_cost_sqft
```

- [ ] **Step 6: Update data preparation for submission**

```typescript
// Add useEffect to prepare final data for submission
useEffect(() => {
  const reviewData: ReviewData = {
    customer: customerData!,
    items: items.map((item) => ({
      ...item,
      id: '',
      quote_id: '',
    })),
    installation_fee: installation,
    delivery_fee: delivery,
  };
  // This data will be available for the onComplete callback
  (window as any).__reviewStepData = reviewData;
}, [items, installation, delivery, customerData]);
```

- [ ] **Step 7: Test service charges functionality**

Open: `http://localhost:3000/quotes/new`
Navigate to review step:
- Service charges section appears with input fields
- Total updates correctly when service charges change
- Supplier costs are not displayed anywhere

- [ ] **Step 8: Commit ReviewStep expansion**

```bash
git add src/components/wizard/ReviewStep.tsx
git commit -m "feat: expand review step with service charges

- Add installation and delivery fee input fields
- Update financial summary to include service charges
- Ensure supplier costs remain hidden from display
- Add data preparation for final submission
- Maintain existing customer and item review functionality

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Update QuoteWizard Data Handling

**Files:**
- Modify: `src/components/QuoteWizard.tsx:98-101`

- [ ] **Step 1: Update final submission data preparation**

```typescript
// Update the onComplete call (lines 98-101) to prepare correct data structure
} else {
  // Prepare final submission data from all steps
  const finalData = {
    customer: stepData.customer,
    items: stepData.measurements?.items || [],
    installation_fee: stepData.review?.installation_fee || 0,
    delivery_fee: stepData.review?.delivery_fee || 0,
  };
  onComplete(finalData);
}
```

- [ ] **Step 2: Test complete wizard flow**

Open: `http://localhost:3000/quotes/new`
Complete full wizard:
1. Fill customer information → Next
2. Add measurements and product codes → Next
3. Review all information and add service charges → Submit
Expected: Wizard completes successfully with all data

- [ ] **Step 3: Commit data handling updates**

```bash
git add src/components/QuoteWizard.tsx
git commit -m "fix: update wizard submission data handling

- Prepare correct data structure for final submission
- Combine customer, measurements, and review step data
- Ensure service charges are included in final data
- Maintain backward compatibility with existing quote creation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Remove ProductsStep File

**Files:**
- Remove: `src/components/wizard/ProductsStep.tsx`

- [ ] **Step 1: Verify no remaining imports of ProductsStep**

```bash
# Search for any remaining references to ProductsStep
grep -r "ProductsStep" src/
```

Expected: No results (already removed in Task 1)

- [ ] **Step 2: Remove ProductsStep file**

```bash
rm src/components/wizard/ProductsStep.tsx
```

- [ ] **Step 3: Verify wizard still works without ProductsStep**

Open: `http://localhost:3000/quotes/new`
Expected: Wizard loads and functions normally without errors

- [ ] **Step 4: Commit file removal**

```bash
git add src/components/wizard/ProductsStep.tsx
git commit -m "refactor: remove ProductsStep component

- Remove ProductsStep.tsx file
- Functionality merged into MeasurementsStep and ReviewStep
- No remaining imports or references exist

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Manual Testing and Validation

**Files:**
- Test: Browser testing and validation

- [ ] **Step 1: Test complete wizard flow on mobile**

1. Open DevTools and set viewport to mobile (< 768px)
2. Navigate to `http://localhost:3000/quotes/new`
3. Complete customer step → Next
4. Add measurements and product codes (verify stacked layout) → Next
5. Review quote and add service charges → Submit
Expected: All steps work correctly on mobile layout

- [ ] **Step 2: Test complete wizard flow on desktop**

1. Open browser in desktop mode (≥ 768px)
2. Navigate to `http://localhost:3000/quotes/new`
3. Complete all steps
4. Verify side-by-side layout in measurements step
Expected: All steps work correctly on desktop layout

- [ ] **Step 3: Test product lookup error handling**

1. Start a new quote
2. In measurements step, enter invalid product code "INVALID123"
3. Tab away from input field
Expected: Error message "Product code not found" appears

- [ ] **Step 4: Test validation at each step**

1. Try to proceed from customer step without filling fields → Should be blocked
2. Try to proceed from measurements step without windows → Should be blocked
3. Try to proceed from measurements step without product lookup → Should be blocked
Expected: Validation prevents incomplete submissions

- [ ] **Step 5: Test navigation between steps**

1. Complete step 1 → Go to step 2 → Return to step 1 → Data should persist
2. Complete step 2 → Go to step 3 → Return to step 2 → Data should persist
Expected: All data persists across navigation

- [ ] **Step 6: Test service charges calculation**

1. Complete quote with items totaling ₱1000
2. Add installation fee ₱200 and delivery fee ₱100
3. Verify total shows ₱1300
Expected: Total calculation is correct

- [ ] **Step 7: Verify supplier costs are hidden**

1. Complete full quote flow
2. Check measurements step → No supplier costs shown
3. Check review step → No supplier costs shown
Expected: Supplier costs hidden throughout UI

---

### Task 8: Build Verification and Deployment

**Files:**
- Build: Production build verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: Build completes successfully with no errors or warnings

- [ ] **Step 2: Check for TypeScript errors**

Expected: No TypeScript compilation errors in build output

- [ ] **Step 3: Check build output size**

```bash
# Check build output directory
ls -lh .next/static/chunks/
```

Expected: Reasonable chunk sizes, no excessive bundles

- [ ] **Step 4: Test production build locally**

```bash
npm start
```

Open: `http://localhost:3000/quotes/new`
Complete full wizard flow in production mode
Expected: Everything works correctly in production build

- [ ] **Step 5: Create summary of changes**

```bash
# View recent commits
git log --oneline -10
```

Expected: Commits show logical progression of wizard redesign

- [ ] **Step 6: Push all changes to GitHub**

```bash
git push origin main
```

Expected: All commits push successfully

- [ ] **Step 7: Verify deployment**

Check deployment status (if automatic deployment is configured)
Expected: Application deploys successfully with new wizard design

---

## Success Criteria Checklist

**Functionality:**
- [ ] Wizard reduced from 4 steps to 3 steps
- [ ] Product lookup works in measurements step
- [ ] Responsive layout works on mobile and desktop
- [ ] Service charges integrated into review step
- [ ] Supplier costs hidden from UI

**Technical:**
- [ ] No TypeScript compilation errors
- [ ] Build succeeds without warnings
- [ ] All functionality tested manually
- [ ] Code follows existing patterns

**User Experience:**
- [ ] Complete wizard flow works end-to-end
- [ ] Validation prevents incomplete submissions
- [ ] Navigation between steps preserves data
- [ ] Error handling works for invalid product codes

---

## Post-Implementation Notes

After completing all tasks, the wizard should:
1. Provide a streamlined 3-step experience
2. Work responsively on mobile and desktop devices
3. Hide supplier costs from end-user display
4. Maintain all existing functionality with improved UX
5. Pass build verification and deployment tests

The implementation follows the minimal change approach while achieving all design requirements from the specification.