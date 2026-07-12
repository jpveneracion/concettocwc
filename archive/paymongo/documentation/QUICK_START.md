# Subscription System Quick Start Guide

**Last Updated:** 2026-07-10  
**Version:** 1.0  
**Status:** Production Ready

---

## 🚀 Quick Start Overview

This guide will help you get started with the subscription system in 15 minutes or less. Whether you're a developer integrating the system or a user managing subscriptions, this guide covers the essential steps.

---

## 👨‍💻 For Developers: System Setup

### Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL database access
- [ ] PayMongo test account
- [ ] Basic knowledge of TypeScript/Next.js

### Step 1: Environment Setup (5 minutes)

**1.1 Install Dependencies**
```bash
# All dependencies are already installed in your project
npm install
```

**1.2 Configure Environment Variables**
Add to your `.env.local` file:
```bash
# PayMongo Configuration (use test keys for development)
PAYMONGO_SECRET_KEY=sk_test_your_test_key_here
PAYMONGO_WEBHOOK_SECRET=whsec_test_your_webhook_secret
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key
PAYMONGO_API_URL=https://api.paymongo.com/v1

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/your_database
```

**1.3 Verify Environment Setup**
```bash
# Test database connection
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT 1 as test\`.then(() => console.log('✅ Database connected')).catch(err => console.error('❌ Database connection failed:', err));"
```

### Step 2: Database Setup (3 minutes)

**2.1 Run Migration**
```bash
# Option 1: Direct SQL execution
psql -U your_user -d your_database -f migrations/subscription-system.sql

# Option 2: Through Node.js
node -e "const {sql} = require('./src/lib/db.js'); const fs = require('fs'); const migration = fs.readFileSync('migrations/subscription-system.sql', 'utf8'); sql.unsafe(migration).then(() => console.log('✅ Migration complete')).catch(err => console.error('❌ Migration failed:', err));"
```

**2.2 Verify Migration**
```bash
# Check tables were created
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'subscription%'\`.then(result => console.log('✅ Tables:', result.map(r => r.table_name))).catch(err => console.error('❌ Verification failed:', err));"
```

Expected output: `['subscription_plans', 'subscriptions', 'subscription_items', 'invoices', 'payment_methods', 'webhook_events']`

### Step 3: Run Tests (2 minutes)

```bash
# Run all subscription tests
npm test

# Expected output: "Test Suites: 1 passed, 1 total. Tests: 55 passed, 55 total"
```

### Step 4: Start Development Server (1 minute)

```bash
# Start the development server
npm run dev

# Visit http://localhost:3000/subscription/checkout
```

### Step 5: Test Basic Functionality (4 minutes)

**5.1 Create a Test Subscription**
```bash
# Create a test company and user
# Navigate to: http://localhost:3000/subscription/checkout
# Select a plan and complete the checkout flow
```

**5.2 Verify Subscription Creation**
```bash
# Check database for new subscription
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1\`.then(result => console.log('✅ Latest subscription:', result[0])).catch(err => console.error('❌ Query failed:', err));"
```

**5.3 Test Webhook Processing**
```bash
# Use PayMongo dashboard to send test webhooks
# Check webhook_events table
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 3\`.then(result => console.log('✅ Recent webhooks:', result)).catch(err => console.error('❌ Query failed:', err));"
```

---

## 👤 For Users: Getting Started with Subscriptions

### Creating Your First Subscription

**Step 1: Navigate to Checkout**
1. Log in to your account
2. Visit `/subscription/checkout`
3. Browse available plans

**Step 2: Choose Your Plan**
- **Basic Plan (₱499/month)**: Up to 50 quotes/month, standard templates
- **Pro Plan (₱999/month)**: Unlimited quotes, premium templates, priority support

**Step 3: Start Your Trial**
1. Click "Start Free Trial" on your preferred plan
2. Complete the checkout process
3. Begin using all features immediately

**Step 4: Manage Your Subscription**
1. Visit `/account/subscription`
2. View your current plan and usage
3. Upgrade, cancel, or update payment methods

---

## 🔧 Common Development Tasks

### Testing Subscription Access Control

**1. Test Protected Routes**
```bash
# Try to create a quote without subscription
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session" \
  -d '{"customer_name":"Test","items":[]}'

# Expected: 402 Payment Required or subscription check response
```

**2. Test Read-Only Mode**
```bash
# Try to modify data while in past_due status
# Expected: 403 Forbidden with read-only access message
```

### Monitoring Webhook Processing

```bash
# Monitor recent webhook activity
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT event_type, processed, processing_error, created_at FROM webhook_events ORDER BY created_at DESC LIMIT 10\`.then(result => console.table(result)).catch(err => console.error('❌ Query failed:', err));"
```

### Debugging Subscription Issues

**1. Check Subscription Status**
```bash
node -e "const {sql} = require('./src/lib/db.js'); sql\`SELECT * FROM subscriptions WHERE company_id = 'your_company_id'\`.then(result => console.log('Subscription:', result[0])).catch(err => console.error('❌ Query failed:', err));"
```

**2. Verify Access Control Logic**
```typescript
// Add temporary logging to check subscription access
console.log('Access check result:', await checkSubscriptionAccess(session));
```

---

## 🌐 PayMongo Integration

### Setting Up PayMongo Test Mode

**1. Create PayMongo Test Account**
- Visit https://dashboard.paymongo.com/
- Sign up for a test account
- Navigate to Developers → API Keys

**2. Get Test API Keys**
- Copy the Public Key: `pk_test_...`
- Copy the Secret Key: `sk_test_...`
- Add to your `.env.local` file

**3. Configure Test Webhook**
- In PayMongo dashboard, go to Developers → Webhooks
- Add webhook URL: `https://your-domain.com/api/webhooks/paymongo`
- For local testing, use ngrok: `https://your-ngrok-url.ngrok.io/api/webhooks/paymongo`
- Subscribe to test events

### Testing PayMongo Integration

**1. Test Checkout Creation**
```bash
curl -X POST http://localhost:3000/api/subscriptions/create \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session" \
  -d '{
    "plan_id": "your-plan-id",
    "success_url": "http://localhost:3000/success",
    "cancel_url": "http://localhost:3000/cancel"
  }'
```

**2. Test Webhook Processing**
- Use PayMongo dashboard to send test webhooks
- Verify events appear in `webhook_events` table
- Check subscription status updates

---

## 🐛 Troubleshooting Common Issues

### Issue: "Database connection failed"

**Solution:**
```bash
# 1. Check DATABASE_URL is correct
echo $DATABASE_URL

# 2. Test database connection
psql $DATABASE_URL -c "SELECT 1"

# 3. Check database server is running
pg_isready -h localhost -p 5432
```

### Issue: "Migration failed"

**Solution:**
```bash
# 1. Check if tables already exist
psql $DATABASE_URL -c "\dt subscription*"

# 2. If tables exist, check if they have correct structure
psql $DATABASE_URL -c "\d subscriptions"

# 3. For fresh installation, drop existing tables and re-run
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### Issue: "Webhook signature verification failed"

**Solution:**
```bash
# 1. Verify PAYMONGO_WEBHOOK_SECRET is set
echo $PAYMONGO_WEBHOOK_SECRET

# 2. Check webhook secret matches PayMongo dashboard
# (They should be identical, including any prefix)

# 3. Test webhook signature verification manually
# Use the webhook testing script in scripts/test-webhook.js
```

### Issue: "Tests failing"

**Solution:**
```bash
# 1. Clear Jest cache
npm test -- --clearCache

# 2. Run tests in verbose mode
npm test -- --verbose

# 3. Run specific failing test for debugging
npm test -- -t "test name here"
```

---

## 📱 Quick API Reference

### Core API Endpoints

**Create Checkout Session**
```http
POST /api/subscriptions/create
Content-Type: application/json

{
  "plan_id": "plan-uuid",
  "success_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}
```

**Get Subscription Details**
```http
GET /api/account/subscription
Cookie: session=your_session
```

**Cancel Subscription**
```http
POST /api/account/subscription/cancel
Cookie: session=your_session
```

**Webhook Endpoint**
```http
POST /api/webhooks/paymongo
paymongo-signature: t=timestamp,v1=digest
Content-Type: application/json

{
  "data": {...},
  "events": [{"type": "subscription.activated"}]
}
```

---

## 🎯 Next Steps

### For New Developers

1. **Explore the Codebase**
   - Start with `src/lib/subscription.ts` for core logic
   - Review `src/types/subscription.ts` for data structures
   - Check API routes in `src/app/api/`

2. **Run the Tests**
   - Understand test patterns in `src/__tests__/subscription/`
   - Add tests for new features
   - Ensure all tests pass before committing

3. **Build Features**
   - Follow existing code patterns
   - Use TypeScript for type safety
   - Add comprehensive error handling

### For Product Managers

1. **Monitor Key Metrics**
   - Trial conversion rates
   - Payment success rates
   - User engagement levels

2. **Gather User Feedback**
   - Checkout flow experience
   - Plan pricing and features
   - Subscription management UI

3. **Plan Iterations**
   - Review usage analytics
   - Identify improvement opportunities
   - Prioritize feature requests

---

## 📚 Additional Resources

### Documentation

- **Implementation Complete**: `docs/subscription/IMPLEMENTATION_COMPLETE.md`
- **PayMongo Webhooks**: `docs/subscription/PAYMONGO_WEBHOOK_SETUP.md`
- **Webhook Verification**: `docs/subscription/WEBHOOK_VERIFICATION.md`
- **Design Document**: `docs/superpowers/specs/2026-07-10-subscription-system-design.md`

### External Resources

- **PayMongo Documentation**: https://developers.paymongo.com/
- **Next.js Documentation**: https://nextjs.org/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/

### Support Channels

- **Technical Issues**: Check implementation documentation first
- **PayMongo Support**: support@paymongo.com
- **Internal Support**: Contact infrastructure team

---

## ✅ Quick Start Checklist

### Developer Setup
- [ ] Environment variables configured
- [ ] Database migration completed
- [ ] All tests passing
- [ ] Development server running
- [ ] PayMongo test account configured

### User Setup
- [ ] User account created
- [ ] Subscription plan selected
- [ ] Trial period started
- [ ] Basic features tested
- [ ] Payment method configured

### Production Readiness
- [ ] Production environment variables set
- [ ] Database migrated in production
- [ ] PayMongo production keys configured
- [ ] Webhooks configured and tested
- [ ] Monitoring and alerting setup

---

**Quick Start Guide Completed** 🎉

You should now have a working subscription system in 15 minutes or less! For more detailed information, refer to the complete implementation documentation.

**Need Help?** Check the comprehensive `IMPLEMENTATION_COMPLETE.md` document or review the troubleshooting section above.