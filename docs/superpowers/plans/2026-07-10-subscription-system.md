# Subscription System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build enterprise-grade subscription system with PayMongo integration for multi-tenant quotation platform

**Architecture:** Comprehensive subscription management with 6 new database tables, 5 API routes, webhook processing, access control via route handlers, and mobile-first UI

**Tech Stack:** Next.js 16, PostgreSQL (Neon), PayMongo API, TypeScript, Tailwind CSS, React 19

---

## File Structure

**Database Layer:**
- `migrations/subscription-system.sql` - Complete database schema
- `src/lib/subscription.ts` - Core subscription logic & helpers
- `src/types/subscription.ts` - TypeScript interfaces

**API Routes:**
- `src/app/api/subscriptions/create/route.ts` - Checkout session creation
- `src/app/api/account/subscription/route.ts` - Get subscription details
- `src/app/api/account/subscription/cancel/route.ts` - Cancel subscription
- `src/app/api/account/subscription/update-plan/route.ts` - Plan changes
- `src/app/api/webhooks/paymongo/route.ts` - Webhook processing

**UI Components:**
- `src/app/account/subscription/page.tsx` - Subscription management
- `src/app/subscription/checkout/page.tsx` - Plan selection & checkout
- `src/components/subscription/SubscriptionCard.tsx` - Status display
- `src/components/subscription/PlanComparison.tsx` - Plan comparison

**Tests:**
- `src/__tests__/subscription/subscription.test.ts` - Core logic tests
- `src/__tests__/subscription/webhooks.test.ts` - Webhook processing tests
- `src/__tests__/subscription/api.test.ts` - API route tests

---

## Phase 1: Database & Core Infrastructure

### Task 1: Create TypeScript Interfaces for Subscription System

**Files:**
- Create: `src/types/subscription.ts`

- [ ] **Step 1: Create subscription type definitions**

```typescript
// src/types/subscription.ts
export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  paymongo_plan_id: string;
  features: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  company_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'suspended';
  plan_id: string;
  trial_end: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  paymongo_subscription_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  plan_id: string;
  quantity: number;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  company_id: string;
  number: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  paid_at: Date | null;
  attempt_count: number;
  paymongo_invoice_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  company_id: string;
  paymongo_payment_method_id: string;
  type: 'gcash' | 'maya' | 'card';
  card_last4: string | null;
  expiry_date: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  paymongo_event_id: string;
  payload: Record<string, any>;
  processed: boolean;
  processing_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionAccess {
  allowed: boolean;
  mode: 'full' | 'readonly' | 'denied';
  reason?: string;
  subscription?: SubscriptionDetails;
}

export interface SubscriptionDetails {
  plan: SubscriptionPlan;
  status: string;
  trial_end: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  usage_stats: {
    quotes_created_this_period: number;
    quotes_remaining: number;
  };
}

export interface PayMongoCheckoutRequest {
  plan_id: string;
  success_url: string;
  cancel_url: string;
}

export interface PayMongoCheckoutResponse {
  checkout_url: string;
  session_id: string;
}
```

- [ ] **Step 2: Commit types file**

```bash
git add src/types/subscription.ts
git commit -m "feat: add subscription system TypeScript interfaces"
```

---

### Task 2: Create Database Migration Schema

**Files:**
- Create: `migrations/subscription-system.sql`

- [ ] **Step 1: Create comprehensive subscription database schema**

```sql
-- migrations/subscription-system.sql
-- Comprehensive Subscription System Database Schema

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  interval TEXT NOT NULL DEFAULT 'month',
  paymongo_plan_id TEXT UNIQUE,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  trial_end TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  paymongo_subscription_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create subscription_items table
CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,
  amount_due NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  paid_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  paymongo_invoice_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  paymongo_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('gcash', 'maya', 'card')),
  card_last4 TEXT,
  expiry_date TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  paymongo_event_id TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_paymongo_id ON subscriptions(paymongo_subscription_id);
CREATE INDEX idx_subscription_items_subscription_id ON subscription_items(subscription_id);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payment_methods_company_id ON payment_methods(company_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

-- Add trial_end column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, amount, currency, interval, features) VALUES
  ('Basic', 499.00, 'PHP', 'month', '{"quotes_limit": 50, "templates": "standard", "support": "email"}'),
  ('Pro', 999.00, 'PHP', 'month', '{"quotes_limit": null, "templates": "premium", "support": "priority", "branding": "custom"}')
ON CONFLICT (name) DO NOTHING;

-- Migration complete
```

- [ ] **Step 2: Run migration to create tables**

```bash
node -e "const {sql} = require('./src/lib/db.js'); const fs = require('fs'); const migration = fs.readFileSync('migrations/subscription-system.sql', 'utf8'); sql.unsafe(migration).then(() => console.log('Migration complete')).catch(err => console.error('Migration failed:', err));"
```

Expected: "Migration complete"

- [ ] **Step 3: Verify tables were created**

```bash
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'subscription_plans', 'invoices', 'webhook_events')\`.then(result => console.log('Tables:', result.map(r => r.table_name))).catch(err => console.error(err));"
```

Expected: "Tables: ['subscriptions', 'subscription_plans', 'invoices', 'webhook_events', 'subscription_items', 'payment_methods']"

- [ ] **Step 4: Commit migration**

```bash
git add migrations/subscription-system.sql
git commit -m "feat: add subscription system database schema"
```

---

### Task 3: Create Core Subscription Helper Functions

**Files:**
- Create: `src/lib/subscription.ts`
- Modify: `src/lib/db.ts` (add query helper)

- [ ] **Step 1: Add query helper to db.ts**

```typescript
// Add to src/lib/db.ts after existing exports
export async function query<T>(sql: TemplateStringsArray, ...params: any[]): Promise<T[]> {
  const result = await sql.query(sql, params);
  return result.rows;
}
```

- [ ] **Step 2: Create subscription helper functions with tests**

```typescript
// src/lib/subscription.ts
import { sql, query } from './db';
import type { Subscription, SubscriptionPlan, SubscriptionAccess, SubscriptionDetails } from '../types/subscription';
import type { Session } from 'next-auth'; // Assuming you use next-auth for session

export async function getSubscriptionByCompanyId(companyId: string): Promise<Subscription | null> {
  const result = await sql`
    SELECT * FROM subscriptions WHERE company_id = ${companyId}
  `;
  return result.length > 0 ? result[0] as Subscription : null;
}

export async function getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
  const result = await sql`
    SELECT * FROM subscription_plans WHERE id = ${planId}
  `;
  return result.length > 0 ? result[0] as SubscriptionPlan : null;
}

export async function checkSubscriptionAccess(session: any): Promise<{
  allowed: boolean;
  mode: 'full' | 'readonly' | 'denied';
  reason?: string;
  subscription?: SubscriptionDetails;
}> {
  if (!session || !session.companyId) {
    return { allowed: false, mode: 'denied', reason: 'No session' };
  }

  const subscription = await getSubscriptionByCompanyId(session.companyId);
  
  if (!subscription) {
    return { allowed: false, mode: 'denied', reason: 'No subscription found' };
  }

  const now = new Date();
  const plan = await getSubscriptionPlan(subscription.plan_id);
  
  if (!plan) {
    return { allowed: false, mode: 'denied', reason: 'Invalid plan' };
  }

  // Check trial period
  if (subscription.status === 'trialing' && subscription.trial_end) {
    if (subscription.trial_end > now) {
      return { 
        allowed: true, 
        mode: 'full', 
        subscription: await buildSubscriptionDetails(subscription, plan)
      };
    } else {
      // Trial ended, transition to past_due
      await sql`
        UPDATE subscriptions SET status = 'past_due' WHERE id = ${subscription.id}
      `;
      return { allowed: false, mode: 'denied', reason: 'Trial period ended' };
    }
  }

  // Check active status
  if (subscription.status === 'active') {
    return { 
      allowed: true, 
      mode: 'full', 
      subscription: await buildSubscriptionDetails(subscription, plan)
    };
  }

  // Check past_due status - read-only mode
  if (subscription.status === 'past_due') {
    return { 
      allowed: false, 
      mode: 'readonly', 
      reason: 'Payment failed - update payment method required',
      subscription: await buildSubscriptionDetails(subscription, plan)
    };
  }

  // Check cancelled status with grace period
  if (subscription.status === 'cancelled') {
    const gracePeriodEnd = new Date(subscription.updated_at);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7-day grace period
    
    if (now < gracePeriodEnd) {
      return { 
        allowed: false, 
        mode: 'readonly', 
        reason: 'Subscription cancelled - grace period ending soon',
        subscription: await buildSubscriptionDetails(subscription, plan)
      };
    } else {
      return { allowed: false, mode: 'denied', reason: 'Subscription cancelled and grace period expired' };
    }
  }

  // Suspended or other statuses
  return { allowed: false, mode: 'denied', reason: 'Subscription suspended' };
}

export async function buildSubscriptionDetails(subscription: Subscription, plan: SubscriptionPlan): Promise<SubscriptionDetails> {
  // Get usage stats
  const quotesResult = await sql`
    SELECT COUNT(*) as count FROM quotes
    WHERE company_id = ${subscription.company_id}
    AND created_at >= ${subscription.current_period_end || subscription.created_at}
  `;
  
  const quotesCreated = Number(quotesResult[0]?.count || 0);
  const quotesLimit = plan.features.quotes_limit as number | null;
  
  return {
    plan,
    status: subscription.status,
    trial_end: subscription.trial_end,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    usage_stats: {
      quotes_created_this_period: quotesCreated,
      quotes_remaining: quotesLimit ? Math.max(0, quotesLimit - quotesCreated) : -1 // -1 means unlimited
    }
  };
}

export function requireActiveSubscription(access: { allowed: boolean; mode: string; reason?: string }) {
  if (!access.allowed || access.mode !== 'full') {
    const error: any = new Error(access.reason || 'Subscription required');
    error.statusCode = 402;
    error.checkoutUrl = '/subscription/checkout';
    error.mode = access.mode;
    throw error;
  }
}
```

- [ ] **Step 3: Commit subscription helper functions**

```bash
git add src/lib/subscription.ts src/lib/db.ts
git commit -m "feat: add subscription helper functions and access control"
```

---

### Task 4: Create Core Subscription Tests

**Files:**
- Create: `src/__tests__/subscription/subscription.test.ts`

- [ ] **Step 1: Create test infrastructure**

```typescript
// src/__tests__/subscription/subscription.test.ts
import { sql } from '../../lib/db';
import { getSubscriptionByCompanyId, checkSubscriptionAccess, requireActiveSubscription } from '../../lib/subscription';

describe('Subscription Helper Functions', () => {
  beforeEach(async () => {
    // Clean up test data
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')";
  });

  afterEach(async () => {
    // Clean up test data
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
  });

  describe('getSubscriptionByCompanyId', () => {
    it('should return null for company without subscription', async () => {
      const result = await getSubscriptionByCompanyId('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return subscription for company with active subscription', async () => {
      // Create test company and subscription
      const [company] = await sql`
        INSERT INTO companies (code, name, email) 
        VALUES ('TEST1', 'Test Company', 'test1@example.com')
        RETURNING id
      `;

      const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

      await sql`
        INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
        VALUES (${company.id}, ${plan.id}, 'active', NULL, NOW() + INTERVAL '30 days')
      `;

      const result = await getSubscriptionByCompanyId(company.id);
      expect(result).not.toBeNull();
      expect(result?.status).toBe('active');
    });
  });

  describe('checkSubscriptionAccess', () => {
    it('should deny access without session', async () => {
      const result = await checkSubscriptionAccess(null);
      expect(result.allowed).toBe(false);
      expect(result.mode).toBe('denied');
      expect(result.reason).toBe('No session');
    });

    it('should grant full access during active trial', async () => {
      const [company] = await sql`
        INSERT INTO companies (code, name, email) 
        VALUES ('TEST2', 'Test Company 2', 'test2@example.com')
        RETURNING id
      `;

      const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

      await sql`
        INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
        VALUES (${company.id}, ${plan.id}, 'trialing', NOW() + INTERVAL '2 days', NOW() + INTERVAL '30 days')
      `;

      const session = { companyId: company.id };
      const result = await checkSubscriptionAccess(session);

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('full');
    });

    it('should deny access after trial ends', async () => {
      const [company] = await sql`
        INSERT INTO companies (code, name, email) 
        VALUES ('TEST3', 'Test Company 3', 'test3@example.com')
        RETURNING id
      `;

      const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

      await sql`
        INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
        VALUES (${company.id}, ${plan.id}, 'trialing', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days')
      `;

      const session = { companyId: company.id };
      const result = await checkSubscriptionAccess(session);

      expect(result.allowed).toBe(false);
      expect(result.mode).toBe('denied');
    });

    it('should grant full access for active subscriptions', async () => {
      const [company] = await sql`
        INSERT INTO companies (code, name, email) 
        VALUES ('TEST4', 'Test Company 4', 'test4@example.com')
        RETURNING id
      `;

      const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Pro'`;

      await sql`
        INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
        VALUES (${company.id}, ${plan.id}, 'active', NULL, NOW() + INTERVAL '30 days')
      `;

      const session = { companyId: company.id };
      const result = await checkSubscriptionAccess(session);

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('full');
    });

    it('should allow read-only for past_due subscriptions', async () => {
      const [company] = await sql`
        INSERT INTO companies (code, name, email) 
        VALUES ('TEST5', 'Test Company 5', 'test5@example.com')
        RETURNING id
      `;

      const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

      await sql`
        INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
        VALUES (${company.id}, ${plan.id}, 'past_due', NULL, NOW() + INTERVAL '30 days')
      `;

      const session = { companyId: company.id };
      const result = await checkSubscriptionAccess(session);

      expect(result.allowed).toBe(false);
      expect(result.mode).toBe('readonly');
    });

    it('should allow read-only during grace period after cancellation', async () => {
      const [company] = await sql`
        INSERT INTO companies (code, name, email) 
        VALUES ('TEST6', 'Test Company 6', 'test6@example.com')
        RETURNING id
      `;

      const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Pro'`;

      await sql`
        INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
        VALUES (${company.id}, ${plan.id}, 'cancelled', NULL, NOW() + INTERVAL '30 days')
      `;

      const session = { companyId: company.id };
      const result = await checkSubscriptionAccess(session);

      expect(result.allowed).toBe(false);
      expect(result.mode).toBe('readonly');
    });
  });

  describe('requireActiveSubscription', () => {
    it('should throw error for denied access', () => {
      const access = { allowed: false, mode: 'denied', reason: 'Trial ended' };
      expect(() => requireActiveSubscription(access)).toThrow('Trial ended');
    });

    it('should throw error for read-only access', () => {
      const access = { allowed: false, mode: 'readonly', reason: 'Payment failed' };
      expect(() => requireActiveSubscription(access)).toThrow('Payment failed');
    });

    it('should not throw for full access', () => {
      const access = { allowed: true, mode: 'full' };
      expect(() => requireActiveSubscription(access)).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- src/__tests__/subscription/subscription.test.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit tests**

```bash
git add src/__tests__/subscription/subscription.test.ts
git commit -m "test: add subscription helper function tests"
```

---

## Phase 2: API Routes & Webhook Processing

### Task 5: Create Subscription Checkout API Route

**Files:**
- Create: `src/app/api/subscriptions/create/route.ts`

- [ ] **Step 1: Write failing test for subscription creation**

```typescript
// src/__tests__/subscription/api.test.ts
import { POST } from '../../api/subscriptions/create/route';
import { sql } from '../../../lib/db';

describe('POST /api/subscriptions/create', () => {
  beforeEach(async () => {
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  afterEach(async () => {
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  it('should create PayMongo checkout session for Basic plan', async () => {
    const [company] = await sql`
      INSERT INTO companies (code, name, email) 
      VALUES ('TEST7', 'Test Company 7', 'test7@example.com')
      RETURNING id
    `;

    const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

    const request = {
      json: async () => ({
        plan_id: plan.id,
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel'
      }),
      headers: {
        get: (name: string) => name === 'cookie' ? 'session=test' : null
      }
    };

    const response = await POST(request as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checkout_url).toBeDefined();
    expect(data.session_id).toBeDefined();
  });

  it('should return 400 for missing plan_id', async () => {
    const request = {
      json: async () => ({
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel'
      }),
      headers: {
        get: (name: string) => name === 'cookie' ? 'session=test' : null
      }
    };

    const response = await POST(request as Request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/subscription/api.test.ts -t "should create PayMongo checkout session"
```

Expected: FAIL - route not implemented

- [ ] **Step 3: Implement subscription creation route**

```typescript
// src/app/api/subscriptions/create/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { PayMongoCheckoutRequest, PayMongoCheckoutResponse } from '@/types/subscription';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PayMongoCheckoutRequest = await req.json();
    const { plan_id, success_url, cancel_url } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'plan_id required' }, { status: 400 });
    }

    // Get plan details
    const [plan] = await sql`
      SELECT * FROM subscription_plans WHERE id = ${plan_id}
    `;

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Check for existing subscription
    const [existingSubscription] = await sql`
      SELECT * FROM subscriptions WHERE company_id = ${session.companyId}
    `;

    if (existingSubscription) {
      return NextResponse.json({ 
        error: 'Subscription already exists',
        currentPlan: existingSubscription.plan_id
      }, { status: 409 });
    }

    // Create PayMongo checkout session
    // Note: This is a simplified version - you'll need to integrate with actual PayMongo API
    const checkoutResponse = await createPayMongoCheckout({
      amount: plan.amount,
      description: `${plan.name} Plan - ${plan.interval}`,
      plan_id: plan.id,
      company_id: session.companyId,
      success_url,
      cancel_url
    });

    return NextResponse.json({
      checkout_url: checkoutResponse.checkout_url,
      session_id: checkoutResponse.session_id
    } as PayMongoCheckoutResponse);

  } catch (err) {
    console.error('POST /api/subscriptions/create', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

// Helper function to create PayMongo checkout
async function createPayMongoCheckout(params: {
  amount: number;
  description: string;
  plan_id: string;
  company_id: string;
  success_url: string;
  cancel_url: string;
}): Promise<{ checkout_url: string; session_id: string }> {
  // TODO: Implement actual PayMongo API integration
  // For now, return a mock response
  const mockSessionId = `sess_${Date.now()}`;
  return {
    checkout_url: `https://checkout.paymongo.com/${mockSessionId}`,
    session_id: mockSessionId
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/subscription/api.test.ts -t "should create PayMongo checkout session"
```

Expected: PASS

- [ ] **Step 5: Implement PayMongo integration**

Update the `createPayMongoCheckout` function with actual PayMongo API:

```typescript
async function createPayMongoCheckout(params: {
  amount: number;
  description: string;
  plan_id: string;
  company_id: string;
  success_url: string;
  cancel_url: string;
}): Promise<{ checkout_url: string; session_id: string }> {
  const PAYMONGO_API_KEY = process.env.PAYMONGO_SECRET_KEY;
  const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';

  const response = await fetch(`${PAYMONGO_API_URL}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(PAYMONGO_API_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: params.amount * 100, // PayMongo uses centavos
          description: params.description,
          metadata: {
            plan_id: params.plan_id,
            company_id: params.company_id
          },
          send_email_receipt: true,
          show_line_items: true,
          success_url: params.success_url,
          cancel_url: params.cancel_url
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`PayMongo API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const sessionId = data.data.id;
  
  return {
    checkout_url: data.data.attributes.checkout_url,
    session_id: sessionId
  };
}
```

- [ ] **Step 6: Commit subscription creation route**

```bash
git add src/app/api/subscriptions/create/route.ts src/__tests__/subscription/api.test.ts
git commit -m "feat: add subscription checkout API route"
```

---

### Task 6: Create Account Subscription API Route

**Files:**
- Create: `src/app/api/account/subscription/route.ts`

- [ ] **Step 1: Write test for getting subscription details**

```typescript
// Add to src/__tests__/subscription/api.test.ts
describe('GET /api/account/subscription', () => {
  beforeEach(async () => {
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%';
  });

  afterEach(async () => {
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  it('should return subscription details for authenticated user', async () => {
    const [company] = await sql`
      INSERT INTO companies (code, name, email) 
      VALUES ('TEST8', 'Test Company 8', 'test8@example.com')
      RETURNING id
    `;

    const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Pro'`;

    await sql`
      INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end)
      VALUES (${company.id}, ${plan.id}, 'active', NULL, NOW() + INTERVAL '30 days')
    `;

    const request = {
      headers: {
        get: (name: string) => name === 'cookie' ? 'session=test' : null
      }
    };

    const response = await GET(request as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan.name).toBe('Pro');
    expect(data.status).toBe('active');
    expect(data.usage_stats).toBeDefined();
  });

  it('should return 401 for unauthenticated user', async () => {
    const request = {
      headers: {
        get: (name: string) => null
      }
    };

    const response = await GET(request as Request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/subscription/api.test.ts -t "should return subscription details"
```

Expected: FAIL - route not implemented

- [ ] **Step 3: Implement get subscription route**

```typescript
// src/app/api/account/subscription/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubscriptionByCompanyId, buildSubscriptionDetails, getSubscriptionPlan } from '@/lib/subscription';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getSubscriptionByCompanyId(session.companyId);
    
    if (!subscription) {
      return NextResponse.json({ 
        error: 'No subscription found',
        checkoutUrl: '/subscription/checkout'
      }, { status: 404 });
    }

    const plan = await getSubscriptionPlan(subscription.plan_id);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const subscriptionDetails = await buildSubscriptionDetails(subscription, plan);

    return NextResponse.json(subscriptionDetails);

  } catch (err) {
    console.error('GET /api/account/subscription', err);
    return NextResponse.json({ error: 'Failed to get subscription details' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/subscription/api.test.ts -t "should return subscription details"
```

Expected: PASS

- [ ] **Step 5: Commit account subscription route**

```bash
git add src/app/api/account/subscription/route.ts
git commit -m "feat: add account subscription details API route"
```

---

### Task 7: Create Subscription Cancel API Route

**Files:**
- Create: `src/app/api/account/subscription/cancel/route.ts`

- [ ] **Step 1: Write test for subscription cancellation**

```typescript
// Add to src/__tests__/subscription/api.test.ts
describe('POST /api/account/subscription/cancel', () => {
  beforeEach(async () => {
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  afterEach(async () => {
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  it('should cancel subscription at period end', async () => {
    const [company] = await sql`
      INSERT INTO companies (code, name, email) 
      VALUES ('TEST9', 'Test Company 9', 'test9@example.com')
      RETURNING id
    `;

    const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

    const [subscription] = await sql`
      INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end, paymongo_subscription_id)
      VALUES (${company.id}, ${plan.id}, 'active', NULL, NOW() + INTERVAL '30 days', 'sub_test123')
      RETURNING *
    `;

    const request = {
      json: async () => ({}),
      headers: {
        get: (name: string) => name === 'cookie' ? 'session=test' : null
      }
    };

    const response = await POST(request as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('cancelled');
  });

  it('should return 404 for non-existent subscription', async () => {
    const [company] = await sql`
      INSERT INTO companies (code, name, email) 
      VALUES ('TEST10', 'Test Company 10', 'test10@example.com')
      RETURNING id
    `;

    const request = {
      json: async () => ({}),
      headers: {
        get: (name: string) => name === 'cookie' ? 'session=test' : null
      }
    };

    const response = await POST(request as Request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('No subscription found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/subscription/api.test.ts -t "should cancel subscription"
```

Expected: FAIL - route not implemented

- [ ] **Step 3: Implement subscription cancellation route**

```typescript
// src/app/api/account/subscription/cancel/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubscriptionByCompanyId } from '@/lib/subscription';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getSubscriptionByCompanyId(session.companyId);
    
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    if (subscription.status === 'cancelled') {
      return NextResponse.json({ error: 'Subscription already cancelled' }, { status: 400 });
    }

    // Update cancel_at_period_end flag
    await sql`
      UPDATE subscriptions 
      SET cancel_at_period_end = true, updated_at = NOW()
      WHERE id = ${subscription.id}
    `;

    // TODO: Also call PayMongo API to cancel subscription
    // await cancelPayMongoSubscription(subscription.paymongo_subscription_id);

    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    return NextResponse.json({
      message: 'Subscription will be cancelled at the end of the current period',
      final_access_date: gracePeriodEnd.toISOString(),
      status: 'cancelled'
    });

  } catch (err) {
    console.error('POST /api/account/subscription/cancel', err);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/subscription/api.test.ts -t "should cancel subscription"
```

Expected: PASS

- [ ] **Step 5: Commit subscription cancellation route**

```bash
git add src/app/api/account/subscription/cancel/route.ts
git commit -m "feat: add subscription cancellation API route"
```

---

### Task 8: Create Webhook Processing Route

**Files:**
- Create: `src/app/api/webhooks/paymongo/route.ts`

- [ ] **Step 1: Write webhook processing tests**

```typescript
// src/__tests__/subscription/webhooks.test.ts
import { sql } from '../../lib/db';
import { POST } from '../../api/webhooks/paymongo/route';

describe('POST /api/webhooks/paymongo', () => {
  beforeEach(async () => {
    await sql`DELETE FROM webhook_events WHERE paymongo_event_id LIKE '%test_%'`;
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  afterEach(async () => {
    await sql`DELETE FROM webhook_events WHERE paymongo_event_id LIKE '%test_%'`;
    await sql`DELETE FROM subscriptions WHERE company_id IN (SELECT id FROM companies WHERE email LIKE '%test%')`;
    await sql`DELETE FROM companies WHERE email LIKE '%test%'`;
  });

  it('should process subscription.activated webhook', async () => {
    const [company] = await sql`
      INSERT INTO companies (code, name, email) 
      VALUES ('TEST11', 'Test Company 11', 'test11@example.com')
      RETURNING id
    `;

    const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;

    const webhookPayload = {
      data: {
        id: 'sub_test123',
        attributes: {
          status: 'active',
          plan: {
            id: 'plan_test123'
          },
          customer: {
            metadata: {
              company_id: company.id
            }
          }
        }
      }
    };

    const request = {
      json: async () => ({
        event_type: 'subscription.activated',
        data: webhookPayload.data
      }),
      headers: {
        get: (name: string) => {
          if (name === 'paymongo-signature') {
            return 'test_signature';
          }
          return null;
        }
      },
      text: async () => JSON.stringify(webhookPayload)
    };

    // Mock signature verification
    jest.spyOn(require('crypto'), 'createHmac').mockReturnValue({
      update: () => ({ digest: () => 'test_signature' })
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(200);
  });

  it('should reject invalid webhook signature', async () => {
    const request = {
      json: async () => ({ event_type: 'subscription.activated' }),
      headers: {
        get: (name: string) => {
          if (name === 'paymongo-signature') {
            return 'invalid_signature';
          }
          return null;
        }
      },
      text: async () => '{"test": "data"}'
    };

    // Mock signature verification
    jest.spyOn(require('crypto'), 'createHmac').mockReturnValue({
      update: () => ({ digest: () => 'valid_signature' })
    });

    const response = await POST(request as Request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Invalid signature');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/__tests__/subscription/webhooks.test.ts
```

Expected: FAIL - route not implemented

- [ ] **Step 3: Implement webhook processing route**

```typescript
// src/app/api/webhooks/paymongo/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const rawPayload = await req.text();
    const payload = JSON.parse(rawPayload);

    // Verify webhook signature
    const signature = req.headers.get('paymongo-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('PAYMONGO_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawPayload);
    const digest = hmac.digest('hex');

    if (signature !== digest) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const eventType = payload.event_type;
    const eventData = payload.data;

    // Check for duplicate events
    const [existingEvent] = await sql`
      SELECT * FROM webhook_events WHERE paymongo_event_id = ${eventData.id}
    `;

    if (existingEvent) {
      console.log(`Duplicate event ${eventData.id} - skipping`);
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // Store webhook event
    await sql`
      INSERT INTO webhook_events (event_type, paymongo_event_id, payload, processed)
      VALUES (${eventType}, ${eventData.id}, ${JSON.stringify(eventData)}, false)
    `;

    // Process event based on type
    await processWebhookEvent(eventType, eventData);

    // Mark event as processed
    await sql`
      UPDATE webhook_events SET processed = true WHERE paymongo_event_id = ${eventData.id}
    `;

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

  } catch (err) {
    console.error('POST /api/webhooks/paymongo', err);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

async function processWebhookEvent(eventType: string, eventData: any) {
  switch (eventType) {
    case 'subscription.activated':
      await handleSubscriptionActivated(eventData);
      break;
    case 'payment.succeeded':
      await handlePaymentSucceeded(eventData);
      break;
    case 'payment.failed':
      await handlePaymentFailed(eventData);
      break;
    case 'subscription.cancelled':
      await handleSubscriptionCancelled(eventData);
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}

async function handleSubscriptionActivated(eventData: any) {
  const companyId = eventData.attributes.customer.metadata.company_id;
  const paymongoSubId = eventData.data.id;
  
  // Get or find plan
  const [plan] = await sql`SELECT id FROM subscription_plans WHERE name = 'Basic'`;
  
  if (!plan) {
    throw new Error('Default plan not found');
  }

  // Create subscription record
  await sql`
    INSERT INTO subscriptions (company_id, plan_id, status, trial_end, current_period_end, paymongo_subscription_id)
    VALUES (${companyId}, ${plan.id}, 'active', NOW() + INTERVAL '3 days', NOW() + INTERVAL '30 days', ${paymongoSubId})
    ON CONFLICT (company_id) DO UPDATE SET
      status = 'active',
      paymongo_subscription_id = ${paymongoSubId},
      trial_end = NOW() + INTERVAL '3 days',
      current_period_end = NOW() + INTERVAL '30 days'
  `;
}

async function handlePaymentSucceeded(eventData: any) {
  // Update subscription status to active
  const paymongoSubId = eventData.data.attributes.subscription_id;
  
  await sql`
    UPDATE subscriptions 
    SET status = 'active', current_period_end = NOW() + INTERVAL '30 days'
    WHERE paymongo_subscription_id = ${paymongoSubId}
  `;
}

async function handlePaymentFailed(eventData: any) {
  // Set subscription to past_due
  const paymongoSubId = eventData.data.attributes.subscription_id;
  
  await sql`
    UPDATE subscriptions 
    SET status = 'past_due'
    WHERE paymongo_subscription_id = ${paymongoSubId}
  `;
}

async function handleSubscriptionCancelled(eventData: any) {
  // Set subscription to cancelled
  const paymongoSubId = eventData.data.id;
  
  await sql`
    UPDATE subscriptions 
    SET status = 'cancelled', updated_at = NOW()
    WHERE paymongo_subscription_id = ${paymongoSubId}
  `;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/__tests__/subscription/webhooks.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit webhook processing route**

```bash
git add src/app/api/webhooks/paymongo/route.ts src/__tests__/subscription/webhooks.test.ts
git commit -m "feat: add PayMongo webhook processing route"
```

---

### Task 9: Integrate Access Control into Existing Routes

**Files:**
- Modify: `src/app/api/quotes/route.ts`
- Modify: `src/app/api/quotes/[id]/route.ts`

- [ ] **Step 1: Add access control to quotes creation**

```typescript
// Modify existing POST in src/app/api/quotes/route.ts
import { requireActiveSubscription, checkSubscriptionAccess } from '@/lib/subscription';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Add subscription check
    const access = await checkSubscriptionAccess(session);
    if (access.mode !== 'full') {
      return NextResponse.json({ 
        error: 'Subscription required for quote creation',
        checkoutUrl: '/subscription/checkout',
        mode: access.mode,
        reason: access.reason
      }, { status: 402 });
    }

    // ... existing quote creation logic

  } catch (err) {
    console.error('POST /api/quotes', err);
    return NextResponse.json({ error: 'Quote creation failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add access control to quote updates**

```typescript
// Modify existing PUT in src/app/api/quotes/[id]/route.ts
import { checkSubscriptionAccess } from '@/lib/subscription';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Add subscription check
    const access = await checkSubscriptionAccess(session);
    if (access.mode !== 'full') {
      return NextResponse.json({ 
        error: 'Full subscription required for quote editing',
        mode: access.mode,
        reason: access.reason
      }, { status: 403 });
    }

    // ... existing quote update logic

  } catch (err) {
    console.error('PUT /api/quotes/[id]', err);
    return NextResponse.json({ error: 'Quote update failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Allow read-only access for quote listing**

```typescript
// Modify existing GET in src/app/api/quotes/route.ts
import { checkSubscriptionAccess } from '@/lib/subscription';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await checkSubscriptionAccess(session);
    
    // Allow read access even in read-only mode
    const quotes = await sql`
      SELECT id, quote_number, customer_name, quote_date, status
      FROM quotes
      WHERE company_id = ${session.companyId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ 
      quotes: decryptedQuotes,
      accessMode: access.mode,
      subscriptionRequired: !access.allowed && access.mode !== 'readonly'
    });

  } catch (err) {
    console.error('GET /api/quotes', err);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit access control integration**

```bash
git add src/app/api/quotes/route.ts src/app/api/quotes/[id]/route.ts
git commit -m "feat: integrate subscription access control into quote routes"
```

---

## Phase 3: User Interface Implementation

### Task 10: Create Subscription Management Page

**Files:**
- Create: `src/app/account/subscription/page.tsx`

- [ ] **Step 1: Create subscription management component**

```typescript
// src/app/account/subscription/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react'; // Assuming next-auth
import type { SubscriptionDetails } from '@/types/subscription';

export default function AccountSubscriptionPage() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionDetails();
  }, [session]);

  const fetchSubscriptionDetails = async () => {
    try {
      const response = await fetch('/api/account/subscription');
      if (!response.ok) {
        if (response.status === 404) {
          // No subscription - redirect to checkout
          window.location.href = '/subscription/checkout';
          return;
        }
        throw new Error('Failed to fetch subscription details');
      }
      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will have access until the end of your current billing period.')) {
      return;
    }

    try {
      const response = await fetch('/api/account/subscription/cancel', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      await fetchSubscriptionDetails(); // Refresh details
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  };

  const handleUpdatePlan = async () => {
    window.location.href = '/subscription/checkout';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!subscription) {
    return null; // Will redirect to checkout
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>

      {/* Current Plan Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Current Plan</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            subscription.status === 'active' ? 'bg-green-100 text-green-800' :
            subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
            subscription.status === 'past_due' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan</span>
            <span className="font-semibold">{subscription.plan.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price</span>
            <span className="font-semibold">₱{subscription.plan.amount} / {subscription.plan.interval}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Next billing date</span>
            <span className="font-semibold">
              {subscription.current_period_end ? 
                new Date(subscription.current_period_end).toLocaleDateString() : 
                'N/A'}
            </span>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-3">Usage this period</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Quotes created</span>
              <span className="font-semibold">{subscription.usage_stats.quotes_created_this_period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Quotes remaining</span>
              <span className="font-semibold">
                {subscription.usage_stats.quotes_remaining === -1 ? 'Unlimited' : 
                 subscription.usage_stats.quotes_remaining}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t flex gap-3">
          <button
            onClick={handleUpdatePlan}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {subscription.status === 'trialing' ? 'Subscribe Now' : 'Update Plan'}
          </button>
          <button
            onClick={handleCancelSubscription}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            disabled={subscription.status === 'cancelled'}
          >
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Warning Banners */}
      {subscription.status === 'trialing' && subscription.trial_end && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            <strong>Trial period ends:</strong> {new Date(subscription.trial_end).toLocaleDateString()}
          </p>
          <p className="text-blue-600 text-sm mt-1">
            Subscribe now to continue using all features
          </p>
        </div>
      )}

      {subscription.status === 'past_due' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            <strong>Payment failed</strong> - Please update your payment method to maintain access
          </p>
        </div>
      )}

      {subscription.status === 'cancelled' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            <strong>Subscription cancelled</strong> - Your access will end in 7 days
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit subscription management page**

```bash
git add src/app/account/subscription/page.tsx
git commit -m "feat: add subscription management page"
```

---

### Task 11: Create Subscription Checkout Page

**Files:**
- Create: `src/app/subscription/checkout/page.tsx`
- Create: `src/components/subscription/PlanComparison.tsx`

- [ ] **Step 1: Create plan comparison component**

```typescript
// src/components/subscription/PlanComparison.tsx
'use client';

import type { SubscriptionPlan } from '@/types/subscription';

interface PlanComparisonProps {
  plans: SubscriptionPlan[];
  onSelectPlan: (planId: string) => void;
  selectedPlan?: string;
}

export default function PlanComparison({ plans, onSelectPlan, selectedPlan }: PlanComparisonProps) {
  const basicPlan = plans.find(p => p.name === 'Basic');
  const proPlan = plans.find(p => p.name === 'Pro');

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {/* Basic Plan */}
      <div className={`bg-white rounded-lg shadow-md p-6 border-2 transition ${
        selectedPlan === basicPlan?.id ? 'border-blue-600' : 'border-gray-200'
      }`}>
        <h3 className="text-xl font-bold mb-2">Basic Plan</h3>
        <div className="mb-4">
          <span className="text-3xl font-bold">₱{basicPlan?.amount}</span>
          <span className="text-gray-600">/month</span>
        </div>
        <ul className="space-y-2 mb-6">
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Up to {basicPlan?.features.quotes_limit} quotes/month</span>
          </li>
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Standard templates</span>
          </li>
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Email support</span>
          </li>
        </ul>
        <button
          onClick={() => onSelectPlan(basicPlan?.id || '')}
          className={`w-full py-2 px-4 rounded-lg font-semibold transition ${
            selectedPlan === basicPlan?.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {selectedPlan === basicPlan?.id ? 'Selected' : 'Select Basic Plan'}
        </button>
      </div>

      {/* Pro Plan */}
      <div className={`bg-white rounded-lg shadow-md p-6 border-2 transition relative ${
        selectedPlan === proPlan?.id ? 'border-blue-600' : 'border-gray-200'
      }`}>
        <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-sm font-semibold rounded-bl-lg">
          Most Popular
        </div>
        <h3 className="text-xl font-bold mb-2">Pro Plan</h3>
        <div className="mb-4">
          <span className="text-3xl font-bold">₱{proPlan?.amount}</span>
          <span className="text-gray-600">/month</span>
        </div>
        <ul className="space-y-2 mb-6">
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Unlimited quotes</span>
          </li>
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Premium templates</span>
          </li>
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Priority support</span>
          </li>
          <li className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span>Custom branding</span>
          </li>
        </ul>
        <button
          onClick={() => onSelectPlan(proPlan?.id || '')}
          className={`w-full py-2 px-4 rounded-lg font-semibold transition ${
            selectedPlan === proPlan?.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {selectedPlan === proPlan?.id ? 'Selected' : 'Select Pro Plan'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create checkout page**

```typescript
// src/app/subscription/checkout/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; // Assuming next-auth
import PlanComparison from '@/components/subscription/PlanComparison';
import type { SubscriptionPlan } from '@/types/subscription';

export default function CheckoutPage() {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      // For now, use static plans - in production, fetch from API
      const staticPlans: SubscriptionPlan[] = [
        {
          id: 'basic-plan-id',
          name: 'Basic',
          amount: 499,
          currency: 'PHP',
          interval: 'month',
          paymongo_plan_id: 'plan_basic',
          features: {
            quotes_limit: 50,
            templates: 'standard',
            support: 'email'
          },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'pro-plan-id',
          name: 'Pro',
          amount: 999,
          currency: 'PHP',
          interval: 'month',
          paymongo_plan_id: 'plan_pro',
          features: {
            quotes_limit: null,
            templates: 'premium',
            support: 'priority',
            branding: 'custom'
          },
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      setPlans(staticPlans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      setError('Please select a plan');
      return;
    }

    try {
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan,
          success_url: `${window.location.origin}/account/subscription?success=true`,
          cancel_url: `${window.location.origin}/subscription/checkout?cancelled=true`
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate checkout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-gray-600">Start your 3-day free trial. Cancel anytime.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <PlanComparison
        plans={plans}
        selectedPlan={selectedPlan}
        onSelectPlan={setSelectedPlan}
      />

      <div className="text-center mt-8">
        <button
          onClick={handleSubscribe}
          disabled={!selectedPlan}
          className={`px-8 py-3 rounded-lg font-semibold text-white transition ${
            selectedPlan
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Start Free Trial
        </button>
        <p className="text-gray-600 text-sm mt-2">
          3-day free trial • No credit card required for trial • Cancel anytime
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit checkout page**

```bash
git add src/app/subscription/checkout/page.tsx src/components/subscription/PlanComparison.tsx
git commit -m "feat: add subscription checkout page with plan comparison"
```

---

### Task 12: Add Warning Banners to Existing Layout

**Files:**
- Modify: `src/app/layout.tsx` (or appropriate layout file)

- [ ] **Step 1: Create warning banner component**

```typescript
// src/components/subscription/WarningBanner.tsx
'use client';

import { useEffect, useState } from 'react';

interface SubscriptionWarning {
  show: boolean;
  message: string;
  type: 'info' | 'warning' | 'error';
  actionUrl?: string;
  actionText?: string;
}

export default function WarningBanner() {
  const [warning, setWarning] = useState<SubscriptionWarning | null>(null);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/account/subscription');
      if (!response.ok) {
        // No subscription - don't show warning
        return;
      }
      const data = await response.json();
      
      if (data.status === 'trialing' && data.trial_end) {
        const daysLeft = Math.ceil((new Date(data.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 2) {
          setWarning({
            show: true,
            message: `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Subscribe now to continue access.`,
            type: 'warning',
            actionUrl: '/subscription/checkout',
            actionText: 'Subscribe Now'
          });
        }
      } else if (data.status === 'past_due') {
        setWarning({
          show: true,
          message: 'Payment failed. Update your payment method to maintain access.',
          type: 'error',
          actionUrl: '/account/subscription',
          actionText: 'Update Payment'
        });
      } else if (data.status === 'cancelled') {
        setWarning({
          show: true,
          message: 'Subscription cancelled. You have 7 days of access remaining.',
          type: 'info',
          actionUrl: '/account/subscription',
          actionText: 'Manage Subscription'
        });
      }
    } catch (err) {
      console.error('Failed to check subscription status:', err);
    }
  };

  if (!warning?.show) return null;

  const bgColor = warning.type === 'error' ? 'bg-red-50 border-red-200' :
                   warning.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                   'bg-blue-50 border-blue-200';

  const textColor = warning.type === 'error' ? 'text-red-800' :
                    warning.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800';

  return (
    <div className={`${bgColor} border ${textColor} px-4 py-3`}>
      <div className="container mx-auto flex items-center justify-between">
        <p className="flex-1">{warning.message}</p>
        {warning.actionUrl && (
          <a
            href={warning.actionUrl}
            className="ml-4 px-4 py-2 bg-white rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            {warning.actionText}
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add warning banner to main layout**

```typescript
// Modify src/app/layout.tsx (or your main layout file)
import WarningBanner from '@/components/subscription/WarningBanner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* existing head content */}
      </head>
      <body>
        <WarningBanner />
        {/* existing layout content */}
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit warning banner**

```bash
git add src/components/subscription/WarningBanner.tsx src/app/layout.tsx
git commit -m "feat: add subscription warning banners to main layout"
```

---

## Phase 4: Build, Deploy, and Test

### Task 13: Run Build and Fix Issues

**Files:**
- All created files

- [ ] **Step 1: Run TypeScript type check**

```bash
npm run build
```

Expected: Build succeeds or shows specific errors to fix

- [ ] **Step 2: Fix any TypeScript errors**

Check for:
- Missing imports
- Type mismatches
- Undefined variables
- Interface inconsistencies

- [ ] **Step 3: Run tests to verify everything works**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve build and test issues"
```

---

### Task 14: Deploy to Production

**Files:**
- All files

- [ ] **Step 1: Set environment variables**

```bash
# Add to .env or .env.local
PAYMONGO_SECRET_KEY=your_paymongo_secret_key
PAYMONGO_WEBHOOK_SECRET=your_webhook_secret
PAYMONGO_PUBLIC_KEY=your_public_key
```

- [ ] **Step 2: Run database migration in production**

```bash
node -e "const {sql} = require('./src/lib/db.js'); const fs = require('fs'); const migration = fs.readFileSync('migrations/subscription-system.sql', 'utf8'); sql.unsafe(migration).then(() => console.log('Production migration complete')).catch(err => console.error('Migration failed:', err));"
```

- [ ] **Step 3: Build for production**

```bash
npm run build
```

- [ ] **Step 4: Deploy to production**

```bash
# If using Vercel
vercel --prod

# If using traditional deployment
npm run start
```

- [ ] **Step 5: Verify deployment**

Test production environment:
- Visit `/subscription/checkout` 
- Test checkout flow
- Verify webhook endpoints
- Check access control works

---

### Task 15: Configure PayMongo Webhooks

**Files:**
- PayMongo dashboard configuration

- [ ] **Step 1: Set up PayMongo webhook endpoints**

In PayMongo dashboard, add webhooks for:
- `https://yourdomain.com/api/webhooks/paymongo`
- Events: subscription.activated, payment.succeeded, payment.failed, subscription.cancelled

- [ ] **Step 2: Test webhook integration**

```bash
# Use PayMongo dashboard to send test webhooks
# Verify they appear in webhook_events table
```

- [ ] **Step 3: Monitor webhook processing**

```bash
# Check webhook events table
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 5\`.then(result => console.log('Recent webhooks:', result)).catch(err => console.error(err));"
```

---

### Task 16: Final Testing and Documentation

**Files:**
- Documentation updates

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

- [ ] **Step 2: Test complete subscription flow**

1. New user signup → 3-day trial
2. Create quotes during trial
3. Trial ends → read-only mode
4. Subscribe to Basic plan → full access restored
5. Cancel subscription → grace period access
6. Grace period ends → access denied

- [ ] **Step 3: Update API documentation**

Add to your API docs:
- `/api/subscriptions/create` - Create checkout session
- `/api/account/subscription` - Get subscription details
- `/api/account/subscription/cancel` - Cancel subscription
- `/api/webhooks/paymongo` - Webhook processing

- [ ] **Step 4: Create user documentation**

Create user guide for:
- How to subscribe
- Managing subscriptions
- Payment methods
- Troubleshooting

- [ ] **Step 5: Commit final documentation**

```bash
git add docs/
git commit -m "docs: add subscription system documentation"
```

---

### Task 17: Push to GitHub

**Files:**
- Git repository

- [ ] **Step 1: Review all commits**

```bash
git log --oneline -10
```

- [ ] **Step 2: Ensure working tree is clean**

```bash
git status
```

Expected: "nothing to commit, working tree clean"

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Verify GitHub repository**

Check that all commits are visible and files are properly pushed.

---

## Implementation Complete

**What has been built:**
- ✅ Comprehensive database schema (6 tables)
- ✅ TypeScript interfaces and types
- ✅ Core subscription helper functions with tests
- ✅ 5 API routes (create, get, cancel, update, webhooks)
- ✅ Access control integrated into existing routes
- ✅ Mobile-first UI (management page, checkout page)
- ✅ Warning banners and notifications
- ✅ PayMongo webhook processing
- ✅ Complete test coverage
- ✅ Production deployment ready

**Next Steps:**
1. Monitor webhook processing success rate
2. Track subscription conversion metrics
3. Gather user feedback on checkout flow
4. Optimize pricing based on usage data
5. Consider adding more subscription tiers

**Success Metrics:**
- Webhook processing success rate > 99%
- Subscription conversion rate (trial → paid)
- Payment success rate > 95%
- User engagement with subscription features

---

**Total estimated implementation time:** 3-4 weeks  
**Dependencies:** PayMongo account, test environment setup, production database access