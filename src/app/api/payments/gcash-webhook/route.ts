// src/app/api/payments/gcash-webhook/route.ts

import { NextResponse } from 'next/server';
import { createGCashWebhookData, sql } from '@/lib/db';
import { checkAutomaticVerificationMatch, updateVerificationWithAutomaticResult } from '@/lib/payment-verification';
import { cleanReferenceNumber } from '@/lib/reference-cleaning';
import type { CreateWebhookRequest } from '@/types/payment';

/**
 * POST /api/payments/gcash-webhook
 *
 * Receives GCash payment notifications from MacroDroid and triggers automatic verification
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Authentication Check - Verify MacroDroid bearer token
    const authHeader = req.headers.get('Authorization');
    const webhookSecret = process.env.GCASH_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('GCASH_WEBHOOK_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing bearer token' },
        { status: 401 }
      );
    }

    const providedToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (providedToken !== webhookSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid bearer token' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: CreateWebhookRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    // 3. Validate required fields
    const { transaction_number, amount, transaction_time } = body;
    if (!transaction_number || !amount || !transaction_time) {
      return NextResponse.json(
        { error: 'Missing required fields: transaction_number, amount, transaction_time' },
        { status: 400 }
      );
    }

    // 4. Validate field formats
    if (typeof transaction_number !== 'string' || transaction_number.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid transaction_number format' },
        { status: 400 }
      );
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount - must be a positive number' },
        { status: 400 }
      );
    }

    let parsedTransactionTime: Date;
    try {
      parsedTransactionTime = new Date(transaction_time);
      if (isNaN(parsedTransactionTime.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (dateError) {
      return NextResponse.json(
        { error: 'Invalid transaction_time format - must be ISO 8601 date string' },
        { status: 400 }
      );
    }

    // 5. Clean the reference number
    const cleanedReferenceNumber = cleanReferenceNumber(transaction_number);
    if (!cleanedReferenceNumber) {
      return NextResponse.json(
        { error: 'Invalid transaction number - cannot be cleaned' },
        { status: 400 }
      );
    }

    // 6. Store webhook data idempotently
    const webhookData = await createGCashWebhookData({
      transaction_number: cleanedReferenceNumber,
      amount: Number(amount),
      sender_name: body.sender_name,
      sender_account: body.sender_account,
      receiver_name: body.receiver_name,
      receiver_account: body.receiver_account,
      transaction_time: parsedTransactionTime,
      notification_text: body.notification_text,
      raw_webhook_payload: body.raw_data
    });

    // 7. Query for pending verifications matching this transaction number
    const pendingVerifications = await sql<any[]>(`
      SELECT * FROM payment_verifications
      WHERE cleaned_reference_number = $1
      AND status = 'pending'
      AND automatic_verification_attempted = FALSE
      ORDER BY submitted_at ASC
    `, [cleanedReferenceNumber]);

    // 8. Process automatic verification for each pending verification (Trigger B)
    let autoApproved = 0;
    let flaggedForManual = 0;

    for (const verification of pendingVerifications) {
      try {
        // Check if this verification matches the webhook data
        const matchResult = await checkAutomaticVerificationMatch(verification);

        // Update verification with automatic verification result
        await updateVerificationWithAutomaticResult(verification.id, matchResult);

        // Track statistics
        if (matchResult.shouldAutoApprove) {
          autoApproved++;
        } else {
          flaggedForManual++;
        }

        console.log(`Processed verification ${verification.id}: ${matchResult.reason}`);
      } catch (processingError) {
        console.error(`Error processing verification ${verification.id}:`, processingError);
        // Continue processing other verifications even if one fails
      }
    }

    // 9. Return success response with processing statistics
    return NextResponse.json({
      success: true,
      webhook_id: webhookData.id,
      pending_verifications_processed: pendingVerifications.length,
      auto_approved: autoApproved,
      flagged_for_manual: flaggedForManual,
      message: `Processed ${pendingVerifications.length} verifications`
    }, { status: 200 });

  } catch (error) {
    console.error('GCash webhook processing error:', error);

    // Check for JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}