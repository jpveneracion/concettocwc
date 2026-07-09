# Comprehensive Subscription System Design

**Project**: Concetto Window Coverings Multi-tenant Quotation System  
**Date**: 2026-07-10  
**Status**: Design Approved  
**Approach**: Option 2 - Comprehensive Subscription System with Hybrid Management  

## Executive Summary

Design and implementation of an enterprise-grade subscription system using PayMongo payment gateway for the Concetto Window Coverings multi-tenant quotation platform. The system supports two subscription tiers (Basic ₱499/month, Pro ₱999/month), 3-day trial periods, read-only access for payment issues, and hybrid user/admin management.

## Requirements Summary

- **Payment Gateway**: PayMongo (Philippines-based, supports GCash/Maya)
- **Subscription Tiers**: Basic (₱499/month) + Pro (₱999/month)
- **Trial Period**: 3 days, then read-only mode
- **Read-Only Mode**: View existing quotes, no create/edit
- **Management**: Hybrid - user-facing UI + PayMongo dashboard for admin
- **Access Control**: Route handler checks, no middleware
- **Mobile-First**: Responsive design for mobile users

## Architecture Overview

### 1. Database Architecture

#### Core Tables

**subscriptions**
- Main subscription lifecycle tracking
- Fields: id (UUID), company_id (UUID FK), status (enum), plan_id (UUID FK), trial_end (timestamptz), current_period_end (timestamptz), cancel_at_period_end (boolean), paymongo_subscription_id (text), created_at, updated_at
- Relationships: One-to-one with companies, one-to-many with subscription_items and invoices
- Status values: trialing, active, past_due, cancelled, suspended

**subscription_plans**
- Plan definitions and pricing
- Fields: id (UUID), name (text), amount (numeric), currency (text), interval (text), paymongo_plan_id (text), features (jsonb), created_at, updated_at
- Pre-populated: Basic (₱499/month), Pro (₱999/month)

**subscription_items**
- Line items per subscription
- Fields: id (UUID), subscription_id (UUID FK), plan_id (UUID FK), quantity (integer), price (numeric), created_at, updated_at
- Supports complex billing scenarios

**invoices**
- Billing invoices and payment tracking
- Fields: id (UUID), subscription_id (UUID FK), company_id (UUID FK), number (text), amount_due (numeric), amount_paid (numeric), currency (text), status (text), paid_at (timestamptz), attempt_count (integer), paymongo_invoice_id (text), created_at, updated_at
- Status values: draft, open, paid, void, uncollectible

**payment_methods**
- Stored payment methods
- Fields: id (UUID), company_id (UUID FK), paymongo_payment_method_id (text), type (text), card_last4 (text), expiry_date (text), is_default (boolean), created_at, updated_at
- Type values: gcash, maya, card

**webhook_events**
- Event log for webhook replay and debugging
- Fields: id (UUID), event_type (text), paymongo_event_id (text), payload (jsonb), processed (boolean), processing_error (text), created_at, updated_at
- Enables replay and audit trail

#### Existing Schema Updates

**companies table**
- `subscription_status` becomes read-only, derived from subscriptions.status
- Add `trial_end` (timestamptz) for 3-day trial tracking
- Maintain backward compatibility with existing data

### 2. PayMongo Integration & API Routes

#### New API Routes

**POST /api/subscriptions/create**
- Creates PayMongo checkout session for new subscriptions
- Accepts: plan_id (Basic/Pro), success_url, cancel_url
- Returns: checkout_url for redirect, session_id
- Handles plan selection and user authentication
- Rate limited: 5 requests per minute per company

**GET /api/account/subscription**
- Returns current subscription details for authenticated company
- Returns: plan, status, trial_end, current_period_end, usage_stats
- Usage stats: quotes_created_this_period, quotes_remaining
- Cached for 5 minutes to reduce database load

**POST /api/account/subscription/cancel**
- Initiates subscription cancellation at period end
- Updates cancel_at_period_end flag in PayMongo and database
- Returns: confirmation, final_access_date
- Requires confirmation: "Are you sure?" check

**POST /api/account/subscription/update-plan**
- Switch between Basic/Pro plans
- Calculates prorated billing via PayMongo
- Returns: new_checkout_url if payment required, or immediate confirmation
- Idempotent: multiple calls with same plan_id handled gracefully

**POST /api/webhooks/paymongo**
- Processes all PayMongo webhook events
- Verifies HMAC-SHA256 signature using PAYMONGO_WEBHOOK_SECRET
- Events processed: subscription.activated, payment.succeeded, payment.failed, subscription.cancelled, subscription.updated
- Returns: 200 for success, 401 for signature failure, 500 for processing errors
- Includes retry logic with exponential backoff

#### Webhook Event Processing Logic

**subscription.activated**
- Create subscription record if not exists
- Set trial_end = created_at + 3 days
- Set status = 'trialing' if trial period, else 'active'
- Send welcome email to company admin

**payment.succeeded**
- Update current_period_end in subscription
- Clear past_due status if applicable
- Create/ update invoice record
- Send payment confirmation email
- Remove any access restrictions

**payment.failed**
- Set subscription status = 'past_due'
- Increment invoice attempt_count
- Send payment failure warning email
- Enable read-only mode + warning banner in UI
- Schedule retry notification in 3 days

**subscription.cancelled**
- Set subscription status = 'cancelled'
- Set cancel_at_period_end = true
- Allow 7-day grace period with read-only access
- Send cancellation confirmation email
- Schedule final access revocation after grace period

**subscription.updated**
- Handle plan changes, quantity updates
- Update subscription_items records
- Recalculate current_period_end if needed

#### Security Implementation

**Webhook Signature Verification**
```typescript
// Verify PayMongo webhook signatures
const crypto = require('crypto');
const signature = req.headers['paymongo-signature'];
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmac.update(rawPayload);
const digest = hmac.digest('hex');
if (signature !== digest) {
  return { error: 'Invalid signature' };
}
```

**Idempotency Keys**
- Generate unique idempotency_key for each webhook event
- Store processed event IDs to prevent duplicate processing
- Retry webhooks safely without side effects

**Rate Limiting**
- Apply to subscription creation: 5 requests/minute/company
- Prevent abuse and accidental duplicate subscriptions
- Return 429 Too Many Requests with retry-after header

### 3. Access Control & Security

#### Route Handler Approach

**Helper Functions**

**lib/subscription.ts**
```typescript
export async function checkSubscriptionAccess(session: Session): Promise<{
  allowed: boolean;
  mode: 'full' | 'readonly' | 'denied';
  reason?: string;
  subscription?: SubscriptionDetails;
}> {
  // Check subscription status, trial period, grace period
  // Return access decision and details
}

export async function requireActiveSubscription(session: Session) {
  const access = await checkSubscriptionAccess(session);
  if (!access.allowed) {
    throw new SubscriptionError('Subscription required', 402, {
      checkoutUrl: '/subscription/checkout',
      reason: access.reason
    });
  }
}
```

**Protected Route Examples**

**POST /api/quotes (protected)**
```typescript
export async function POST(req: Request) {
  const session = await getSession();
  await requireActiveSubscription(session); // throws if not active
  // ... quote creation logic
}
```

**PUT /api/quotes/[id] (protected)**
```typescript
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  await requireActiveSubscription(session);
  // ... quote update logic
}
```

**GET /api/quotes (allows read-only)**
```typescript
export async function GET() {
  const session = await getSession();
  const access = await checkSubscriptionAccess(session);
  const quotes = await sql`SELECT * FROM quotes WHERE company_id = ${session.companyId}`;
  return NextResponse.json({ 
    quotes, 
    accessMode: access.mode,
    subscriptionRequired: !access.allowed && access.mode !== 'readonly'
  });
}
```

#### Access Logic Matrix

| Subscription Status | Trial Period | Grace Period | Access Mode |
|-------------------|--------------|--------------|-------------|
| active | No | N/A | Full |
| trialing | Yes (remaining) | N/A | Full |
| past_due | No | N/A | Read-only |
| cancelled | No | Yes (7 days) | Read-only |
| cancelled | No | No (expired) | Denied |
| suspended | No | N/A | Denied |

#### Error Responses

**402 Payment Required**
```json
{
  "error": "Subscription required",
  "checkoutUrl": "/subscription/checkout",
  "reason": "Trial period ended",
  "plans": [
    { "name": "Basic", "price": 499, "currency": "PHP" },
    { "name": "Pro", "price": 999, "currency": "PHP" }
  ]
}
```

**403 Forbidden**
```json
{
  "error": "Read-only mode active",
  "reason": "Payment failed - update payment method required",
  "actionUrl": "/account/subscription",
  "allowedOperations": ["GET", "HEAD"]
}
```

**429 Too Many Requests**
```json
{
  "error": "Trial limit exceeded",
  "reason": "Maximum quotes created during trial period",
  "upgradeUrl": "/subscription/checkout"
}
```

### 4. User Interface & Experience

#### Subscription Management Pages

**Account Subscription Page (/account/subscription)**

**Current Plan Card**
- Plan badge: Basic (₱499/month) or Pro (₱999/month)
- Status indicator: Active, Trial, Past Due, Cancelled
- Next billing date and amount
- Card on file display (last 4 digits)
- Quick action buttons: Upgrade, Cancel, Update Payment

**Usage Statistics**
- Quotes created this period: X
- Quotes remaining: Y (if applicable)
- Trial days remaining: Z (if in trial)
- Progress bar for quota usage

**Billing Summary**
- Current plan price and billing cycle
- Next payment date and amount
- Payment method on file
- Link to billing history

**Quick Actions**
- Upgrade/Downgrade plan
- Cancel subscription (with confirmation)
- Update payment method
- Download invoice (PDF)

**Warning Banners**
- "Trial ends in 2 days - Subscribe now to continue access"
- "Payment failed - Update payment method to maintain access"  
- "Subscription cancelled - Grace period ends in 5 days"
- "Payment method expiring soon - Update to prevent service interruption"

**Checkout Page (/subscription/checkout)**

**Plan Comparison**
```html
<div class="plans-container">
  <div class="plan-card basic">
    <h3>Basic Plan</h3>
    <div class="price">₱499/month</div>
    <ul class="features">
      <li>✓ Up to 50 quotes/month</li>
      <li>✓ Standard templates</li>
      <li>✓ Email support</li>
    </ul>
    <button>Subscribe to Basic</button>
  </div>
  
  <div class="plan-card pro featured">
    <div class="popular-badge">Most Popular</div>
    <h3>Pro Plan</h3>
    <div class="price">₱999/month</div>
    <ul class="features">
      <li>✓ Unlimited quotes</li>
      <li>✓ Premium templates</li>
      <li>✓ Priority support</li>
      <li>✓ Custom branding</li>
    </ul>
    <button>Subscribe to Pro</button>
  </div>
</div>
```

**Trial Reminder**
- "3-day free trial, then ₱499/month"
- "Cancel anytime during trial, no charges"
- "Subscribe now to start your trial"

**Success/Error Messaging**
- Success: "Subscription activated! Redirecting to dashboard..."
- Error: "Payment failed. Please try another payment method."
- Processing: "Setting up your subscription..."

**Access Denied Screen**

**Clean Landing Layout**
```html
<div class="access-denied-container">
  <div class="access-denied-card">
    <h2>Subscription Required</h2>
    <p>Your trial has ended or subscription needs renewal.</p>
    
    <div class="plan-options">
      <!-- Plan comparison table -->
    </div>
    
    <button class="cta-button">
      Subscribe Now to Continue
    </button>
    
    <div class="support-link">
      Need help? <a href="/support">Contact Support</a>
    </div>
  </div>
</div>
```

#### Mobile-First Design

**Responsive Layouts**
- Single column on mobile (< 768px)
- Side-by-side cards on desktop (≥ 768px)
- Touch-friendly buttons (min 44px height)
- Simplified navigation

**Mobile Optimizations**
- Bottom navigation for key actions
- Swipe gestures for plan comparison
- Progressive form enhancement
- Auto-save for multi-step processes

**Performance**
- Lazy load pricing components
- Optimize images and icons
- Minimize JavaScript bundle
- Cache API responses aggressively

### 5. Error Handling & Edge Cases

#### Webhook Processing

**Signature Verification Failures**
- Log detailed error with timestamp
- Return 401 Unauthorized
- Do not process webhook payload
- Alert monitoring system

**Duplicate Events**
- Check idempotency_key before processing
- Store processed event IDs in webhook_events table
- Skip if event already processed successfully
- Return 200 OK for duplicate events

**PayMongo API Downtime**
- Retry webhook processing with exponential backoff
- Store failed events in webhook_events table
- Background job retries failed events every 5 minutes
- Max 10 retry attempts before manual intervention

**Database Transaction Failures**
- Rollback all changes on error
- Log detailed error with stack trace
- Mark webhook event as failed with error message
- Return 500 Internal Server Error
- Alert on-call engineer

#### Payment Scenarios

**Payment Failed**
1. Receive payment.failed webhook
2. Set subscription.status = 'past_due'
3. Send email notification: "Payment failed - update payment method"
4. Show warning banner in UI
5. Allow read-only access
6. PayMongo auto-retries up to 3 times

**Payment Retried Automatically**
- PayMongo retries failed payments automatically
- Listen for payment.succeeded webhook after retry
- Update subscription status back to 'active'
- Send confirmation email
- Remove warning banners

**Max Retries Reached**
- After 3 failed payment attempts
- Set subscription.status = 'cancelled'
- Send final email: "Subscription cancelled due to payment failure"
- Revoke access after 7-day grace period
- Offer reactivation with new payment method

**Chargebacks**
- Handle chargeback.webhook events
- Set subscription.status = 'suspended'
- Immediately revoke access
- Alert support team for investigation
- Manual review required for reinstatement

#### Subscription Edge Cases

**Trial Abuse Prevention**
- One trial per company email domain
- Check existing subscriptions by email domain
- Block second trial attempts with friendly message
- Log blocked attempts for fraud detection

**Plan Downgrade Mid-Period**
- Calculate prorated credit: (remaining_days / total_days) * price_difference
- Apply credit as account balance immediately
- Downgrade plan for next billing period
- Send confirmation email with credit details

**Upgrade During Trial**
- End trial period immediately
- Charge full price for upgraded plan
- Prorate trial days used (if any)
- Activate new plan immediately
- Send upgrade confirmation

**Multiple Subscriptions Per Company**
- Enforce 1:1 relationship in database constraint
- Check existing active subscription before creating new one
- Return 409 Conflict if subscription already exists
- Offer upgrade/downgrade instead of new subscription

**Concurrent Modifications**
- Use SELECT FOR UPDATE on subscription rows
- Lock database row during webhook processing
- Prevent race conditions from concurrent webhooks
- Release lock after transaction completes

#### API Error Responses

**402 Payment Required**
```json
{
  "error": "Subscription required",
  "checkoutUrl": "/subscription/checkout",
  "reason": "Trial period ended",
  "plans": [
    { "name": "Basic", "price": 499, "currency": "PHP", "interval": "monthly" },
    { "name": "Pro", "price": 999, "currency": "PHP", "interval": "monthly" }
  ],
  "trialAvailable": false
}
```

**409 Conflict**
```json
{
  "error": "Subscription already exists",
  "reason": "You already have an active Basic subscription",
  "currentPlan": "Basic",
  "actions": ["upgrade", "cancel", "update_payment_method"]
}
```

**422 Unprocessable Entity**
```json
{
  "error": "Invalid plan selection",
  "reason": "Plan 'Enterprise' not found",
  "availablePlans": ["Basic", "Pro"],
  "documentation": "/api/docs#subscription-plans"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "requestId": "uuid-123-456",
  "timestamp": "2026-07-10T10:30:00Z",
  "support": "support@concettowc.com"
}
```

#### Recovery Mechanisms

**Webhook Replay**
- Store failed webhook events in webhook_events table
- Admin interface to retry failed webhooks
- Replay webhooks with original payload
- Log replay results

**Subscription Sync Job**
- Daily cron job: 00:00 UTC
- Fetch all subscriptions from PayMongo API
- Compare with database records
- Flag discrepancies for review
- Auto-fix minor inconsistencies
- Alert manual review for major issues

**Admin Override System**
- Emergency access codes for support
- Temporary 24-hour access tokens
- Bypass subscription checks with special header
- Audit log all admin overrides
- Requires 2-factor authentication

**Data Integrity Checks**
- Validate subscription vs database consistency
- Check: subscription.status == companies.subscription_status
- Verify: current_period_end matches invoice dates
- Ensure: orphaned records don't exist
- Weekly integrity reports

## Implementation Phases

### Phase 1: Database & Core Infrastructure
- Create subscription tables
- Add PayMongo integration
- Implement webhook processing
- Build helper functions

### Phase 2: API Routes & Access Control  
- Implement subscription API routes
- Add access control to existing routes
- Implement error handling
- Add logging and monitoring

### Phase 3: User Interface
- Build subscription management pages
- Create checkout flow
- Add warning banners and notifications
- Implement responsive design

### Phase 4: Testing & Deployment
- Unit tests for all components
- Integration tests with PayMongo test mode
- End-to-end testing of subscription flows
- Deploy to production with monitoring

## Security Considerations

- Webhook signature verification mandatory
- Database encryption for sensitive data
- Rate limiting on all subscription endpoints
- Audit logging for all subscription changes
- Regular security audits of payment integration
- Compliance with PCI DSS requirements through PayMongo

## Monitoring & Maintenance

- Webhook processing success rate
- Subscription conversion funnel metrics
- Payment failure rate tracking
- API response time monitoring
- Database query performance
- User engagement with subscription features

## Success Metrics

- Subscription conversion rate: Trial → Paid
- Payment success rate: >95%
- Webhook processing success rate: >99%
- User engagement with subscription management
- Support ticket reduction through self-service
- Revenue per user (ARPU) growth

---

**Design Status**: Approved by stakeholders  
**Next Steps**: Implementation planning with writing-plans skill  
**Timeline Estimate**: 3-4 weeks for complete implementation  
**Dependencies**: PayMongo account, test environment setup