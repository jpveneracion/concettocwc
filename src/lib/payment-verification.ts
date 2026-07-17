// src/lib/payment-verification.ts

import { sql } from './db';
import { cleanReferenceNumber, validateReferenceNumberFormat } from './reference-cleaning';
import type { PaymentVerificationRecord, GCashWebhookData } from '@/types/payment';

/**
 * Automatic verification matching result
 */
interface VerificationMatchResult {
  shouldAutoApprove: boolean;
  reason: string;
  webhookData?: GCashWebhookData;
}

/**
 * Check if webhook data matches verification with 100% confidence
 * Conservative threshold: auto-approve ONLY when ALL conditions met perfectly
 */
export async function checkAutomaticVerificationMatch(
  verification: PaymentVerificationRecord
): Promise<VerificationMatchResult> {
  const cleanedRef = cleanReferenceNumber(verification.reference_number || '');
  const formatCheck = validateReferenceNumberFormat(verification.reference_number || '');

  // Non-standard format → route to manual verification
  if (formatCheck.format === 'invalid') {
    return {
      shouldAutoApprove: false,
      reason: 'Invalid reference number format'
    };
  }

  if (formatCheck.format === 'flexible') {
    return {
      shouldAutoApprove: false,
      reason: 'Non-standard format - manual verification required'
    };
  }

  // Check for matching webhook data
  const webhookResult = await sql<GCashWebhookData[]>(`
    SELECT * FROM gcash_webhook_data
    WHERE cleaned_transaction_number = $1
    AND received_at > NOW() - INTERVAL '24 hours'
    ORDER BY received_at DESC
    LIMIT 1
  `, [cleanedRef]);

  if (!webhookResult[0]) {
    return {
      shouldAutoApprove: false,
      reason: 'No matching webhook data found within 24 hours'
    };
  }

  const webhook = webhookResult[0];

  // Check for multiple potential matches (ambiguity)
  const duplicateCheck = await sql<{count: string}[]>(`
    SELECT COUNT(*) as count FROM payment_verifications
    WHERE REGEXP_REPLACE(UPPER(reference_number), '[^A-Z0-9]', '', '') = $1
    AND id != $2
    AND status = 'pending'
  `, [cleanedRef, verification.id]);

  if (parseInt(duplicateCheck[0].count) > 0) {
    return {
      shouldAutoApprove: false,
      reason: 'Multiple verifications with same reference number - ambiguous match'
    };
  }

  // Get expected amount from subscription plans
  const planResult = await sql<{amount: string}[]>(`
    SELECT amount FROM subscription_plans
    WHERE id = $1
  `, [verification.plan_id]);

  if (!planResult[0]) {
    return {
      shouldAutoApprove: false,
      reason: 'Plan not found for verification'
    };
  }

  const expectedAmount = parseFloat(String(planResult[0].amount));
  const webhookAmount = parseFloat(String(webhook.amount));

  // Exact amount match required (zero tolerance for differences)
  if (Math.abs(expectedAmount - webhookAmount) > 0.01) {
    return {
      shouldAutoApprove: false,
      reason: `Amount mismatch: expected ₱${expectedAmount}, got ₱${webhookAmount}`
    };
  }

  // Time window check: webhook should be within reasonable time of verification submission
  const timeDiff = Math.abs(
    new Date(webhook.transaction_time).getTime() -
    new Date(verification.submitted_at || verification.created_at).getTime()
  );
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return {
      shouldAutoApprove: false,
      reason: `Time window mismatch: ${hoursDiff.toFixed(1)} hours difference`
    };
  }

  // ALL checks passed - 100% confidence match
  return {
    shouldAutoApprove: true,
    reason: 'Perfect match - all criteria met',
    webhookData: webhook
  };
}

/**
 * Update verification with automatic verification result
 */
export async function updateVerificationWithAutomaticResult(
  verificationId: string,
  matchResult: VerificationMatchResult
): Promise<void> {
  const status = matchResult.shouldAutoApprove ? 'matched' :
    matchResult.reason.includes('no webhook') ? 'no_webhook_data' :
    matchResult.reason.includes('Amount') ? 'amount_mismatch' :
    matchResult.reason.includes('time') ? 'time_mismatch' : 'other_mismatch';

  await sql(`
    UPDATE payment_verifications
    SET
      automatic_verification_attempted = TRUE,
      automatic_verification_status = $1,
      verification_method = $2,
      webhook_data_id = $3,
      updated_at = NOW()
    WHERE id = $4
  `, [status, matchResult.shouldAutoApprove ? 'automatic' : 'manual',
      matchResult.webhookData?.id || null, verificationId]);

  // If auto-approved, also update verification status
  if (matchResult.shouldAutoApprove) {
    await sql(`
      UPDATE payment_verifications
      SET status = 'approved', reviewed_at = NOW()
      WHERE id = $1
    `, [verificationId]);
  }
}