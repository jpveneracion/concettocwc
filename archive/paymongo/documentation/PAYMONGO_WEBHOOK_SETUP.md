# PayMongo Webhook Setup Guide

This guide provides comprehensive instructions for configuring PayMongo webhooks to handle subscription events in your application.

## Overview

The subscription system uses PayMongo webhooks to synchronize subscription status changes, payment events, and subscription updates. Webhooks are processed at `/api/webhooks/paymongo` and handle the following event types:

- **subscription.activated**: New subscription created or trial started
- **payment.succeeded**: Successful payment, subscription remains active
- **payment.failed**: Payment failure, subscription becomes past_due
- **subscription.cancelled**: Subscription cancelled by user or system
- **subscription.updated**: Plan changes or subscription modifications

## Prerequisites

- Active PayMongo account with webhooks enabled
- Production server with HTTPS enabled (PayMongo requirement)
- Environment variables configured for webhook secret
- Database tables ready for webhook processing

## Step 1: PayMongo Dashboard Setup

### 1.1 Access Webhooks Configuration

1. Log in to your PayMongo dashboard (https://dashboard.paymongo.com/)
2. Navigate to **Settings** → **Webhooks**
3. Click **Add Webhook** to create a new webhook configuration

### 1.2 Configure Webhook URL

**Webhook URL Format:**
```
https://yourdomain.com/api/webhooks/paymongo
```

**Examples:**
- Production: `https://api.yourapp.com/api/webhooks/paymongo`
- Staging: `https://staging.yourapp.com/api/webhooks/paymongo`
- Development: `https://dev.yourapp.com/api/webhooks/paymongo`

**Important Requirements:**
- URL must be publicly accessible (PayMongo servers must reach it)
- HTTPS is required (PayMongo security requirement)
- URL must respond to POST requests
- Response should be within 30 seconds (PayMongo timeout)

### 1.3 Subscribe to Events

Select the following events for your subscription system:

✅ **subscription.activated**  
- When: New subscription created or trial period starts
- Purpose: Initialize subscription record, set trial dates

✅ **payment.succeeded**  
- When: Recurring payment successfully processed
- Purpose: Update subscription status, extend period_end date

✅ **payment.failed**  
- When: Payment attempt fails (insufficient funds, expired card, etc.)
- Purpose: Mark subscription as past_due, trigger dunning workflow

✅ **subscription.cancelled**  
- When: Subscription cancelled by user or system
- Purpose: Update subscription status, handle access revocation

✅ **subscription.updated**  
- When: Plan changes, quantity changes, or subscription modifications
- Purpose: Update subscription details, handle plan migrations

### 1.4 Copy Webhook Secret

After creating the webhook, PayMongo will generate a webhook secret:

1. Find your webhook in the webhooks list
2. Click **Reveal Secret** or copy the webhook secret
3. Store this secret securely - you'll need it for environment configuration
4. Format: `whsec_...` (PayMongo webhook secret prefix)

## Step 2: Environment Configuration

### 2.1 Set Environment Variables

Add the following variables to your production environment:

```bash
# PayMongo Webhook Configuration
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_API_URL=https://api.paymongo.com/v1
```

### 2.2 Environment Setup Methods

**Option A: Production Environment Variables**
```bash
# Direct environment variables
export PAYMONGO_WEBHOOK_SECRET=whsec_your_actual_secret
```

**Option B: Docker/Docker Compose**
```yaml
# docker-compose.yml
environment:
  - PAYMONGO_WEBHOOK_SECRET=whsec_your_actual_secret
```

**Option C: Cloud Provider (Vercel/Netlify/AWS)**
```bash
# Via dashboard or CLI
vercel env add PAYMONGO_WEBHOOK_SECRET production
```

### 2.3 Security Best Practices

**✅ DO:**
- Store webhook secrets in environment variables only
- Use different secrets for development/staging/production
- Rotate webhook secrets periodically (PayMongo supports this)
- Monitor for unauthorized webhook activity
- Use secrets management services (AWS Secrets Manager, etc.)

**❌ DON'T:**
- Commit webhook secrets to git repositories
- Share webhook secrets in chat/email/documentation
- Use the same secret across environments
- Log webhook secrets in application logs
- Expose webhook secrets in client-side code

## Step 3: Testing Webhooks

### 3.1 PayMongo Dashboard Testing

PayMongo provides built-in webhook testing in the dashboard:

1. Navigate to **Settings** → **Webhooks**
2. Find your webhook and click **Test**
3. Select event type to test (subscription.activated, etc.)
4. Click **Send Test Webhook**
5. Check your server logs for successful processing

**Expected Response:**
```json
{
  "message": "Webhook processed successfully",
  "event_id": "evt_...",
  "event_type": "subscription.activated"
}
```

### 3.2 Local Testing Tools

**Option A: Using ngrok for local testing**

```bash
# Install ngrok
npm install -g ngrok

# Start your development server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok URL in PayMongo webhook configuration
# https://abc123.ngrok.io/api/webhooks/paymongo
```

**Option B: Using the test script (provided)**

See `scripts/test-webhook.js` for comprehensive local testing.

### 3.3 Verify Webhook Processing

**Check Database Records:**
```sql
-- Check webhook_events table for received events
SELECT * FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify subscription updates
SELECT * FROM subscriptions 
WHERE paymongo_subscription_id = 'sub_...';

-- Check for processing errors
SELECT * FROM webhook_events 
WHERE processing_error IS NOT NULL;
```

**Monitor Application Logs:**
```bash
# Webhook processing logs
tail -f logs/app.log | grep "webhook"

# Check for signature verification failures
tail -f logs/app.log | grep "Invalid signature"
```

## Step 4: Production Deployment Checklist

### 4.1 Pre-Deployment Checklist

**Webhook Configuration:**
- [ ] Webhook URL is publicly accessible
- [ ] HTTPS is enabled with valid SSL certificate
- [ ] Webhook responds to POST requests
- [ ] Webhook processing completes within 30 seconds
- [ ] Firewall allows inbound traffic from PayMongo servers

**Environment Setup:**
- [ ] `PAYMONGO_WEBHOOK_SECRET` is set in production
- [ ] Database tables are created and migrated
- [ ] Database user has required permissions
- [ ] Error monitoring is configured (Sentry, etc.)
- [ ] Logging is enabled for webhook events

**Application Readiness:**
- [ ] Webhook route is deployed: `/api/webhooks/paymongo`
- [ ] Signature verification is working
- [ ] Idempotency handling is implemented
- [ ] Error handling and retry logic is in place
- [ ] Database transactions are properly configured

### 4.2 Post-Deployment Verification

**1. Test Webhook Connectivity:**
```bash
# Send a test webhook from PayMongo dashboard
# Verify 200 OK response in PayMongo webhook logs
```

**2. Verify Database Records:**
```sql
-- Check webhook events are being stored
SELECT COUNT(*) FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Verify subscription status updates
SELECT * FROM subscriptions 
WHERE updated_at > NOW() - INTERVAL '1 hour';
```

**3. Monitor Error Rates:**
```bash
# Check for webhook processing errors
tail -f logs/app.log | grep "Webhook processing error"

# Monitor signature verification failures
tail -f logs/app.log | grep "Invalid signature"
```

**4. Verify Business Logic:**
- Subscription status changes correctly
- Trial periods are set accurately
- Payment failures trigger proper workflows
- Cancellation handling works as expected

## Step 5: Troubleshooting Guide

### 5.1 Common Issues and Solutions

**Issue: Webhook not received by server**

**Possible Causes:**
- Webhook URL is not publicly accessible
- Firewall blocking PayMongo servers
- Server is down or not responding
- DNS resolution issues

**Solutions:**
1. Verify webhook URL accessibility from external network
2. Check firewall rules allow PayMongo IPs (contact PayMongo for IP list)
3. Ensure server is running and responding to POST requests
4. Test webhook URL with curl from external server

**Issue: Invalid signature errors**

**Possible Causes:**
- `PAYMONGO_WEBHOOK_SECRET` not set or incorrect
- Clock synchronization issues
- Payload tampering during transmission

**Solutions:**
1. Verify webhook secret matches PayMongo dashboard exactly
2. Check server system time is synchronized
3. Ensure webhook secret has no extra whitespace/characters
4. Regenerate webhook secret in PayMongo dashboard if compromised

**Issue: Duplicate event processing**

**Possible Causes:**
- Idempotency check not working
- Database query issues
- Race conditions in webhook processing

**Solutions:**
1. Verify `webhook_events` table unique constraint on `paymongo_event_id`
2. Check database transaction isolation level
3. Ensure duplicate check happens before event processing
4. Monitor for stuck transactions causing retries

**Issue: Subscription status not updating**

**Possible Causes:**
- Database connection issues
- Missing metadata in webhook payload
- SQL query failures

**Solutions:**
1. Check database connectivity and permissions
2. Verify PayMongo webhooks include required metadata
3. Review SQL queries for syntax/logic errors
4. Check application error logs for database errors

### 5.2 Debug Mode

Enable debug logging for webhook troubleshooting:

```bash
# Add to environment variables
LOG_LEVEL=debug
WEBHOOK_DEBUG=true

# Restart application
npm run start
```

### 5.3 Monitoring and Alerting

**Key Metrics to Monitor:**
- Webhook success rate (should be >99%)
- Average webhook processing time
- Signature verification failures
- Database error rates
- Subscription status sync accuracy

**Alert Thresholds:**
- Webhook error rate >1% → Critical alert
- Webhook processing time >10s → Warning
- Signature verification failures → Critical alert
- Database connection failures → Critical alert

## Step 6: Webhook Security Best Practices

### 6.1 Signature Verification

The webhook route implements HMAC-SHA256 signature verification:

1. Extract signature from `paymongo-signature` header
2. Compute HMAC-SHA256 hash of raw payload using webhook secret
3. Compare with received signature using timing-safe comparison
4. Reject webhooks with invalid signatures

### 6.2 Security Recommendations

**Network Security:**
- Use HTTPS exclusively for webhook endpoints
- Implement rate limiting on webhook routes
- Add IP whitelisting for PayMongo servers if available
- Monitor for unusual webhook patterns

**Application Security:**
- Never trust webhook data without signature verification
- Validate all webhook payload data before processing
- Use prepared statements for database queries
- Implement proper error handling to prevent information leakage

**Data Security:**
- Store webhook secrets in secure environment variables
- Rotate webhook secrets periodically
- Monitor for unauthorized webhook activity
- Implement audit logging for webhook events

## Step 7: Maintenance and Operations

### 7.1 Regular Maintenance Tasks

**Daily:**
- Monitor webhook error rates
- Check database connectivity
- Review processing latency metrics

**Weekly:**
- Audit webhook event logs for anomalies
- Review failed payment events
- Check subscription status synchronization

**Monthly:**
- Test webhook endpoint connectivity
- Review and rotate webhook secrets
- Clean up old webhook event records
- Update documentation and runbooks

### 7.2 Backup and Recovery

**Database Backups:**
- Regular backups of `webhook_events` table
- Backup of `subscriptions` table for recovery
- Documented recovery procedures

**Webhook Replay:**
- PayMongo supports webhook replay for testing
- Test disaster recovery procedures quarterly
- Maintain webhook event logs for audit trail

## Appendix: Webhook Event Reference

### subscription.activated

**Payload Structure:**
```json
{
  "data": {
    "id": "sub_123",
    "attributes": {
      "status": "trialing",
      "trial_end": 1234567890,
      "current_period_end": 1234567890,
      "metadata": {
        "company_id": "company_123",
        "plan_id": "plan_456"
      }
    }
  }
}
```

**Processing Logic:**
- Create or update subscription record
- Set status to "trialing"
- Set trial_end and current_period_end dates
- Extract company_id and plan_id from metadata

### payment.succeeded

**Payload Structure:**
```json
{
  "data": {
    "attributes": {
      "subscription_id": "sub_123",
      "current_period_end": 1234567890
    }
  }
}
```

**Processing Logic:**
- Update subscription status to "active"
- Extend current_period_end date
- Clear trial_end if set
- Log payment success for analytics

### payment.failed

**Payload Structure:**
```json
{
  "data": {
    "attributes": {
      "subscription_id": "sub_123"
    }
  }
}
```

**Processing Logic:**
- Update subscription status to "past_due"
- Trigger dunning workflow (email notifications)
- Schedule retry attempts if configured
- Log payment failure for analytics

### subscription.cancelled

**Payload Structure:**
```json
{
  "data": {
    "id": "sub_123",
    "attributes": {
      "cancel_at_period_end": true
    }
  }
}
```

**Processing Logic:**
- Update subscription status to "cancelled"
- Set cancel_at_period_end to true
- Trigger access revocation workflow
- Send cancellation confirmation email

### subscription.updated

**Payload Structure:**
```json
{
  "data": {
    "id": "sub_123",
    "attributes": {
      "metadata": {
        "plan_id": "plan_789"
      }
    }
  }
}
```

**Processing Logic:**
- Update plan_id if changed
- Update subscription metadata
- Handle plan migration logic
- Log plan change for analytics

## Support and Resources

**PayMongo Documentation:**
- Webhooks Guide: https://developers.paymongo.com/docs/webhooks
- API Reference: https://developers.paymongo.com/reference/api

**Internal Resources:**
- Database Schema: `docs/subscription/DATABASE_SCHEMA.md`
- API Documentation: `docs/subscription/API_REFERENCE.md`
- Troubleshooting Runbook: `docs/subscription/TROUBLESHOOTING.md`

**Emergency Contacts:**
- Infrastructure Lead: [Contact info]
- Database Administrator: [Contact info]
- PayMongo Support: support@paymongo.com

---

**Last Updated:** 2025-01-10  
**Version:** 1.0  
**Maintained By:** Development Team