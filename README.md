# Concetto Window Blinds — Invoicing App

A Next.js 14 app for managing window blinds quotes and supplier purchase orders.  
Stack: **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Neon (PostgreSQL) · Vercel**

---

## Features

- **Product database** — store blind codes, collections, supplier cost, and retail price per sq.ft.
- **Quote builder** — add windows by location, look up product codes instantly, enter measurements in inches or cm, toggle fixed vs. non-fixed (auto-adds 6in / 15cm overlap)
- **Auto-calculations** — final size, area in sq.ft., retail amount per panel, totals
- **Two print outputs** (8.5 × 11 inch, letter):
  - **Customer Quotation** — final size + retail pricing
  - **Supplier Purchase Order** — measured size + final size + supplier cost
- **Settings** — editable company info, terms, DEL note, closing note
- **Demo watermark protection** — subscription-based watermarking for trial/demo accounts
- **Subscription system** — Enterprise-grade subscription management with PayMongo payment gateway
  - Two subscription tiers (Basic ₱499/month, Pro ₱999/month)
  - 3-day trial periods with automatic conversion
  - Access control based on subscription status
  - Mobile-first subscription management UI
  - Real-time webhook processing for payment events
- **Admin Panel Integration** — Comprehensive admin interface for payment and subscription management
  - Payment settings configuration with term-specific discount rates
  - Promo code management with usage tracking and QR code support
  - Payment verification interface with webhook data comparison
  - QR code system for payment methods and promo campaigns
  - Real-time payment proof validation and admin actions
- **UUID primary keys** throughout — safe for distributed use and future API expansion

---

## Local development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd concetto-blinds
npm install
```

### 2. Create a Neon database

1. Go to [https://neon.tech](https://neon.tech) and sign up (free tier is enough)
2. Create a new project — e.g. **concetto-blinds**
3. Copy the **Connection string** (looks like `postgres://user:pass@host/dbname?sslmode=require`)

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

### 4. Run database migrations

```bash
npm run db:migrate
```

This creates all tables (`settings`, `products`, `quotes`, `quote_items`) with UUID primary keys and seeds default settings.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/concetto-blinds.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [https://vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** — it will fail on first deploy because the env var isn't set yet, that's OK

### 3. Add environment variable in Vercel

1. Go to your project → **Settings → Environment Variables**
2. Add:
   - **Name:** `DATABASE_URL`
   - **Value:** your Neon connection string
   - **Environments:** Production, Preview, Development
3. Click **Save**

### 4. Redeploy

Go to **Deployments** → click the three dots on the latest deployment → **Redeploy**

### 5. Run migrations on the production database

You only need to do this once. From your local machine (with `.env.local` pointing to the same Neon DB):

```bash
npm run db:migrate
```

Or run it directly with the production URL:

```bash
DATABASE_URL="postgres://..." node src/lib/migrate.js
```

---

## Database schema

All tables use `gen_random_uuid()` (via the `pgcrypto` extension) for primary keys.

| Table | Description |
|---|---|
| `settings` | Single-row company info and document text |
| `products` | Blind product codes with supplier cost and retail price |
| `quotes` | Quote header — customer, date, totals, status |
| `quote_items` | Each window panel in a quote, with measured + final sizes, areas, amounts |
| `subscriptions` | Subscription lifecycle tracking with PayMongo integration |
| `subscription_plans` | Plan definitions (Basic ₱499, Pro ₱999) |
| `subscription_items` | Line items per subscription |
| `invoices` | Billing invoices and payment tracking |
| `payment_methods` | Stored payment methods (GCash, Maya, cards) |
| `webhook_events` | Event log for PayMongo webhooks |

### Key relationships

```
quotes (id UUID PK)
  └── quote_items (quote_id UUID FK → quotes.id ON DELETE CASCADE)
        └── product_id UUID FK → products.id ON DELETE SET NULL

subscriptions (id UUID PK)
  ├── company_id UUID FK → companies.id ON DELETE CASCADE
  ├── plan_id UUID FK → subscription_plans.id
  ├── subscription_items (subscription_id UUID FK → subscriptions.id)
  └── invoices (subscription_id UUID FK → subscriptions.id ON DELETE SET NULL)
```

`ON DELETE CASCADE` on `quote_items` means deleting a quote also deletes all its items.  
`ON DELETE SET NULL` on `product_id` means deleting a product doesn't delete historical quote items — the product code and description are stored directly on the item row for this reason.

The subscription system maintains a 1:1 relationship between companies and subscriptions via the `company_id` foreign key in the `subscriptions` table.

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── products/
│   │   │   ├── route.ts          # GET all, POST create/update
│   │   │   ├── [id]/route.ts     # GET one, DELETE (soft)
│   │   │   └── lookup/route.ts   # GET by code (for quote form)
│   │   ├── quotes/
│   │   │   ├── route.ts          # GET all, POST create
│   │   │   └── [id]/route.ts     # GET with items, PUT update, DELETE
│   │   ├── subscriptions/
│   │   │   └── create/route.ts   # POST create checkout session
│   │   ├── account/
│   │   │   └── subscription/
│   │   │       ├── route.ts      # GET subscription details
│   │   │       └── cancel/route.ts # POST cancel subscription
│   │   ├── webhooks/
│   │   │   └── paymongo/route.ts # POST process payment webhooks
│   │   └── settings/route.ts     # GET, PUT
│   ├── quotes/
│   │   ├── page.tsx              # Quotes list
│   │   ├── new/page.tsx          # New quote form
│   │   └── [id]/page.tsx         # Edit quote + print preview
│   ├── subscription/
│   │   └── checkout/page.tsx     # Plan selection & checkout
│   ├── account/
│   │   └── subscription/page.tsx # Subscription management
│   ├── products/page.tsx         # Product management
│   ├── settings/page.tsx         # Settings
│   ├── layout.tsx
│   ├── page.tsx                  # Redirects to /quotes
│   └── globals.css
├── components/
│   ├── AppLayout.tsx             # Sidebar navigation shell
│   ├── QuoteForm.tsx             # Shared new/edit quote form
│   ├── PrintDoc.tsx              # Printable quotation / PO layout
│   └── subscription/
│       ├── PlanComparison.tsx    # Subscription plan comparison
│       └── WarningBanner.tsx    # Subscription status warnings
├── lib/
│   ├── db.ts                     # Neon SQL client
│   ├── calc.ts                   # Shared calculation helpers
│   ├── subscription.ts           # Subscription logic & helpers
│   └── migrate.js                # One-time DB migration script
├── types/
│   ├── index.ts                  # Shared TypeScript types
│   └── subscription.ts           # Subscription-specific types
└── __tests__/
    └── subscription/
        └── subscription.test.ts  # Subscription logic tests (55 tests)
```

---

## Calculation logic

| Scenario | Width | Drop |
|---|---|---|
| Fixed = Yes | as entered | as entered |
| Fixed = No (inches) | + 6 in | + 6 in |
| Fixed = No (cm) | + 15 cm | + 15 cm |

Area (sq.ft.) = `(final_width_in × final_drop_in) / 144`

All measurements entered in cm are converted to inches before the area calculation.

---

## Printing

Navigate to `/quotes/[id]?print=quotation` or `/quotes/[id]?print=po` to open the print preview page, then use the browser's print dialog (Ctrl+P / Cmd+P). The layout is set to **letter (8.5 × 11 in)** via `@page` CSS.

---

## Subscription System

The app includes a comprehensive subscription system with PayMongo payment integration for managing user access and billing.

### Subscription Features

**Two Subscription Tiers:**
- **Basic Plan (₱499/month)**: Up to 50 quotes/month, standard templates, email support
- **Pro Plan (₱999/month)**: Unlimited quotes, premium templates, priority support, custom branding

**Key Capabilities:**
- 3-day free trial with full functionality
- Automatic trial conversion or read-only mode
- Mobile-first subscription management interface
- Real-time payment processing via PayMongo (GCash, Maya, cards)
- Webhook-based subscription status synchronization
- Graceful access control with read-only mode for payment issues
- Comprehensive subscription management (upgrade, cancel, payment methods)

### Access Control

Subscription status controls access to creating and editing quotes:

| Subscription Status | Create/Edit Quotes | View Quotes | Notes |
|---|---|---|---|
| `trialing` | ✅ Full access | ✅ Full access | During 3-day trial period |
| `active` | ✅ Full access | ✅ Full access | Active paying subscription |
| `past_due` | ❌ Read-only | ✅ Read-only | Payment failed (grace period) |
| `cancelled` | ❌ Denied | ✅ Read-only | 7-day grace period after cancellation |
| `suspended` | ❌ Denied | ❌ Denied | Account suspended |

### Subscription Management

**User Management:**
- `/subscription/checkout` - Plan selection and checkout
- `/account/subscription` - View current plan, usage, billing info
- Upgrade/downgrade plans
- Cancel subscription with grace period
- Update payment methods

**Admin/Developer Management:**
- Database: Direct subscription management via `subscriptions` table
- PayMongo Dashboard: Advanced subscription management
- API: Programmatic subscription control
- Webhooks: Real-time event monitoring

### Technical Implementation

**Database Tables:**
- `subscriptions` - Main subscription lifecycle tracking
- `subscription_plans` - Plan definitions and pricing  
- `subscription_items` - Line items per subscription
- `invoices` - Billing invoices and payment tracking
- `payment_methods` - Stored payment methods
- `webhook_events` - Event log for webhook replay

**API Endpoints:**
- `POST /api/subscriptions/create` - Create checkout session
- `GET /api/account/subscription` - Get subscription details
- `POST /api/account/subscription/cancel` - Cancel subscription
- `POST /api/webhooks/paymongo` - Process payment webhooks

**Documentation:**
- `docs/subscription/IMPLEMENTATION_COMPLETE.md` - Complete implementation guide
- `docs/subscription/QUICK_START.md` - Quick start guide
- `docs/subscription/PAYMONGO_WEBHOOK_SETUP.md` - Webhook configuration
- `docs/subscription/WEBHOOK_VERIFICATION.md` - Webhook testing guide

### Environment Setup

Add to your `.env.local` for subscription features:

```env
# PayMongo Payment Gateway
PAYMONGO_SECRET_KEY=sk_test_your_test_key
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key
PAYMONGO_API_URL=https://api.paymongo.com/v1
```

---

## Admin Panel Integration

The application includes a comprehensive admin panel for managing payment settings, promo codes, and payment verification workflows.

### Admin Panel Features

**Payment Settings Management:**
- Configurable term discount rates (quarterly/annual subscriptions)
- Plan-specific pricing and discount configuration
- Payment method settings and QR code management
- Real-time payment settings updates

**Promo Code Management:**
- Create and manage promotional codes with usage limits
- Set discount percentages and validity periods
- Upload QR codes for each payment method (GCash, Maya, etc.)
- Track promo code usage and campaign analytics
- Enable/disable promo codes instantly

**Payment Verification Interface:**
- Review detailed payment verification submissions
- Compare webhook data with uploaded payment proofs
- View and analyze screenshots of payment confirmations
- Approve or reject payment verifications with admin notes
- Real-time verification status updates

**QR Code System:**
- Generate and manage QR codes for payment methods
- Attach QR codes to promo campaigns for easy scanning
- Support for multiple payment methods per promo code
- Centralized QR code storage and management

### Admin API Endpoints

**Payment Settings:**
- `GET /api/admin/payment-settings` - Retrieve current payment settings
- `PUT /api/admin/payment-settings` - Update payment configuration

**Promo Codes:**
- `GET /api/admin/promo-codes` - List all promo codes
- `POST /api/admin/promo-codes` - Create new promo code
- `PUT /api/admin/promo-codes/[id]` - Update promo code
- `DELETE /api/admin/promo-codes/[id]` - Delete promo code

**QR Codes:**
- `GET /api/admin/qr-codes` - List all QR codes
- `POST /api/admin/qr-codes` - Upload new QR code
- `PUT /api/admin/qr-codes/[id]` - Update QR code
- `DELETE /api/admin/qr-codes/[id]` - Delete QR code

**Payment Verification:**
- `GET /api/payment-verifications` - List all verification requests
- `POST /api/payment-verifications` - Submit payment proof
- `PUT /api/payment-verifications/[id]` - Update verification status

### Database Schema Updates

**New Tables:**
- `payment_settings` - Stores payment configuration and discount rates
- `promo_codes` - Promo code definitions with usage tracking
- `qr_codes` - QR code storage for payment methods
- `payment_verifications` - Payment proof submissions and reviews

### Admin Access Control

Admin features require proper authentication and authorization:
- Admin-only routes and API endpoints
- Role-based access control for admin functions
- Secure file upload handling for QR codes and screenshots
- Audit logging for admin actions

### Development and Testing

**Admin Development:**
```bash
# Test admin endpoints locally
curl http://localhost:3000/api/admin/payment-settings
curl http://localhost:3000/api/admin/promo-codes

# Test payment verification flow
curl -X POST http://localhost:3000/api/payment-verifications \
  -F "payment_id=xxx" \
  -F "screenshot=@path/to/screenshot.png"
```

**Browser Testing:**
- Navigate to `/admin/payment-settings` for payment configuration
- Navigate to `/admin/promo-codes` for promo code management
- Navigate to `/admin/verifications` for payment verification review

---

## Subscription Status (Legacy)

**Note:** The subscription system has been completely re-implemented with PayMongo integration. The legacy subscription status system described below is maintained for backward compatibility.

Companies can have the following subscription statuses:
- `demo` - Demo account with watermarked documents
- `trial` - Trial account with watermarked documents  
- `active` - Active paying account with clean documents
- `past_due` - Past due account with watermarked documents

**Watermark behavior:**
- Demo/trial/past_due accounts: "DEMO" watermark appears diagonally on all printed documents (quotations and purchase orders)
- Active accounts: Clean documents without watermarks
- Watermark appears in both print preview and actual print/PDF output
- Watermark persists across scrolling and window resizing
- Multi-page documents show watermark on each page

**Managing subscription status:**
The legacy subscription status is stored in the `companies` table and can be updated via SQL:
```sql
UPDATE companies SET subscription_status = 'active' WHERE code = 'YOUR_COMPANY_CODE';
```

For new subscriptions, use the PayMongo-integrated subscription system instead.

---

## Adding new blind types in the future

Currently the app is built for **roller blinds**. The `products` table is generic enough to support other types. When ready, add a `type` column to `products`:

```sql
ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'roller';
```

Then filter by type in the quote form as needed.
