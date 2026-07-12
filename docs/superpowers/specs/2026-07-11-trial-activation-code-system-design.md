# Trial System & Activation Code Implementation Design

**Project:** Concetto Window Coverings - Multi-tenant Quotation System  
**Date:** 2026-07-11  
**Type:** Feature Implementation Design  
**Status:** Approved for Implementation

---

## Overview

Implement a comprehensive 3-day trial system with manual activation codes for subscription management. This system replaces PayMongo integration with flexible multi-currency payment tracking (GCash, crypto, USD) and comprehensive audit capabilities.

**Key Requirements:**
- Archive existing PayMongo integration
- Implement 3-day trial period for all signups (manual + OAuth)
- Manual activation code system for subscription activation
- Multi-payment method support (GCash, crypto, USD)
- Comprehensive admin dashboard with analytics
- Mobile-first responsive design
- Build deployment and Git push

---

## System Architecture

### Database-First Approach (Selected)

**Rationale:** Existing database foundation, single source of truth, easier auditing, works across all OAuth providers.

**Components:**
1. **Database Layer:** Trial status, subscription tracking, activation codes
2. **Proxy Layer:** Authentication and subscription checks via existing `src/proxy.ts`
3. **API Layer:** Protected endpoints with subscription validation
4. **UI Layer:** Mobile-first user interfaces for activation and admin management

---

## Section 1: Database Schema & Migration

### Enhanced Users Table

```sql
ALTER TABLE users ADD COLUMN trial_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN subscription_activated BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN activation_code VARCHAR(255);
ALTER TABLE users ADD COLUMN discount_percent DECIMAL(5,2);
ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(50); -- 'monthly', 'quarterly', 'annual'

-- Set existing users to active (grandfather clause)
UPDATE users SET subscription_activated = true WHERE created_at < NOW();
```

### New activation_codes Table

```sql
CREATE TABLE activation_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) UNIQUE NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  applicable_plans JSONB NOT NULL DEFAULT '["monthly","quarterly","annual"]',
  
  -- Payment tracking
  payment_amount DECIMAL(10,2),
  payment_currency VARCHAR(10) DEFAULT 'PHP',
  payment_amount_usd DECIMAL(10,2),
  payment_method VARCHAR(50), -- 'gcash', 'crypto', 'usd_bank', 'other'
  exchange_rate DECIMAL(10,4),
  payment_reference VARCHAR(255),
  payment_date TIMESTAMP,
  wallet_address VARCHAR(255),
  bank_reference VARCHAR(255),
  
  -- Lifecycle tracking
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  used_by INTEGER REFERENCES users(id),
  used_at TIMESTAMP,
  used_ip_address VARCHAR(45),
  is_active BOOLEAN DEFAULT true,
  
  -- Campaign tracking
  campaign_name VARCHAR(255),
  notes TEXT,
  status_history JSONB DEFAULT '[]'
);

CREATE INDEX idx_activation_codes_code ON activation_codes(code);
CREATE INDEX idx_activation_codes_status ON activation_codes(is_active, used_by);
```

### Account Status Logic

```sql
-- Access Logic: user has access if trial is active OR subscription is activated
trial_active: trial_expires_at > NOW()
subscription_active: subscription_activated = true
has_access: trial_active OR subscription_active

-- Account States:
-- 1. Trial Period: trial_expires_at > NOW() AND subscription_activated = false
-- 2. Subscribed: subscription_activated = true (trial status irrelevant)
-- 3. Locked: trial_expires_at <= NOW() AND subscription_activated = false
```

---

## Section 2: Trial System Logic

### 3-Day Trial Flow

**All Signups (Manual + OAuth):**
1. User signup → Set `trial_expires_at = NOW() + 3 days`
2. `subscription_activated = false` initially
3. Full system access during trial period

**Trial Status API Response:**
```json
{
  "trial_active": true,
  "trial_days_remaining": 2,
  "trial_expires_at": "2026-07-13T10:30:00Z",
  "subscription_activated": false,
  "requires_activation": false,
  "has_access": true
}
```

**Trial Expiry Handling:**
- Block dashboard access, quote creation, and other features
- Show activation code prompts on all pages
- Allow read-only access to existing quotes

**Subscription Activation:**
- Valid activation code entered → `subscription_activated = true`
- Save `discount_percent` and `subscription_plan` to user account
- Mark code as used in `activation_codes` table
- Immediate access restoration

---

## Section 3: Activation Code System

### Payment Workflow

**Manual Payment Process:**
1. Trial expires for user
2. Admin instructs user to pay via GCash/crypto/USD
3. User sends payment proof to admin
4. Admin generates one-time activation code
5. Admin provides code to user
6. User enters code immediately
7. **First-come, first-served:** If someone else uses code first, original user loses it

### Discount Structure

- **Flash Monthly Sales:** 15% discount (limited-time promos)
- **Quarterly Plans:** 25% discount
- **Annual Plans:** 35% discount
- **Custom:** Any discount percentage for special campaigns

### Code Examples

- `FLASH15` → 15% discount, monthly plans only, campaign "FLASH_JAN_2026"
- `QTR25` → 25% discount, quarterly plans only
- `ANNUAL35` → 35% discount, annual plans only
- `WELCOME20` → 20% discount, all plans, welcome campaign

### Code Validation Logic

```typescript
// Validation steps:
1. Check code exists in activation_codes table
2. Verify code.is_active = true
3. Check code.expires_at > NOW() (if set)
4. Verify code.used_by is NULL (not already used)
5. Check code.applicable_plans includes requested plan
6. Apply discount and plan to user account
7. Mark code as used (used_by, used_at, used_ip_address)
8. Update status_history
```

---

## Section 4: Admin Panel & Data Visualization

### Admin Dashboard (`/admin/activation-codes`)

**Key Metrics Cards:**
- Total GCash Payments Collected
- Total Crypto Payments Collected  
- Total USD Payments Collected
- Active Subscriptions by Plan Type
- Pending Codes (generated but not used)
- Average Revenue Per User
- Trial-to-Conversion Rate
- Payment Method Distribution

**Graphs & Charts:**

1. **Revenue Over Time:** Daily/weekly/monthly payment trends by method
2. **Activation Code Usage:** Codes generated vs codes used timeline
3. **Discount Distribution:** Pie chart of discount tiers (15%, 25%, 35%)
4. **Plan Type Breakdown:** Monthly vs Quarterly vs Annual subscriptions
5. **Payment Method Trends:** Popularity over time (GCash vs Crypto vs USD)
6. **Currency Distribution:** Revenue by currency (PHP, USD, BTC, ETH)
7. **Trial Conversion Funnel:** Signups → Trial Starts → Payments → Activations
8. **Geographic Distribution:** Where users are activating from (IP-based)
9. **Code Usage Patterns:** Time-to-redemption analysis
10. **Payment Method Conversion Rates:** Which methods convert best

**Admin Features:**
- **Code Generation:** Single or bulk code creation
- **Code Configuration:** Discount %, applicable plans, expiry dates, campaigns
- **Payment Reconciliation:** Match codes to payments
- **Code Lifecycle Tracking:** Creation → Usage → Subscription activation
- **Audit Trail:** Complete status history for each code
- **Security Monitoring:** IP geolocation, unusual redemption patterns
- **Export Capabilities:** CSV/PDF exports for accounting
- **Filtering:** Date ranges, campaigns, plan types, payment methods

---

## Section 5: Multi-Payment Method Support

### Supported Payment Methods

**1. GCash (PHP):**
- Primary payment method for Philippines
- Mobile wallet transfers
- Reference number tracking

**2. Cryptocurrency:**
- Bitcoin (BTC)
- Ethereum (ETH)  
- USDT/USDC
- Wallet address tracking

**3. USD Bank Transfers:**
- International wire transfers
- Bank reference tracking
- Exchange rate conversion

**4. Other Methods:**
- Custom payment methods
- Flexible tracking for future methods

### Enhanced Payment Tracking

- `payment_method` - Method type
- `payment_currency` - PHP, USD, BTC, ETH, etc.
- `payment_amount_usd` - Converted amount for unified reporting
- `exchange_rate` - Rate used for conversion
- `wallet_address` - Crypto wallet (if applicable)
- `bank_reference` - Bank transfer reference (if applicable)

---

## Section 6: UI/UX Components (Mobile-First)

### Login Page Enhancement

**Add signup link:**
```
"Don't have an account? Sign up"
```
Below login form, mobile-optimized with touch-friendly 44px+ buttons.

### 4 Activation Code Entry Points

**1. Dedicated Page (`/activate-code`):**
- Full-screen activation code input
- Clear instructions and payment info
- Real-time validation feedback
- Success/error messaging
- Mobile-optimized input (large text, numeric keyboard)

**2. Login Modal:**
- Shows when expired users try to login
- Clean overlay with code input + explanation
- "Contact admin for payment instructions" button
- Dismissible but persistent reminder

**3. Account Settings:**
- "Enter Activation Code" section
- Payment instructions + GCash/crypto details
- Code history and subscription status
- Current plan and discount display

**4. Dashboard Banner:**
- Persistent banner when account is locked
- Eye-catching but not intrusive
- "Activate your account" button
- Shows trial days remaining (if applicable)

### Trial Status Indicators

- **Active Trial:** "⏰ Trial: 2 days remaining"
- **Expired:** "🔒 Account locked - Enter activation code"
- **Subscribed:** "✅ Active subscription - 25% quarterly discount"

### Mobile-First Responsive Design

All components optimized for mobile devices with:
- Touch-friendly targets (44px+)
- Readable text sizes
- Efficient layouts
- Fast loading times

---

## Section 7: Proxy-Based Authentication & Subscription

### Enhanced `src/proxy.ts`

Extend existing proxy pattern for subscription management:

```typescript
// Add subscription checks to existing proxy logic
const user = await db.getUser(sessionData.userId);

const trialActive = user.trial_expires_at > new Date();
const subscribed = user.subscription_activated === true;
const hasAccess = trialActive || subscribed;

// Inject subscription status into headers for API routes
requestHeaders.set('x-subscription-active', String(hasAccess));
requestHeaders.set('x-trial-active', String(trialActive));
requestHeaders.set('x-subscription-activated', String(subscribed));

// Block access to protected routes if no subscription
if (pathname.startsWith('/api/protected') && !hasAccess) {
  return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
}

// Redirect page routes to activation if needed
if (!pathname.startsWith('/api') && !hasAccess) {
  if (pathname !== '/activate-code' && pathname !== '/account') {
    return NextResponse.redirect(new URL('/activate-code', req.url));
  }
}
```

### API Endpoint Protection

**Helper function for protected routes:**
```typescript
async function checkSubscription(userId: string) {
  const user = await db.getUser(userId);
  const trialActive = user.trial_expires_at > new Date();
  const subscribed = user.subscription_activated === true;
  
  return { 
    trialActive, 
    subscribed, 
    hasAccess: trialActive || subscribed,
    discountPercent: user.discount_percent,
    plan: user.subscription_plan
  };
}
```

---

## Section 8: API Endpoints

### Core Endpoints

**Trial Status:**
- `GET /api/auth/trial-status` - Check user's trial/subscription status

**Activation Code Endpoints:**
- `POST /api/activate-code` - Validate and redeem activation code
- `GET /api/activate-code/plans` - Get available subscription plans

**Admin Endpoints:**
- `GET /api/admin/activation-codes` - List all codes with filtering
- `POST /api/admin/activation-codes` - Generate new code(s)
- `PUT /api/admin/activation-codes/:id` - Update code status/notes
- `DELETE /api/admin/activation-codes/:id` - Deactivate code
- `GET /api/admin/dashboard` - Dashboard analytics data
- `GET /api/admin/revenue` - Revenue reports and metrics

### Authentication Flow Integration

- Check trial status on every auth request
- Include trial info in JWT/session token
- Block access if trial expired + no subscription
- All OAuth providers (Google, Pi Network) follow same trial flow

---

## Section 9: PayMongo Archival Strategy

### Archive Directory Structure

```
archive/
├── paymongo/
│   ├── README.md                    (Archival documentation)
│   ├── original_integration/        (Original PayMongo code)
│   │   ├── webhooks/
│   │   │   └── paymongo/
│   │   │       └── route.ts        (Original webhook handler)
│   │   ├── subscriptions/
│   │   │   ├── create/
│   │   │   │   └── route.ts        (Original subscription creation)
│   │   │   └── cancel/
│   │   │       └── route.ts        (Original cancellation)
│   │   └── account/
│   │       └── subscription/
│   │           └── route.ts        (Original account management)
│   ├── documentation/
│   │   ├── PAYMONGO_WEBHOOK_SETUP.md
│   │   ├── PRODUCTION_READINESS_REPORT.md
│   │   └── IMPLEMENTATION_COMPLETE.md
│   ├── migration_files/
│   │   └── subscription-system.sql
│   └── tests/
│       └── subscription/
│           └── subscription.test.ts
```

### Archival README Content

- **Original Integration Purpose:** Automated payment processing
- **Date Archived:** 2026-07-11
- **Reason:** Manual GCash/crypto payment system implementation
- **Reactivation Instructions:** Environment variables and setup steps
- **Database Tables:** Preserved for reference with `paymongo_archived` flag

---

## Section 10: Testing & Deployment

### Testing Strategy

**1. Unit Tests:**
- Trial status calculation logic
- Activation code validation
- Subscription checking functions
- Discount percentage calculations
- Database migration scripts

**2. Integration Tests:**
- Complete signup → trial → activation flow
- OAuth providers with trial system
- Payment → code generation → redemption flow
- API endpoint protection and redirects
- Proxy-based authentication

**3. End-to-End Tests:**
- Manual signup with activation code entry
- Google OAuth signup with trial expiry
- Admin panel code generation and usage
- Dashboard graph rendering
- Mobile responsive layouts

### Build & Deployment Process

**Build Steps:**
1. Run database migrations
2. Test all activation code flows
3. Verify admin panel functionality
4. Mobile testing across devices
5. `npm run build` - Ensure no build errors

**Deployment Steps:**
1. Commit all changes to git
2. Push to GitHub main branch
3. Deploy to production environment
4. Test critical flows in production
5. Monitor for issues

**Rollback Plan:**
- Keep previous working commit tagged
- Quick database rollback script if needed
- Feature flags to disable new features if issues arise

---

## Implementation Phases

### Phase 1: Database & Core Logic
- Create migration files
- Implement trial status logic
- Build activation code validation
- Add subscription checking functions

### Phase 2: API & Proxy Integration
- Extend `src/proxy.ts` with subscription checks
- Implement API endpoints
- Add authentication flow integration
- Build admin API endpoints

### Phase 3: UI Components
- Login page signup link
- 4 activation code entry points
- Trial status indicators
- Mobile-responsive layouts

### Phase 4: Admin Panel
- Code generation interface
- Data visualization and graphs
- Payment reconciliation features
- Audit trail and monitoring

### Phase 5: PayMongo Archive
- Move PayMongo code to archive/
- Create archival documentation
- Update database references

### Phase 6: Testing & Deployment
- Implement comprehensive tests
- Build and deploy
- Monitor production performance

---

## Success Criteria

✅ All signups (manual + OAuth) get 3-day trial  
✅ Trial expiry blocks access correctly  
✅ Activation codes work for all payment methods  
✅ Admin panel generates codes successfully  
✅ Dashboard graphs display correctly  
✅ Mobile UI works across devices  
✅ PayMongo properly archived  
✅ Build succeeds without errors  
✅ Code pushed to GitHub successfully  

---

## Technical Stack

- **Database:** PostgreSQL with Neon
- **Backend:** Next.js API Routes, TypeScript
- **Frontend:** React, Tailwind CSS, mobile-first design
- **Authentication:** NextAuth.js with proxy pattern
- **Charts:** Recharts for data visualization
- **Testing:** Jest for unit/integration tests

## Code Quality Standards

**TypeScript Requirements:**
- **Strict typing for all functions** - No `any` types allowed
- **Comprehensive interfaces** - Define all data structures explicitly
- **Type-safe API responses** - Proper request/response types
- **Enum usage** - Use enums for fixed values (payment methods, subscription plans)
- **Generic types** - Leverage TypeScript generics for reusable components

**No Ambiguities Policy:**
- **Explicit return types** - All functions must declare return types
- **Parameter validation** - Input types must be specific and validated
- **Error type definitions** - Define custom error types for different scenarios
- **Database schema types** - Mirror database structure in TypeScript interfaces
- **API contract types** - Clear request/response interfaces for all endpoints

**Example Type Definitions:**
```typescript
// Payment method types
enum PaymentMethod {
  GCASH = 'gcash',
  CRYPTO = 'crypto', 
  USD_BANK = 'usd_bank',
  OTHER = 'other'
}

// Subscription plan types
enum SubscriptionPlan {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly', 
  ANNUAL = 'annual'
}

// Activation code interface
interface ActivationCode {
  id: number;
  code: string;
  discount_percent: number;
  applicable_plans: SubscriptionPlan[];
  payment_amount?: number;
  payment_method?: PaymentMethod;
  // ... all fields explicitly typed
}

// API response types
interface TrialStatusResponse {
  trial_active: boolean;
  trial_days_remaining: number;
  trial_expires_at: string;
  subscription_activated: boolean;
  requires_activation: boolean;
  has_access: boolean;
}
```

---

## Risks & Mitigations

**Risk:** Code sharing/loss by users  
**Mitigation:** First-come, first-served system, clear user instructions

**Risk:** Database migration issues  
**Mitigation:** Comprehensive testing, rollback plan

**Risk:** Mobile UI issues  
**Mitigation:** Extensive mobile testing, responsive design

**Risk:** Payment tracking errors  
**Mitigation:** Comprehensive audit trail, admin monitoring

---

## Next Steps

1. **Review and approve** this design document
2. **Create detailed implementation plan** using writing-plans skill
3. **Execute implementation** phase by phase
4. **Test and deploy** to production
5. **Monitor performance** and iterate as needed

---

**Design approved by:** [User approval pending]  
**Ready for implementation planning:** Yes