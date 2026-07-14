# Trial Restriction System Design

**Date:** 2026-07-14  
**Status:** Approved  
**Type:** Feature Enhancement  
**Priority:** High

## Overview

Post-trial restriction system that allows users to maintain full dashboard and financial tracking access while restricting creation of future-dated orders and quotations. Users can create ante-dated (past) orders after trial expiration, enabling complete historical data management and analytics visibility.

## Business Problem

Currently, when trial periods expire, users lose access to create orders entirely. This prevents them from:
- Maintaining complete historical records
- Entering retroactive orders for bookkeeping purposes  
- Viewing their full financial standing and analytics
- Understanding the value proposition through actual usage data

The new restriction model enables a "freemium" upsell strategy where users can:
- ✅ View all historical data and analytics
- ✅ Create orders with past dates (ante-dated)
- ❌ Create orders with future dates (requires subscription)

## Requirements

### Functional Requirements

1. **Trial Expiration Detection**
   - System must detect when `trial_expires_at < current_datetime`
   - Restrictions activate immediately after trial expiration
   - No grace period for future order creation

2. **Order Creation Restrictions**
   - During trial: Allow all order creation (past, today, future dates)
   - After trial expiration: Allow only orders with `quote_date <= current_date`
   - Block orders with `quote_date > current_date` when trial expired

3. **Dashboard & Analytics Access**
   - Full access to all historical data regardless of subscription status
   - Complete analytics, reports, and financial tracking
   - View all orders created during trial period and after

4. **API Validation**
   - Server-side validation for all restricted operations
   - Rich error responses with helpful user messaging
   - Clear HTTP status codes (403 Forbidden) for restrictions

### Non-Functional Requirements

1. **Type Safety**: No `any` types - fully typed TypeScript implementation
2. **Performance**: Restriction checks must not slow down existing operations
3. **Maintainability**: Clean architecture with clear separation of concerns
4. **Compatibility**: No modifications to auth files or login system
5. **Mobile-First**: Responsive UI for restriction messages and guidance

## Architecture

### System Layers

The trial restriction system uses a **hybrid middleware + context architecture** with four distinct layers:

```
┌─────────────────────────────────────────┐
│     UI State Management Layer          │
│  (TrialRestrictionContext.tsx)         │
│  - Real-time restriction state         │
│  - React hooks for components          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        API Validation Layer             │
│  (Middleware functions)                 │
│  - Request validation before business   │
│  - Rich error responses                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     Core Business Logic Layer           │
│  (trial-restrictions.ts)                │
│  - Pure restriction functions            │
│  - Business rule calculations            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     Type Definition Layer               │
│  (trial-restrictions.ts types)         │
│  - TypeScript interfaces & enums         │
└─────────────────────────────────────────┘
```

### File Structure

```
src/
├── lib/
│   └── trial-restrictions.ts          # Core business logic
├── contexts/
│   └── TrialRestrictionContext.tsx   # React context for UI
├── hooks/
│   └── useTrialRestrictions.ts       # Custom hook (optional)
├── types/
│   └── trial-restrictions.ts         # TypeScript definitions
└── app/
    └── api/
        └── quotes/
            └── route.ts              # Modified with validation
```

## Core Components

### 1. Business Logic Layer (`src/lib/trial-restrictions.ts`)

**Primary Functions:**

```typescript
// Check if user can create order with specific date
canCreateOrderWithDate(userId: string, targetDate: Date): Promise<RestrictionResult>

// Check if user can create future orders (date > today)  
canCreateFutureOrders(userId: string): Promise<boolean>

// Get user's current restriction state
getUserRestrictionState(userId: string): Promise<RestrictionState>

// Validate specific operation against restrictions
validateOperation(operation: OperationType, userId: string, context?: ValidationContext): Promise<ValidationResult>
```

**Core Logic Flow:**
1. Get user's subscription info using existing `getUserSubscriptionInfo()`
2. Check if trial has expired: `trial_expires_at < now`
3. If trial active: allow all operations
4. If trial expired:
   - Allow viewing/reading operations  
   - Allow creating orders with `targetDate <= today`
   - Block creating orders with `targetDate > today`

### 2. API Validation Layer

**Middleware Integration:**

```typescript
// In src/lib/trial-restrictions.ts

async function validateQuoteCreation(
  session: Session, 
  quoteDate: Date
): Promise<ValidationResult> {
  const restrictionState = await getUserRestrictionState(session.userId);
  
  if (!restrictionState.trialExpired) {
    return { allowed: true, level: RestrictionLevel.NONE };
  }
  
  // Trial expired - check date restriction
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  
  if (quoteDate > today) {
    return {
      allowed: false,
      level: RestrictionLevel.PARTIAL,
      reason: "Cannot create orders with future dates after trial expiration",
      suggestion: "Create orders with dates before today, or activate your subscription"
    };
  }
  
  return { allowed: true, level: RestrictionLevel.PARTIAL };
}

function restrictionErrorResponse(result: ValidationResult): NextResponse {
  return NextResponse.json({
    error: "Trial period expired",
    restrictionType: "future_orders_blocked", 
    canCreatePastOrders: true,
    canViewDashboard: true,
    restrictionReason: result.reason,
    suggestion: result.suggestion,
    checkoutUrl: "/account/subscription"
  }, { status: 403 });
}
```

**Modified `/api/quotes/route.ts` POST:**
```typescript
// Add after session check
const validation = await validateQuoteCreation(session, new Date(quote_date));
if (!validation.allowed) {
  return restrictionErrorResponse(validation);
}
// Continue with existing quote creation logic...
```

### 3. UI State Management (`src/contexts/TrialRestrictionContext.tsx`)

**Context Interface:**

```typescript
interface TrialRestrictionContextType {
  // Current restriction state
  state: RestrictionState;
  
  // Convenient boolean flags for common checks
  canCreateFutureOrders: boolean;
  canViewDashboard: boolean;
  canCreatePastOrders: boolean;
  
  // Loading/error states
  isLoading: boolean;
  error: string | null;
  
  // Refresh function (call after subscription changes)
  refreshRestrictions: () => Promise<void>;
}

interface RestrictionState {
  level: RestrictionLevel;
  trialExpired: boolean;
  trialExpiresAt: Date | null;
  subscriptionActive: boolean;
  allowedOperations: OperationType[];
  restrictionReason?: string;
  canCreatePastOrders: boolean;
  canCreateFutureOrders: boolean;
}
```

**Component Usage:**
```typescript
// In QuoteWizard, Dashboard, etc.
const { canCreateFutureOrders, restrictionReason } = useTrialRestrictions();

<button 
  disabled={!canCreateFutureOrders}
  title={restrictionReason}
>
  New Quote
</button>
```

### 4. Type Definitions (`src/types/trial-restrictions.ts`)

```typescript
// Restriction levels for graduated access
enum RestrictionLevel {
  NONE = 'none',           // Full access (trial active or subscribed)
  PARTIAL = 'partial',     // Can view + create past orders
  FULL = 'full'           // All operations restricted
}

// Operation types that can be restricted
enum OperationType {
  CREATE_ORDER = 'create_order',
  CREATE_QUOTE = 'create_quote',
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_PRODUCTS = 'manage_products'
}

// Result of restriction check
interface RestrictionResult {
  allowed: boolean;
  operation: OperationType;
  level: RestrictionLevel;
  reason?: string;
  canBypass?: boolean;
}

// Validation result with rich error info
interface ValidationResult {
  allowed: boolean;
  reason?: string;
  level: RestrictionLevel;
  suggestion?: string;
}
```

## Data Flow & Error Handling

### Complete Request Lifecycle

```
1. User clicks "New Order" button
   → UI checks useTrialRestrictions().canCreateFutureOrders
   → If false: Disable button + show tooltip with restrictionReason

2. User fills form and submits (with past date)
   → POST /api/quotes with quote_date: "2026-07-01"

3. API middleware validates
   → validateQuoteCreation(session, targetDate)
   → Checks: trialExpired? targetDate <= today?
   → Returns: { allowed: true, level: PARTIAL }

4. Business logic executes
   → Order created successfully
   → 201 Created response

5. User creates order with future date (trial expired)
   → validateQuoteCreation() returns { allowed: false, reason: "..." }
   → 403 Forbidden with rich error object
   → UI shows: "Your trial expired. Create orders with past dates or renew subscription"
```

### Error Response Format

**403 Forbidden (Trial Restrictions):**
```json
{
  "error": "Trial period expired",
  "restrictionType": "future_orders_blocked",
  "canCreatePastOrders": true,
  "canViewDashboard": true,
  "restrictionReason": "Cannot create orders with future dates after trial expiration on [date]",
  "suggestion": "Create orders with dates before today, or activate your subscription",
  "checkoutUrl": "/account/subscription"
}
```

### Safety Mechanisms

- **Fail-Open for Availability**: If restriction check fails, default to allowed
- **Comprehensive Logging**: Log all restriction violations for analytics
- **Performance Caching**: Cache restriction state for 5 minutes to reduce database load
- **User Experience**: Proactive UI + reactive API validation (defense in depth)

## Integration Points

### Existing System Dependencies

- **Auth System** (Read-only): Uses existing `getSession()` and `requireSession()`
- **Subscription System** (Read-only): Uses existing `getUserSubscriptionInfo()`  
- **Database** (Read-only): Queries existing trial_expires_at and subscription fields

### No Modifications Required

- ✅ No changes to auth files or login system
- ✅ No changes to existing subscription logic
- ✅ No database schema changes required
- ✅ Backwards compatible with existing API routes

## Security Considerations

1. **Server-Side Validation**: All restrictions validated at API level before business logic
2. **No Client Trust**: UI restrictions are UX only - API enforces actual security
3. **Type Safety**: Full TypeScript coverage prevents runtime type errors
4. **Fail-Safe Defaults**: Restriction system failures don't block legitimate users
5. **Audit Trail**: Log all restriction violations for security monitoring

## Performance Considerations

1. **Caching Strategy**: Restriction state cached for 5 minutes per user session
2. **Database Load**: Minimal additional queries - uses existing subscription data
3. **UI Performance**: Memoized React context selectors prevent unnecessary re-renders
4. **API Latency**: Restriction checks add <5ms to request processing

## Testing Strategy

1. **Unit Tests**: Core business logic functions (trial date calculations, restriction rules)
2. **Integration Tests**: API endpoint validation with various trial states
3. **Component Tests**: React context behavior and UI state management
4. **E2E Tests**: Complete user flows (restricted vs. unrestricted scenarios)
5. **Performance Tests**: Ensure restriction checks don't degrade API response times

## Mobile-First Considerations

1. **Responsive Error Messages**: Clear, concise restriction explanations on mobile screens
2. **Touch-Friendly UI**: Proper button sizing for restricted action controls
3. **Progressive Disclosure**: Show restriction details on-demand to save mobile screen space
4. **Optimized Performance**: Minimal JavaScript overhead for restriction checks on mobile devices

## Success Criteria

1. ✅ Users can create orders with past dates after trial expiration
2. ✅ Users cannot create orders with future dates after trial expiration  
3. ✅ Dashboard and analytics remain fully accessible after trial expiration
4. ✅ Clear, helpful error messages guide users to subscription activation
5. ✅ No performance degradation in existing functionality
6. ✅ Complete TypeScript type safety with no `any` types
7. ✅ Mobile-optimized user experience for restriction messaging

## Implementation Notes

- Follow existing naming conventions (camelCase files, PascalCase components)
- Use proper TypeScript types throughout - no `any` types
- Maintain clean separation between business logic and UI state
- Ensure mobile-first responsive design for all restriction messaging
- Test thoroughly with various trial expiration scenarios
- Monitor performance impact of restriction checks

## Future Enhancements

1. **Granular Time-Based Restrictions**: Restrict by time of day, not just date
2. **Volume Limits**: Maximum number of past orders per time period
3. **Admin Override**: Allow admins to grant temporary exceptions
4. **Analytics Dashboard**: Track restriction violation patterns and conversion rates
5. **A/B Testing**: Test different restriction levels and messaging effectiveness