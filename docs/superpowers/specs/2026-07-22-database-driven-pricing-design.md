# Database-Driven Pricing Design

## Problem Statement

**Technical Debt**: Plan prices are hardcoded in `validate-promo-code/route.ts` (lines 82-86) instead of being database-driven.

```typescript
const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.MONTHLY]: 499,
  [SubscriptionPlan.QUARTERLY]: 499, 
  [SubscriptionPlan.ANNUAL]: 499,
};
```

**Impact**: Requires deployment for price changes, no admin interface for pricing management.

## Solution: Extend Existing Payment Settings Pattern

The system already has a proven pattern for managing per-billing-period configuration through the `payment_settings` table (QR codes for monthly/quarterly/annual). This design extends that same pattern to pricing.

### Architecture

**Current Pattern** (working well):
- `payment_settings` table stores `gcash_monthly_qr_url`, `gcash_quarterly_qr_url`, `gcash_annual_qr_url`
- `PaymentSettingsManager.tsx` provides mobile-first admin interface
- Database-driven configuration with instant effect

**Extended Pattern** (same approach):
- Add pricing columns to `payment_settings` table
- Extend admin interface for price management  
- Replace hardcoded prices with database fetch

## Implementation Design

### 1. Database Schema Extension

Add pricing columns to existing `payment_settings` table:

```sql
ALTER TABLE payment_settings 
ADD COLUMN monthly_base_price DECIMAL(10,2) DEFAULT 499.00,
ADD COLUMN quarterly_base_price DECIMAL(10,2) DEFAULT 1497.00,
ADD COLUMN annual_base_price DECIMAL(10,2) DEFAULT 4990.00;
```

**Rationale**: 
- Uses existing proven table structure
- Follows same naming convention as QR code columns
- Maintains data consistency (one row per payment method)
- Default values match current hardcoded prices

### 2. Service Layer Update

Update `validate-promo-code/route.ts` to replace hardcoded prices:

```typescript
// Replace hardcoded PLAN_PRICES with:
async function getPlanPrice(plan: SubscriptionPlan): Promise<number> {
  const priceColumn = plan === SubscriptionPlan.MONTHLY ? 'monthly_base_price' :
                      plan === SubscriptionPlan.QUARTERLY ? 'quarterly_base_price' : 
                      'annual_base_price';
  
  const result = await sql`
    SELECT ${sql(priceColumn)} as price
    FROM payment_settings
    WHERE payment_method = 'gcash' OR payment_method = 'gotyme'
    LIMIT 1
  `;
  
  return parseFloat(result[0]?.price) || 499;
}
```

**Rationale**:
- Follows existing database query patterns from `qr-service.ts`
- Maintains same error handling approach
- Returns fallback value if database fetch fails
- Type-safe with TypeScript

### 3. Admin Interface Extension

Extend `PaymentSettingsManager.tsx` to include price management:

**Component Structure**:
```typescript
// Add to each payment method card:
<div className="pricing-section">
  <h4>Base Pricing</h4>
  
  <div className="price-input-group">
    <label>Monthly Price (PHP)</label>
    <input 
      type="number"
      value={settings.mobile.gcash.monthlyPrice || 499}
      onChange={(e) => updatePrice('gcash', 'monthly', e.target.value)}
      className="mobile-friendly-input"
    />
  </div>
  
  {/* Repeat for quarterly and annual */}
</div>
```

**Mobile-First Design**:
- Large touch targets (min 44px height)
- Numeric input keyboards for mobile
- Clear labeling and grouping
- Visual feedback on save
- Same styling as existing QR code section

### 4. API Updates

Extend existing `/api/admin/payment-settings` endpoint:

```typescript
// POST /api/admin/payment-settings
// Handle both QR codes and pricing in same request
{
  mobile: {
    gcash: {
      // existing QR code fields
      qrCodeUrl: string,
      accountNumber: string,
      accountName: string,
      enabled: boolean,
      // new pricing fields
      monthlyPrice: number,
      quarterlyPrice: number,
      annualPrice: number
    }
    // same for gotyme
  }
}
```

**Rationale**:
- Single endpoint for all payment settings
- Atomic updates (QR codes + pricing together)
- Consistent with existing API patterns
- Reduces API surface area

## Data Flow

### Current Flow (broken):
```
Hardcoded prices → validate-promo-code → calculate discount → return amount
```

### Fixed Flow:
```
Admin updates prices → payment_settings table → validate-promo-code fetch → calculate discount → return amount
```

### Integration with Existing QR Code Flow:
```
1. User selects plan → gets base price from payment_settings
2. User applies promo code → calculates discount
3. System determines billing period by price → gets QR code from payment_settings  
4. User completes payment → uses plan-specific QR code
```

## Benefits

1. **No Deployments Required**: Price changes take effect immediately through admin interface
2. **Architectural Consistency**: Uses same proven pattern as QR code management
3. **Mobile-First Admin**: Touch-friendly interface following existing design patterns
4. **Database Source of Truth**: Single source for pricing, no code/release dependency
5. **Maintainable**: Easy to extend with future pricing features (regional, scheduled, etc.)

## Implementation Order

1. Database migration (5 min)
2. Update validate-promo-code/route.ts (15 min) 
3. Extend API endpoint (10 min)
4. Update admin interface (30 min)
5. Test end-to-end flow (15 min)

**Total Implementation Time**: ~75 minutes

## Files Changed

- `migrations/008_add_pricing_to_payment_settings.sql` (new)
- `src/app/api/validate-promo-code/route.ts` (update)
- `src/app/api/admin/payment-settings/route.ts` (update)
- `src/components/admin/PaymentSettingsManager.tsx` (update)

**Files Unchanged**: All other existing functionality remains intact.

## Future Extensibility

This design provides foundation for:
- Price change history/audit trail (separate table)
- Scheduled price changes (add effective_date columns)
- Regional pricing (add currency/region columns)  
- Promotional base pricing (add promo_overrides table)
- Advanced price rules (separate pricing_rules table)

All future features can be added without breaking this core implementation.