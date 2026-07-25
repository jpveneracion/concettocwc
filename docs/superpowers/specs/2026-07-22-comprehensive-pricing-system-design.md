# Comprehensive Pricing System Design

## Problem Statement

**Technical Debt**: Plan prices are hardcoded in `validate-promo-code/route.ts` (lines 82-86) instead of being database-driven.

```typescript
const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.MONTHLY]: 499,
  [SubscriptionPlan.QUARTERLY]: 499, 
  [SubscriptionPlan.ANNUAL]: 499,
};
```

**Impact**: 
- Requires deployment for price changes
- No admin interface for pricing management
- Cannot support seasonal promotional adjustments
- No audit trail for pricing decisions
- Hardcoded thresholds in QR service

**Business Requirements**:
- Base rate: 499 PHP/month
- Quarterly: 499 × 3 months = 1,497 PHP (before period discount)
- Annual: 499 × 12 months = 5,988 PHP (before period discount)
- Period discounts stored in database (seasonal promotional adjustments)
- Promo codes applied on top of period-discounted prices
- Itemized breakdown displayed at checkout
- Mobile-first admin interface

## Solution: Comprehensive Pricing System

**Architecture**: Three-layer system with dedicated pricing configuration table, comprehensive service layer, and mobile-first admin interface.

### System Flow

```
Admin updates pricing → pricing_config table → pricing service → all pricing calculations
                              ↓
                        pricing_history (audit trail)
```

**Clean Separation Maintained**:
- `payment_settings` → Payment infrastructure (QR codes, account details) ✅
- `subscription_plans` → Product catalog (plan features, intervals) ✅
- `pricing_config` → Pricing calculations (base rates, discounts, thresholds) ✅

## Database Schema Design

### pricing_config Table

```sql
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Base pricing
  monthly_base_rate DECIMAL(10,2) NOT NULL DEFAULT 499.00,
  
  -- Period discounts (seasonal promo adjustments)
  quarterly_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  annual_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  
  -- Billing period thresholds (for QR service)
  monthly_threshold DECIMAL(10,2) NOT NULL DEFAULT 600.00,
  quarterly_threshold DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL means indefinitely valid
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  
  -- Change reason
  change_reason TEXT,
  
  CONSTRAINT valid_percentage CHECK (
    quarterly_discount_percent >= 0 AND quarterly_discount_percent <= 100 AND
    annual_discount_percent >= 0 AND annual_discount_percent <= 100
  ),
  CONSTRAINT positive_rate CHECK (monthly_base_rate > 0),
  CONSTRAINT logical_thresholds CHECK (monthly_threshold < quarterly_threshold)
);

COMMENT ON TABLE pricing_config IS 'Comprehensive pricing configuration with audit trail and seasonal adjustment support';
```

### pricing_history Table

```sql
CREATE TABLE pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References pricing config
  pricing_config_id UUID REFERENCES pricing_config(id),
  
  -- Change details
  change_type VARCHAR(20) NOT NULL, -- 'create', 'update', 'expire', 'reactivate'
  changed_field VARCHAR(50), -- specific field that changed
  old_value TEXT,
  new_value TEXT,
  
  -- Metadata
  change_reason TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Snapshot
  previous_config JSONB -- full previous config for rollback
);

COMMENT ON TABLE pricing_history IS 'Audit trail for pricing changes with rollback support';

-- Indexes for performance
CREATE INDEX idx_pricing_history_config ON pricing_history(pricing_config_id);
CREATE INDEX idx_pricing_history_date ON pricing_history(changed_at);
CREATE INDEX idx_pricing_config_active ON pricing_config(is_active, valid_from);
```

## Service Layer Design

### Core Service Interface (`lib/pricing-service.ts`)

```typescript
// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PricingConfig {
  id: string;
  monthly_base_rate: number;
  quarterly_discount_percent: number;
  annual_discount_percent: number;
  monthly_threshold: number;
  quarterly_threshold: number;
  is_active: boolean;
  valid_from: Date;
  valid_until?: Date;
}

interface PriceCalculationResult {
  // Step-by-step breakdown for checkout display
  base_price: number;
  period_months: number;
  base_total: number;
  period_discount_percent: number;
  period_discount_amount: number;
  price_after_period_discount: number;
  promo_discount_percent?: number;
  promo_discount_amount?: number;
  final_price: number;
  
  // Metadata
  billing_period: 'monthly' | 'quarterly' | 'annual';
  pricing_config_id: string;
  calculated_at: Date;
}

interface PricingHistoryEntry {
  id: string;
  change_type: 'create' | 'update' | 'expire' | 'reactivate';
  changed_field?: string;
  old_value?: string;
  new_value?: string;
  change_reason?: string;
  changed_by: string;
  changed_at: Date;
  previous_config?: any;
}

// ============================================================================
// CORE PRICING FUNCTIONS
// ============================================================================

/**
 * Get current active pricing configuration
 * Uses caching for performance, auto-invalidates on updates
 */
async function getCurrentPricing(): Promise<PricingConfig | null>

/**
 * Calculate final price with complete itemized breakdown
 * Returns detailed calculation for checkout display
 */
async function calculatePrice(
  plan: 'monthly' | 'quarterly' | 'annual',
  promoDiscountPercent?: number
): Promise<PriceCalculationResult>

/**
 * Get pricing thresholds for QR service
 * Returns dynamic thresholds instead of hardcoded values
 */
async function getPricingThresholds(): Promise<{
  monthly_threshold: number;
  quarterly_threshold: number;
}>

// ============================================================================
// ADMIN PRICING MANAGEMENT
// ============================================================================

/**
 * Update pricing configuration with audit trail
 * Creates history entry and invalidates cache
 */
async function updatePricing(
  updates: Partial<PricingConfig>,
  adminUserId: string,
  reason: string
): Promise<PricingConfig>

/**
 * Get pricing change history
 * Returns paginated audit trail
 */
async function getPricingHistory(options?: {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<PricingHistoryEntry[]>

/**
 * Rollback to previous pricing configuration
 * Uses stored snapshot from pricing_history
 */
async function rollbackPricing(
  historyId: string,
  adminUserId: string,
  reason: string
): Promise<PricingConfig>

/**
 * Schedule future pricing changes
 * Creates new config with valid_from in future
 */
async function schedulePricingChange(
  newConfig: Partial<PricingConfig>,
  validFrom: Date,
  adminUserId: string,
  reason: string
): Promise<PricingConfig>

// ============================================================================
// VALIDATION & UTILITIES
// ============================================================================

/**
 * Validate pricing data before database updates
 * Prevents invalid configurations
 */
function validatePricingData(data: Partial<PricingConfig>): {
  valid: boolean;
  errors: string[];
}

/**
 * Invalidate pricing cache
 * Called after admin updates
 */
function invalidatePricingCache(): void

/**
 * Get all pricing configs (active + scheduled)
 * For admin interface
 */
async function getAllPricingConfigs(): Promise<PricingConfig[]>
```

## API Layer Design

### Admin Pricing API (`src/app/api/admin/pricing/route.ts`)

**GET /api/admin/pricing**
- Get current pricing + scheduled changes
- Mobile-optimized response

**POST /api/admin/pricing/update**
- Update current pricing with audit trail
- Creates history entry
- Invalidates cache
- Returns updated pricing

**GET /api/admin/pricing/history**
- Paginated pricing change history
- Mobile-friendly format

**POST /api/admin/pricing/rollback**
- Rollback to previous pricing
- Uses history snapshot
- Returns restored pricing

**POST /api/admin/pricing/schedule**
- Schedule future pricing changes
- Non-blocking current pricing

### Customer Pricing API (`src/app/api/pricing/route.ts`)

**GET /api/pricing/calculate**
- Calculate price with itemized breakdown
- Used by checkout and promo validation
- Returns complete calculation for display

## Integration Points

### QR Service Integration (`lib/qr-service.ts`)

```typescript
/**
 * Replace hardcoded thresholds with dynamic pricing config
 */
async function getPlanQrCode(
  planPrice: number,
  paymentMethod: 'gcash' | 'gotyme'
): Promise<string | null> {
  // Get dynamic thresholds from pricing service
  const { getPricingThresholds } = await import('./pricing-service');
  const thresholds = await getPricingThresholds();
  
  let billingPeriod = '';
  if (planPrice < thresholds.monthly_threshold) {
    billingPeriod = 'monthly';
  } else if (planPrice < thresholds.quarterly_threshold) {
    billingPeriod = 'quarterly';
  } else {
    billingPeriod = 'annual';
  }
  
  // Continue with existing QR code lookup...
}
```

### Promo Code Validation (`app/api/validate-promo-code/route.ts`)

```typescript
export async function POST(req: Request) {
  // Replace hardcoded prices with comprehensive pricing service
  const { calculatePrice } = await import('@/lib/pricing-service');
  
  // Calculate with itemized breakdown
  const pricingResult = await calculatePrice(
    plan_id as 'monthly' | 'quarterly' | 'annual',
    activationCode.discount_percent
  );
  
  return NextResponse.json({
    valid: true,
    pricing_breakdown: {
      base_price: pricingResult.base_price,
      period: pricingResult.billing_period,
      period_months: pricingResult.period_months,
      base_total: pricingResult.base_total,
      period_discount_percent: pricingResult.period_discount_percent,
      period_discount_amount: pricingResult.period_discount_amount,
      price_after_period_discount: pricingResult.price_after_period_discount,
      promo_discount_percent: pricingResult.promo_discount_percent,
      promo_discount_amount: pricingResult.promo_discount_amount,
      final_amount: pricingResult.final_price,
    },
    // ... existing promo code fields
  });
}
```

## Admin Interface Design

### Components Structure

**`components/admin/PricingManager.tsx`** (new)
- Mobile-first pricing display
- Quick action buttons
- Scheduled changes list
- Price preview table

**`components/admin/PricingEditForm.tsx`** (new)
- Touch-friendly input fields
- Real-time validation
- Change preview
- Required reason field

**`components/admin/PricingHistory.tsx`** (new)
- Timeline view of changes
- Rollback functionality
- Filter and pagination

### Mobile Design Specifications

**Input Controls**:
- Min 44px height for touch targets
- Numeric keyboards for price inputs
- Clear labels and error messages
- Real-time validation feedback

**Responsive Layout**:
- Single column on mobile (< 768px)
- Two columns on tablet (768px - 1024px)  
- Three columns on desktop (> 1024px)

**Visual Feedback**:
- Loading states during updates
- Success/error toasts
- Live price preview calculations
- Color-coded discount percentages

## Error Handling & Monitoring

### Graceful Degradation

```typescript
/**
 * Fallback pricing for service failures
 */
const FALLBACK_PRICING = {
  monthly_base_rate: 499,
  quarterly_discount_percent: 5.0,
  annual_discount_percent: 8.0,
  monthly_threshold: 600,
  quarterly_threshold: 1500
};

/**
 * Safe pricing fetch with fallback
 */
async function safeGetCurrentPricing(): Promise<PricingConfig | null> {
  try {
    return await getCurrentPricing();
  } catch (error) {
    console.error('Pricing service failed, using fallback:', error);
    return FALLBACK_PRICING as PricingConfig;
  }
}
```

### Transaction-Based Updates

```typescript
/**
 * Transaction-based pricing updates with rollback
 */
async function updatePricingWithTransaction(
  updates: Partial<PricingConfig>,
  adminUserId: string,
  reason: string
): Promise<PricingConfig> {
  const transaction = await sql.begin();
  
  try {
    // 1. Validate pricing data
    // 2. Create history entry with snapshot
    // 3. Update pricing config
    // 4. Commit transaction
    // 5. Invalidate cache
  } catch (error) {
    await transaction.rollback();
    throw new PricingServiceError('Failed to update pricing', 'DATABASE_ERROR');
  }
}
```

### Performance Monitoring

```typescript
/**
 * Performance monitoring for pricing operations
 */
class PricingMonitor {
  static trackCalculation(metrics: {
    plan: string;
    calculationTime: number;
    cacheHit: boolean;
    finalPrice: number;
  }): void;
  
  static trackUpdate(metrics: {
    adminUser: string;
    fieldsChanged: string[];
    updateDuration: number;
  }): void;
}
```

## Performance Optimizations

### Multi-Tier Caching

```typescript
/**
 * Smart caching for optimal performance
 */
class PricingCacheManager {
  private memoryCache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 60000; // 60 seconds
  
  async get(key: string): Promise<any>
  set(key: string, data: any): void
  invalidate(): void
}
```

### Database Indexing

- `pricing_config(is_active, valid_from)` - Fast active config lookup
- `pricing_history(pricing_config_id)` - History queries
- `pricing_history(changed_at)` - Timeline queries

## Implementation Summary

**Key Features**:
- ✅ **Database-driven pricing** with seasonal adjustment support
- ✅ **Complete audit trail** with rollback capability
- ✅ **Itemized pricing breakdown** for checkout display
- ✅ **Mobile-first admin interface** with touch-friendly controls
- ✅ **Dynamic thresholds** for QR service integration
- ✅ **Comprehensive error handling** with fallback pricing
- ✅ **Performance monitoring** and caching
- ✅ **Scheduled pricing** for future promotional changes

**Files Changed**:
- `migrations/009_create_pricing_system.sql` (new)
- `src/lib/pricing-service.ts` (new)
- `src/app/api/admin/pricing/route.ts` (new)
- `src/app/api/pricing/route.ts` (new)
- `src/app/api/validate-promo-code/route.ts` (update)
- `src/lib/qr-service.ts` (update)
- `src/components/admin/PricingManager.tsx` (new)
- `src/components/admin/PricingEditForm.tsx` (new)
- `src/components/admin/PricingHistory.tsx` (new)

**Implementation Time**: ~6-8 hours
**Security**: Production-ready with validation, audit trail, and error handling
**Mobile**: Fully responsive with touch-friendly interface

**Future Extensibility**:
- Regional pricing support
- A/B testing capabilities
- Advanced pricing rules
- Automated pricing optimization