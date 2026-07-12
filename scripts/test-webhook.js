#!/usr/bin/env node

/**
 * PayMongo Webhook Testing Script
 *
 * This script helps test webhook processing without requiring actual PayMongo events.
 * It simulates webhook payloads and sends them to your local webhook endpoint.
 *
 * Usage:
 *   node scripts/test-webhook.js [event_type]
 *
 * Examples:
 *   node scripts/test-webhook.js subscription.activated
 *   node scripts/test-webhook.js payment.succeeded
 *   node scripts/test-webhook.js payment.failed
 *   node scripts/test-webhook.js subscription.cancelled
 *   node scripts/test-webhook.js subscription.updated
 *
 * Environment variables required:
 *   WEBHOOK_URL - Your webhook endpoint URL (default: http://localhost:3000/api/webhooks/paymongo)
 *   PAYMONGO_WEBHOOK_SECRET - Your webhook secret for signature generation
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Configuration from environment
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/paymongo';
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Generate PayMongo webhook signature
 */
function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');

  // PayMongo signature format: "t=timestamp,v1=digest"
  return `t=${timestamp},v1=${digest}`;
}

/**
 * Sample webhook payloads for testing
 */
const webhookPayloads = {
  'subscription.activated': {
    data: {
      id: 'sub_test_' + Date.now(),
      type: 'subscription',
      attributes: {
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        cancel_at_period_end: false,
        metadata: {
          company_id: 'company_test_123',
          plan_id: 'plan_test_premium',
          test_mode: true
        }
      }
    },
    events: [{
      type: 'subscription.activated',
      created_at: Math.floor(Date.now() / 1000)
    }]
  },

  'payment.succeeded': {
    data: {
      id: 'pay_test_' + Date.now(),
      type: 'payment',
      attributes: {
        subscription_id: 'sub_test_' + Date.now(),
        amount: 2900, // $29.00 in cents
        currency: 'PHP',
        status: 'succeeded',
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        metadata: {
          company_id: 'company_test_123',
          test_mode: true
        }
      }
    },
    events: [{
      type: 'payment.succeeded',
      created_at: Math.floor(Date.now() / 1000)
    }]
  },

  'payment.failed': {
    data: {
      id: 'pay_test_' + Date.now(),
      type: 'payment',
      attributes: {
        subscription_id: 'sub_test_' + Date.now(),
        amount: 2900,
        currency: 'PHP',
        status: 'failed',
        failure_code: 'insufficient_funds',
        failure_message: 'Insufficient funds',
        metadata: {
          company_id: 'company_test_123',
          test_mode: true
        }
      }
    },
    events: [{
      type: 'payment.failed',
      created_at: Math.floor(Date.now() / 1000)
    }]
  },

  'subscription.cancelled': {
    data: {
      id: 'sub_test_' + Date.now(),
      type: 'subscription',
      attributes: {
        status: 'cancelled',
        cancel_at_period_end: true,
        cancelled_at: Math.floor(Date.now() / 1000),
        metadata: {
          company_id: 'company_test_123',
          plan_id: 'plan_test_premium',
          test_mode: true
        }
      }
    },
    events: [{
      type: 'subscription.cancelled',
      created_at: Math.floor(Date.now() / 1000)
    }]
  },

  'subscription.updated': {
    data: {
      id: 'sub_test_' + Date.now(),
      type: 'subscription',
      attributes: {
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        metadata: {
          company_id: 'company_test_123',
          plan_id: 'plan_test_enterprise', // Plan upgrade
          previous_plan_id: 'plan_test_premium',
          test_mode: true
        }
      }
    },
    events: [{
      type: 'subscription.updated',
      created_at: Math.floor(Date.now() / 1000)
    }]
  }
};

/**
 * Send webhook to endpoint
 */
function sendWebhook(payload, eventType) {
  return new Promise((resolve, reject) => {
    try {
      // Convert payload to JSON string
      const payloadString = JSON.stringify(payload);

      // Generate signature if secret is provided
      let signature = null;
      if (PAYMONGO_WEBHOOK_SECRET) {
        signature = generateSignature(payloadString, PAYMONGO_WEBHOOK_SECRET);
        console.log(`${colors.cyan}✓ Signature generated${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ No webhook secret provided - signature will be invalid${colors.reset}`);
      }

      // Parse URL
      const url = new URL(WEBHOOK_URL);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      // Prepare request options
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString)
        }
      };

      // Add signature header if available
      if (signature) {
        options.headers['paymongo-signature'] = signature;
      }

      console.log(`${colors.blue}→ Sending ${eventType} webhook to ${WEBHOOK_URL}${colors.reset}`);

      // Send request
      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: response
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // Write payload and end request
      req.write(payloadString);
      req.end();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Display webhook test results
 */
function displayResults(eventType, response, error) {
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Webhook Test Results: ${eventType}${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);

  if (error) {
    console.log(`${colors.red}✗ REQUEST FAILED${colors.reset}`);
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);

    if (error.code === 'ECONNREFUSED') {
      console.log(`${colors.yellow}\n💡 Troubleshooting:${colors.reset}`);
      console.log(`${colors.yellow}   1. Make sure your development server is running${colors.reset}`);
      console.log(`${colors.yellow}   2. Check that the webhook URL is correct${colors.reset}`);
      console.log(`${colors.yellow}   3. Try: npm run dev${colors.reset}`);
    }

    process.exit(1);
  }

  console.log(`Status Code: ${response.statusCode}`);

  if (response.statusCode === 200) {
    console.log(`${colors.green}✓ WEBHOOK PROCESSED SUCCESSFULLY${colors.reset}`);
    console.log(`${colors.green}Response: ${JSON.stringify(response.body, null, 2)}${colors.reset}`);
  } else if (response.statusCode === 401) {
    console.log(`${colors.red}✗ SIGNATURE VERIFICATION FAILED${colors.reset}`);
    console.log(`${colors.yellow}Response: ${JSON.stringify(response.body, null, 2)}${colors.reset}`);
    console.log(`${colors.yellow}\n💡 Troubleshooting:${colors.reset}`);
    console.log(`${colors.yellow}   1. Verify PAYMONGO_WEBHOOK_SECRET is set correctly${colors.reset}`);
    console.log(`${colors.yellow}   2. Check webhook secret matches PayMongo dashboard${colors.reset}`);
    console.log(`${colors.yellow}   3. Ensure no extra whitespace in secret value${colors.reset}`);
  } else if (response.statusCode === 400) {
    console.log(`${colors.red}✗ BAD REQUEST${colors.reset}`);
    console.log(`${colors.yellow}Response: ${JSON.stringify(response.body, null, 2)}${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ UNEXPECTED STATUS CODE${colors.reset}`);
    console.log(`${colors.yellow}Response: ${JSON.stringify(response.body, null, 2)}${colors.reset}`);
  }

  console.log(`${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const eventType = args[0];

  console.log(`${colors.cyan}\n🔧 PayMongo Webhook Testing Tool${colors.reset}`);
  console.log(`${colors.cyan}────────────────────────────────────────────────────────${colors.reset}\n`);

  // Validate event type
  if (!eventType) {
    console.log(`${colors.yellow}Usage: node scripts/test-webhook.js [event_type]${colors.reset}`);
    console.log(`${colors.yellow}\nAvailable event types:${colors.reset}`);
    Object.keys(webhookPayloads).forEach(type => {
      console.log(`${colors.yellow}  • ${type}${colors.reset}`);
    });
    console.log(`${colors.yellow}\nExample:${colors.reset}`);
    console.log(`${colors.yellow}  node scripts/test-webhook.js subscription.activated${colors.reset}`);
    process.exit(1);
  }

  if (!webhookPayloads[eventType]) {
    console.log(`${colors.red}✗ Invalid event type: ${eventType}${colors.reset}`);
    console.log(`${colors.red}Valid options: ${Object.keys(webhookPayloads).join(', ')}${colors.reset}`);
    process.exit(1);
  }

  // Check environment setup
  console.log(`${colors.blue}Configuration:${colors.reset}`);
  console.log(`${colors.blue}  Webhook URL: ${WEBHOOK_URL}${colors.reset}`);
  console.log(`${colors.blue}  Webhook Secret: ${PAYMONGO_WEBHOOK_SECRET ? '✓ Set' : '✗ Not set'}${colors.reset}`);
  console.log(`${colors.blue}  Event Type: ${eventType}${colors.reset}\n`);

  if (!PAYMONGO_WEBHOOK_SECRET) {
    console.log(`${colors.yellow}⚠ Warning: PAYMONGO_WEBHOOK_SECRET not set${colors.reset}`);
    console.log(`${colors.yellow}  Webhook signature will be invalid and request will fail${colors.reset}`);
    console.log(`${colors.yellow}  Set it with: export PAYMONGO_WEBHOOK_SECRET=whsec_your_secret${colors.reset}\n`);
  }

  try {
    // Get payload for event type
    const payload = webhookPayloads[eventType];

    console.log(`${colors.cyan}Test Payload:${colors.reset}`);
    console.log(`${colors.cyan}${JSON.stringify(payload, null, 2)}${colors.reset}\n`);

    // Send webhook
    const response = await sendWebhook(payload, eventType);

    // Display results
    displayResults(eventType, response, null);

    // Exit with appropriate code
    process.exit(response.statusCode === 200 ? 0 : 1);

  } catch (error) {
    displayResults(eventType, null, error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { webhookPayloads, generateSignature, sendWebhook };