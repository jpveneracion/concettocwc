# PayMongo Webhook Verification Guide

This guide provides comprehensive instructions for verifying webhook setup, monitoring webhook processing, and troubleshooting common issues.

## Table of Contents

1. [Quick Verification Checklist](#quick-verification-checklist)
2. [Database Verification](#database-verification)
3. [Application Log Monitoring](#application-log-monitoring)
4. [Webhook Success Rate Monitoring](#webhook-success-rate-monitoring)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Production Monitoring Setup](#production-monitoring-setup)

## Quick Verification Checklist

Use this checklist to quickly verify webhook setup is working correctly.

### ✅ Initial Setup Verification

**Environment Configuration:**
- [ ] `PAYMONGO_WEBHOOK_SECRET` is set in environment variables
- [ ] Webhook secret matches PayMongo dashboard exactly
- [ ] Webhook URL is publicly accessible: `https://yourdomain.com/api/webhooks/paymongo`
- [ ] HTTPS is enabled with valid SSL certificate

**Database Setup:**
- [ ] `webhook_events` table exists
- [ ] `subscriptions` table exists
- [ ] Database connection is working
- [ ] Database user has required permissions

**Application Status:**
- [ ] Webhook route is responding: `/api/webhooks/paymongo`
- [ ] Application can connect to database
- [ ] Error logging is enabled
- [ ] Signature verification is working

### ✅ Functional Testing

**Webhook Reception:**
- [ ] Send test webhook from PayMongo dashboard
- [ ] Verify 200 OK response in PayMongo webhook logs
- [ ] Check webhook_events table for new record
- [ ] Verify subscription status updated correctly

**Signature Verification:**
- [ ] Valid webhook accepted (200 OK)
- [ ] Invalid webhook rejected (401 Unauthorized)
- [ ] Signature verification logs show no errors

**Event Processing:**
- [ ] subscription.activated creates/updates subscription
- [ ] payment.succeeded updates subscription to active
- [ ] payment.failed updates subscription to past_due
- [ ] subscription.cancelled sets status to cancelled
- [ ] subscription.updated handles plan changes

## Database Verification

### 1. Check Webhook Events Table

**View Recent Webhook Events:**
```sql
-- Last 10 webhook events received
SELECT 
  id,
  event_type,
  paymongo_event_id,
  processed,
  processing_error,
  created_at
FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 10;
```

**Check Processing Status:**
```sql
-- Count of processed vs unprocessed events
SELECT 
  processed,
  COUNT(*) as event_count,
  MAX(created_at) as last_event
FROM webhook_events 
GROUP BY processed;
```

**Find Failed Events:**
```sql
-- Events that failed processing
SELECT 
  event_type,
  paymongo_event_id,
  processing_error,
  created_at
FROM webhook_events 
WHERE processing_error IS NOT NULL
ORDER BY created_at DESC;
```

**Event Type Distribution:**
```sql
-- Count events by type
SELECT 
  event_type,
  COUNT(*) as count,
  COUNT(CASE WHEN processed = true THEN 1 END) as processed_count,
  COUNT(CASE WHEN processed = false THEN 1 END) as failed_count
FROM webhook_events 
GROUP BY event_type
ORDER BY count DESC;
```

### 2. Verify Subscription Updates

**Recent Subscription Changes:**
```sql
-- Recent subscription status changes
SELECT 
  id,
  company_id,
  status,
  trial_end,
  current_period_end,
  updated_at
FROM subscriptions 
ORDER BY updated_at DESC 
LIMIT 10;
```

**Check Specific Subscription:**
```sql
-- Full subscription details
SELECT * FROM subscriptions 
WHERE paymongo_subscription_id = 'sub_your_subscription_id';
```

**Subscription Status Distribution:**
```sql
-- Count subscriptions by status
SELECT 
  status,
  COUNT(*) as count
FROM subscriptions 
GROUP BY status
ORDER BY count DESC;
```

### 3. Verify Data Consistency

**Find Orphaned Webhook Events:**
```sql
-- Webhook events without corresponding subscriptions
SELECT we.*
FROM webhook_events we
LEFT JOIN subscriptions s ON s.paymongo_subscription_id LIKE CONCAT('%', we.paymongo_event_id, '%')
WHERE we.event_type IN ('subscription.activated', 'payment.succeeded', 'payment.failed')
  AND we.processed = true
  AND s.id IS NULL;
```

**Check Subscription Timeline:**
```sql
-- Verify subscription status changes are chronological
SELECT 
  company_id,
  status,
  trial_end,
  current_period_end,
  created_at,
  updated_at
FROM subscriptions 
WHERE company_id = 'your_company_id'
ORDER BY updated_at ASC;
```

## Application Log Monitoring

### 1. Webhook Processing Logs

**Monitor Webhook Processing:**
```bash
# Tail webhook logs in real-time
tail -f logs/app.log | grep "webhook"

# Filter for specific events
tail -f logs/app.log | grep "subscription.activated"

# Check for errors
tail -f logs/app.log | grep "webhook.*error"
```

**Recent Webhook Errors:**
```bash
# Last 50 webhook error lines
grep "webhook.*error" logs/app.log | tail -50

# Count errors by type
grep "webhook.*error" logs/app.log | cut -d':' -f4 | sort | uniq -c
```

### 2. Signature Verification Logs

**Monitor Signature Verification:**
```bash
# Check for signature verification issues
tail -f logs/app.log | grep "signature"

# Find invalid signature attempts
grep "Invalid signature" logs/app.log | tail -20

# Verify signature verification is working
grep "Signature verified successfully" logs/app.log | tail -10
```

### 3. Database Operation Logs

**Monitor Database Operations:**
```bash
# Check for database errors
tail -f logs/app.log | grep "database.*error"

# Monitor SQL query performance
tail -f logs/app.log | grep "SELECT.*subscriptions"

# Check for transaction issues
tail -f logs/app.log | grep "transaction"
```

## Webhook Success Rate Monitoring

### 1. Calculate Success Metrics

**Overall Success Rate:**
```sql
-- Webhook processing success rate
SELECT 
  ROUND(
    100.0 * COUNT(CASE WHEN processed = true THEN 1 END) / 
    NULLIF(COUNT(*), 0), 
    2
  ) as success_rate,
  COUNT(*) as total_events,
  COUNT(CASE WHEN processed = true THEN 1 END) as successful_events,
  COUNT(CASE WHEN processed = false THEN 1 END) as failed_events
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Success Rate by Event Type:**
```sql
-- Success rate for each event type
SELECT 
  event_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN processed = true THEN 1 END) as successful,
  ROUND(
    100.0 * COUNT(CASE WHEN processed = true THEN 1 END) / 
    NULLIF(COUNT(*), 0), 
    2
  ) as success_rate
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY success_rate ASC;
```

### 2. Performance Monitoring

**Average Processing Time:**
```sql
-- Average webhook processing time (if you track timing)
SELECT 
  event_type,
  AVG(processing_time_ms) as avg_processing_time,
  MAX(processing_time_ms) as max_processing_time,
  MIN(processing_time_ms) as min_processing_time
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND processing_time_ms IS NOT NULL
GROUP BY event_type;
```

**Processing Latency Distribution:**
```sql
-- How quickly webhooks are processed after receipt
SELECT 
  COUNT(*) as count,
  CASE 
    WHEN processing_time_ms < 100 THEN '0-100ms'
    WHEN processing_time_ms < 500 THEN '100-500ms'
    WHEN processing_time_ms < 1000 THEN '500ms-1s'
    WHEN processing_time_ms < 5000 THEN '1-5s'
    ELSE '5s+'
  END as latency_range
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND processing_time_ms IS NOT NULL
GROUP BY latency_range
ORDER BY latency_range;
```

## Common Issues and Solutions

### Issue 1: Webhook Not Received

**Symptoms:**
- No new records in webhook_events table
- PayMongo shows webhook as delivered but no response

**Diagnosis:**
```sql
-- Check for any webhook events in last hour
SELECT COUNT(*) FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Solutions:**
1. Verify webhook URL is accessible: `curl -X POST https://yourdomain.com/api/webhooks/paymongo`
2. Check server logs for application errors
3. Verify firewall isn't blocking requests
4. Test webhook URL from external network

### Issue 2: Signature Verification Failing

**Symptoms:**
- All webhooks return 401 Unauthorized
- Logs show "Invalid signature" errors

**Diagnosis:**
```bash
# Check signature verification logs
grep "Invalid signature" logs/app.log | tail -10
```

**Solutions:**
1. Verify PAYMONGO_WEBHOOK_SECRET matches PayMongo dashboard exactly
2. Check for extra whitespace in secret value
3. Ensure webhook secret hasn't been rotated
4. Test with correct secret using test script

### Issue 3: Duplicate Event Processing

**Symptoms:**
- Same subscription updated multiple times
- Duplicate database records

**Diagnosis:**
```sql
-- Check for duplicate event IDs
SELECT paymongo_event_id, COUNT(*) 
FROM webhook_events 
GROUP BY paymongo_event_id 
HAVING COUNT(*) > 1;
```

**Solutions:**
1. Verify unique constraint on paymongo_event_id
2. Check duplicate event processing logic
3. Ensure idempotency handling is working
4. Review database transaction isolation level

### Issue 4: Subscription Not Updating

**Symptoms:**
- Webhook received successfully
- Subscription status not changing

**Diagnosis:**
```sql
-- Check for processed webhooks but no subscription updates
SELECT we.*
FROM webhook_events we
LEFT JOIN subscriptions s ON s.paymongo_subscription_id = CONCAT('%', we.paymongo_event_id, '%')
WHERE we.processed = true
  AND we.event_type IN ('subscription.activated', 'payment.succeeded')
  AND s.id IS NULL;
```

**Solutions:**
1. Verify webhook payload contains required metadata
2. Check subscription_id in webhook payload
3. Review SQL queries for errors
4. Ensure database user has UPDATE permissions

### Issue 5: High Error Rate

**Symptoms:**
- More than 1% of webhooks failing
- Specific event types failing consistently

**Diagnosis:**
```sql
-- Analyze error patterns
SELECT 
  event_type,
  processing_error,
  COUNT(*) as error_count,
  MAX(created_at) as last_occurrence
FROM webhook_events 
WHERE processing_error IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, processing_error
ORDER BY error_count DESC;
```

**Solutions:**
1. Identify common error patterns
2. Fix underlying data issues
3. Update webhook processing logic
4. Add better error handling

## Production Monitoring Setup

### 1. Automated Monitoring Scripts

**Webhook Health Check Script:**
```bash
#!/bin/bash
# scripts/check-webhook-health.sh

# Check webhook processing health
echo "Webhook Health Check - $(date)"

# Check recent webhook success rate
echo "Recent Success Rate (last hour):"
psql $DATABASE_URL -c "
SELECT 
  ROUND(100.0 * COUNT(CASE WHEN processed = true THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate,
  COUNT(*) as total_events
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour';
"

# Check for recent errors
echo "Recent Errors (last hour):"
psql $DATABASE_URL -c "
SELECT COUNT(*) as error_count
FROM webhook_events 
WHERE processing_error IS NOT NULL
  AND created_at > NOW() - INTERVAL '1 hour';
"

# Check for stuck events
echo "Unprocessed Events (> 5 minutes old):"
psql $DATABASE_URL -c "
SELECT COUNT(*) as stuck_count
FROM webhook_events 
WHERE processed = false
  AND created_at < NOW() - INTERVAL '5 minutes';
"
```

### 2. Monitoring Dashboard Metrics

**Key Metrics to Track:**
1. **Webhook Success Rate** - Should be >99%
2. **Average Processing Time** - Should be <1 second
3. **Error Rate by Event Type** - Should be <1% for each type
4. **Subscription Sync Accuracy** - Should be 100%
5. **Signature Verification Failures** - Should be 0%

### 3. Alert Configuration

**Critical Alerts:**
- Webhook success rate drops below 95%
- More than 10 consecutive failed webhooks
- Signature verification failures detected
- Database connection issues
- Webhook processing time exceeds 10 seconds

**Warning Alerts:**
- Webhook success rate below 99%
- Specific event type error rate above 5%
- Processing time above 5 seconds
- High duplicate event rate

### 4. Logging Best Practices

**What to Log:**
- Incoming webhook requests (event ID, type, timestamp)
- Signature verification results
- Database operations and results
- Processing errors with full context
- Performance metrics (processing time)

**Log Rotation:**
- Rotate logs daily
- Keep logs for 30 days
- Archive important logs for audit
- Compress old logs to save space

### 5. Regular Maintenance

**Daily Tasks:**
- Check webhook error rates
- Review failed webhooks
- Monitor database connectivity

**Weekly Tasks:**
- Analyze error patterns
- Review subscription sync accuracy
- Check processing performance

**Monthly Tasks:**
- Clean up old webhook event records
- Review and rotate webhook secrets
- Update documentation with learnings
- Test disaster recovery procedures

## Troubleshooting Commands Reference

**Quick Diagnostics:**
```bash
# Check webhook route is accessible
curl -X POST https://yourdomain.com/api/webhooks/paymongo

# Test webhook processing
node scripts/test-webhook.js subscription.activated

# Check recent errors
grep "webhook.*error" logs/app.log | tail -20

# Monitor real-time webhook processing
tail -f logs/app.log | grep "webhook"
```

**Database Diagnostics:**
```sql
-- Recent webhook status
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;

-- Failed webhooks in last 24 hours
SELECT * FROM webhook_events 
WHERE processing_error IS NOT NULL 
  AND created_at > NOW() - INTERVAL '24 hours';

-- Event type performance
SELECT event_type, COUNT(*), 
  COUNT(CASE WHEN processed = true THEN 1 END) as success
FROM webhook_events 
GROUP BY event_type;
```

**Performance Diagnostics:**
```bash
# Check webhook processing time
tail -f logs/app.log | grep "processing.*ms"

# Monitor database query performance
tail -f logs/app.log | grep "SELECT.*subscriptions"

# Check memory usage
ps aux | grep node
```

---

**Last Updated:** 2025-01-10  
**Version:** 1.0  
**Maintained By:** Development Team