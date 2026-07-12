import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import * as crypto from 'crypto';

/**
 * POST /api/webhooks/paymongo
 *
 * Processes PayMongo webhook events to keep subscription status synchronized
 *
 * Security: Verify HMAC-SHA256 signature using PAYMONGO_WEBHOOK_SECRET
 * Idempotent: Returns 200 for duplicate events
 *
 * Event Types Handled:
 * - subscription.activated: Create/update subscription, set trial_end
 * - payment.succeeded: Update status to active, update period_end
 * - payment.failed: Set status to past_due
 * - subscription.cancelled: Set status to cancelled
 * - subscription.updated: Handle plan changes
 */

// Environment variables
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

export async function POST(req: Request) {
  let rawPayload: string = '';
  let signature: string | null = null;
  let paymongoEventId: string | null = null;
  let eventType: string | null = null;

  try {
    // 1. EXTRACT RAW PAYLOAD AND SIGNATURE
    rawPayload = await req.text();
    signature = req.headers.get('paymongo-signature');

    // Security check: Signature must be present
    if (!signature) {
      console.error('Webhook error: Missing signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Parse payload to get event ID and type
    let payload;
    try {
      payload = JSON.parse(rawPayload);
      paymongoEventId = payload.data?.id;
      eventType = payload.events?.[0]?.type || payload.type;

      if (!paymongoEventId) {
        console.error('Webhook error: Missing event ID in payload');
        return NextResponse.json(
          { error: 'Invalid payload - missing event ID' },
          { status: 400 }
        );
      }

      if (!eventType) {
        console.error('Webhook error: Missing event type in payload');
        return NextResponse.json(
          { error: 'Invalid payload - missing event type' },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error('Webhook error: Invalid JSON payload', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 2. VERIFY SIGNATURE
    const isValidSignature = verifySignature(rawPayload, signature);
    if (!isValidSignature) {
      console.error(`Webhook error: Invalid signature for event ${paymongoEventId}`);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 3. CHECK FOR DUPLICATE EVENTS
    const existingEvent = await checkDuplicateEvent(paymongoEventId);
    if (existingEvent) {
      console.log(`Duplicate event detected: ${paymongoEventId}, returning 200`);
      return NextResponse.json(
        {
          message: 'Event already processed',
          event_id: paymongoEventId
        },
        { status: 200 }
      );
    }

    // 4. STORE WEBHOOK EVENT
    await storeWebhookEvent(paymongoEventId, eventType, payload);

    // 5. PROCESS EVENT BASED ON TYPE
    await processEvent(eventType, payload);

    // 6. MARK EVENT AS PROCESSED
    await markEventProcessed(paymongoEventId);

    // 7. RETURN SUCCESS
    return NextResponse.json(
      {
        message: 'Webhook processed successfully',
        event_id: paymongoEventId,
        event_type: eventType
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Mark event as failed if we have an event ID
    if (paymongoEventId) {
      try {
        await markEventFailed(paymongoEventId, error instanceof Error ? error.message : 'Unknown error');
      } catch (dbError) {
        console.error('Failed to mark event as failed:', dbError);
      }
    }

    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Verify HMAC-SHA256 signature
 */
function verifySignature(rawPayload: string, signature: string): boolean {
  if (!PAYMONGO_WEBHOOK_SECRET) {
    console.error('PAYMONGO_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', PAYMONGO_WEBHOOK_SECRET);
    hmac.update(rawPayload);
    const digest = hmac.digest('hex');

    // PayMongo sends signature in format: "t=timestamp,v1=digest"
    // We need to extract the v1 digest
    const signatureParts = signature.split(',');
    const v1Part = signatureParts.find(part => part.startsWith('v1='));

    if (!v1Part) {
      console.error('Signature format invalid - no v1 part found');
      return false;
    }

    const receivedDigest = v1Part.split('=')[1];

    if (!receivedDigest) {
      console.error('Signature format invalid - no digest value');
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(receivedDigest, 'hex')
    );

  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Check if event has already been processed
 */
async function checkDuplicateEvent(paymongoEventId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT id FROM webhook_events
      WHERE paymongo_event_id = ${paymongoEventId}
      LIMIT 1
    `;

    return result.length > 0;
  } catch (error) {
    console.error('Error checking duplicate event:', error);
    // If we can't check, assume it's not a duplicate to avoid missing events
    return false;
  }
}

/**
 * Store webhook event in database
 */
async function storeWebhookEvent(
  paymongoEventId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    await sql`
      INSERT INTO webhook_events (
        event_type,
        paymongo_event_id,
        payload,
        processed,
        created_at,
        updated_at
      )
      VALUES (
        ${eventType},
        ${paymongoEventId},
        ${payload},
        false,
        NOW(),
        NOW()
      )
    `;
  } catch (error) {
    console.error('Error storing webhook event:', error);
    throw new Error('Failed to store webhook event');
  }
}

/**
 * Process event based on type
 */
async function processEvent(eventType: string, payload: Record<string, any>): Promise<void> {
  switch (eventType) {
    case 'subscription.activated':
      await handleSubscriptionActivated(payload);
      break;

    case 'payment.succeeded':
      await handlePaymentSucceeded(payload);
      break;

    case 'payment.failed':
      await handlePaymentFailed(payload);
      break;

    case 'subscription.cancelled':
      await handleSubscriptionCancelled(payload);
      break;

    case 'subscription.updated':
      await handleSubscriptionUpdated(payload);
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
      // Don't throw error for unhandled events - they might be for other purposes
      break;
  }
}

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(eventData: any): Promise<void> {
  try {
    const subscriptionData = eventData.data?.attributes;
    const paymongoSubscriptionId = eventData.data?.id;

    if (!subscriptionData || !paymongoSubscriptionId) {
      console.error('Invalid subscription.activated event data');
      return;
    }

    // Extract metadata
    const companyId = subscriptionData.metadata?.company_id;
    const planId = subscriptionData.metadata?.plan_id;

    if (!companyId || !planId) {
      console.error('Missing company_id or plan_id in subscription metadata');
      return;
    }

    // Calculate dates
    const trialEnd = subscriptionData.trial_end
      ? new Date(subscriptionData.trial_end * 1000) // Convert Unix timestamp
      : null;

    const currentPeriodEnd = subscriptionData.current_period_end
      ? new Date(subscriptionData.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Check if subscription exists
    const existingSubscriptions = await sql`
      SELECT id FROM subscriptions
      WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
      LIMIT 1
    `;

    if (existingSubscriptions.length > 0) {
      // Update existing subscription
      await sql`
        UPDATE subscriptions
        SET status = 'trialing',
            trial_end = ${trialEnd},
            current_period_end = ${currentPeriodEnd},
            updated_at = NOW()
        WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
      `;

      console.log(`Updated subscription ${paymongoSubscriptionId} to trialing`);
    } else {
      // Create new subscription
      await sql`
        INSERT INTO subscriptions (
          company_id,
          plan_id,
          status,
          trial_end,
          current_period_end,
          paymongo_subscription_id,
          cancel_at_period_end,
          created_at,
          updated_at
        )
        VALUES (
          ${companyId},
          ${planId},
          'trialing',
          ${trialEnd},
          ${currentPeriodEnd},
          ${paymongoSubscriptionId},
          false,
          NOW(),
          NOW()
        )
      `;

      console.log(`Created new subscription ${paymongoSubscriptionId} for company ${companyId}`);
    }

  } catch (error) {
    console.error('Error handling subscription.activated:', error);
    throw new Error(`Failed to handle subscription.activated: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle payment.succeeded event
 */
async function handlePaymentSucceeded(eventData: any): Promise<void> {
  try {
    const paymentData = eventData.data?.attributes;
    const paymongoSubscriptionId = paymentData?.subscription_id;

    if (!paymentData || !paymongoSubscriptionId) {
      console.error('Invalid payment.succeeded event data');
      return;
    }

    // Calculate period end date
    const currentPeriodEnd = paymentData.current_period_end
      ? new Date(paymentData.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Update subscription to active
    await sql`
      UPDATE subscriptions
      SET status = 'active',
          current_period_end = ${currentPeriodEnd},
          trial_end = NULL,
          updated_at = NOW()
      WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
    `;

    console.log(`Updated subscription ${paymongoSubscriptionId} to active after successful payment`);

  } catch (error) {
    console.error('Error handling payment.succeeded:', error);
    throw new Error(`Failed to handle payment.succeeded: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(eventData: any): Promise<void> {
  try {
    const paymentData = eventData.data?.attributes;
    const paymongoSubscriptionId = paymentData?.subscription_id;

    if (!paymentData || !paymongoSubscriptionId) {
      console.error('Invalid payment.failed event data');
      return;
    }

    // Update subscription to past_due
    await sql`
      UPDATE subscriptions
      SET status = 'past_due',
          updated_at = NOW()
      WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
    `;

    console.log(`Updated subscription ${paymongoSubscriptionId} to past_due after failed payment`);

  } catch (error) {
    console.error('Error handling payment.failed:', error);
    throw new Error(`Failed to handle payment.failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(eventData: any): Promise<void> {
  try {
    const subscriptionData = eventData.data?.attributes;
    const paymongoSubscriptionId = eventData.data?.id;

    if (!subscriptionData || !paymongoSubscriptionId) {
      console.error('Invalid subscription.cancelled event data');
      return;
    }

    // Update subscription to cancelled
    await sql`
      UPDATE subscriptions
      SET status = 'cancelled',
          cancel_at_period_end = true,
          updated_at = NOW()
      WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
    `;

    console.log(`Updated subscription ${paymongoSubscriptionId} to cancelled`);

  } catch (error) {
    console.error('Error handling subscription.cancelled:', error);
    throw new Error(`Failed to handle subscription.cancelled: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle subscription.updated event (plan changes, etc.)
 */
async function handleSubscriptionUpdated(eventData: any): Promise<void> {
  try {
    const subscriptionData = eventData.data?.attributes;
    const paymongoSubscriptionId = eventData.data?.id;

    if (!subscriptionData || !paymongoSubscriptionId) {
      console.error('Invalid subscription.updated event data');
      return;
    }

    // Extract plan_id from metadata if available
    const newPlanId = subscriptionData.metadata?.plan_id;

    if (newPlanId) {
      // Plan change - update plan_id
      await sql`
        UPDATE subscriptions
        SET plan_id = ${newPlanId},
            updated_at = NOW()
        WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
      `;

      console.log(`Updated subscription ${paymongoSubscriptionId} to new plan ${newPlanId}`);
    } else {
      // Just update the updated_at timestamp to show we processed the update
      await sql`
        UPDATE subscriptions
        SET updated_at = NOW()
        WHERE paymongo_subscription_id = ${paymongoSubscriptionId}
      `;

      console.log(`Updated subscription ${paymongoSubscriptionId} timestamp`);
    }

  } catch (error) {
    console.error('Error handling subscription.updated:', error);
    throw new Error(`Failed to handle subscription.updated: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mark webhook event as processed successfully
 */
async function markEventProcessed(paymongoEventId: string): Promise<void> {
  try {
    await sql`
      UPDATE webhook_events
      SET processed = true,
          processing_error = NULL,
          updated_at = NOW()
      WHERE paymongo_event_id = ${paymongoEventId}
    `;
  } catch (error) {
    console.error('Error marking event as processed:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Mark webhook event as failed
 */
async function markEventFailed(paymongoEventId: string, errorMessage: string): Promise<void> {
  try {
    await sql`
      UPDATE webhook_events
      SET processed = false,
          processing_error = ${errorMessage},
          updated_at = NOW()
      WHERE paymongo_event_id = ${paymongoEventId}
    `;
  } catch (error) {
    console.error('Error marking event as failed:', error);
    // Non-critical error, don't throw
  }
}