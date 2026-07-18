// src/lib/activation.ts

import {
  ActivationCode,
  GenerateActivationCodeRequest,
  PaymentMethod,
  SubscriptionPlan,
  StatusHistoryEntry
} from '@/types/subscription';
import { sql } from './db';

/**
 * Database activation code record interface
 */
interface ActivationCodeRecord {
  id: number;
  code: string;
  discount_percent: number;
  applicable_plans: string;
  payment_amount?: number;
  payment_currency: string;
  payment_amount_usd?: number;
  payment_method?: string;
  exchange_rate?: number;
  payment_reference?: string;
  payment_date?: string;
  wallet_address?: string;
  bank_reference?: string;
  created_by?: number;
  created_at: string;
  expires_at?: string;
  used_by?: number;
  used_at?: string;
  used_ip_address?: string;
  is_active: boolean;
  campaign_name?: string;
  notes?: string;
  status_history: string;
  // QR code and usage limiting fields
  gcash_qr_url?: string;
  gotyme_qr_url?: string;
  usage_limit?: number;
  current_usage?: number;
}

/**
 * Generate unique activation code
 */
export function generateActivationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];

  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }

  return segments.join('-'); // Format: XXXX-XXXX-XXXX-XXXX
}

/**
 * Create promo code in database (without payment details)
 */
export async function createPromoCode(
  discountPercent: number,
  applicablePlans: SubscriptionPlan[],
  expiresAt: Date | undefined,
  campaignName: string | undefined,
  notes: string | undefined,
  createdBy: string,
  qrCodes?: { gcash?: string; gotyme?: string },
  usageLimit?: number
): Promise<ActivationCode> {
  const code = generateActivationCode();
  const now = new Date();

  const status_history: StatusHistoryEntry[] = [{
    status: 'created',
    timestamp: now,
    note: `Promo code created for campaign: ${campaignName || 'general'}`
  }];

  const result = await sql(
    `INSERT INTO activation_codes (
      code, discount_percent, applicable_plans,
      created_by, expires_at, campaign_name, notes,
      status_history, gcash_qr_url, gotyme_qr_url, usage_limit, current_usage,
      payment_currency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      code,
      discountPercent,
      JSON.stringify(applicablePlans),
      createdBy,
      expiresAt ? expiresAt.toISOString() : null,
      campaignName || null,
      notes || null,
      JSON.stringify(status_history),
      qrCodes?.gcash || null,
      qrCodes?.gotyme || null,
      usageLimit || 1, // Default to one-time use
      0, // Start with 0 usage
      'PHP' // Default currency for promo codes
    ]
  );

  return mapActivationCodeFromDb(result[0] as ActivationCodeRecord);
}

/**
 * Create activation code in database
 */
export async function createActivationCode(
  request: GenerateActivationCodeRequest,
  createdBy: string,
  qrCodes?: { gcash?: string; gotyme?: string },
  usageLimit?: number
): Promise<ActivationCode> {
  const code = generateActivationCode();
  const now = new Date();

  const status_history: StatusHistoryEntry[] = [{
    status: 'created',
    timestamp: now,
    note: `Generated for ${request.payment_method} payment ${request.payment_reference}`
  }];

  const result = await sql(
    `INSERT INTO activation_codes (
      code, discount_percent, applicable_plans,
      payment_amount, payment_currency, payment_method,
      payment_reference, payment_date,
      created_by, expires_at, campaign_name, notes,
      status_history, gcash_qr_url, gotyme_qr_url, usage_limit, current_usage
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      code,
      request.discount_percent,
      JSON.stringify(request.applicable_plans),
      request.payment_amount,
      request.payment_currency,
      request.payment_method,
      request.payment_reference,
      now.toISOString(),
      createdBy,
      request.expires_at ? request.expires_at.toISOString() : null,
      request.campaign_name || null,
      request.notes || null,
      JSON.stringify(status_history),
      qrCodes?.gcash || null,
      qrCodes?.gotyme || null,
      usageLimit || 1, // Default to one-time use
      0 // Start with 0 usage
    ]
  );

  return mapActivationCodeFromDb(result[0] as ActivationCodeRecord);
}

/**
 * Validate activation code with enhanced usage limiting support
 */
export async function validateActivationCode(
  code: string,
  plan: SubscriptionPlan
): Promise<ActivationCode | null> {
  const result = await sql(
    `SELECT * FROM activation_codes
     WHERE code = $1
     AND is_active = true
     AND (expires_at IS NULL OR expires_at > NOW())
     AND (
       -- One-time use codes (existing system)
       (usage_limit IS NULL AND used_by IS NULL) OR
       -- Usage-limited codes (new system)
       (usage_limit IS NOT NULL AND current_usage < usage_limit)
     )`,
    [code]
  );

  if (result.length === 0) {
    return null;
  }

  const activationCode = mapActivationCodeFromDb(result[0] as ActivationCodeRecord);

  // Check if code applies to requested plan
  if (!activationCode.applicable_plans.includes(plan)) {
    return null;
  }

  return activationCode;
}

/**
 * Validate activation code with detailed error messages
 */
export async function validateActivationCodeWithDetails(
  code: string,
  plan: SubscriptionPlan
): Promise<{ valid: boolean; activationCode?: ActivationCode; error?: string }> {
  const result = await sql(
    `SELECT * FROM activation_codes WHERE code = $1`,
    [code]
  );

  if (result.length === 0) {
    return { valid: false, error: 'Promo code not found' };
  }

  const activationCode = mapActivationCodeFromDb(result[0] as ActivationCodeRecord);

  // Check if active
  if (!activationCode.is_active) {
    return { valid: false, error: 'Promo code is inactive' };
  }

  // Check expiration
  if (activationCode.expires_at && new Date(activationCode.expires_at) < new Date()) {
    return { valid: false, error: 'Promo code has expired' };
  }

  // Check if code applies to requested plan
  if (!activationCode.applicable_plans.includes(plan)) {
    return { valid: false, error: `Promo code not applicable to ${plan} plan` };
  }

  // Check usage limits
  if (activationCode.usage_limit !== undefined) {
    const currentUsage = activationCode.current_usage || 0;
    if (currentUsage >= activationCode.usage_limit) {
      return { valid: false, error: 'Promo code has reached maximum usage' };
    }
  } else {
    // One-time use codes (existing system)
    if (activationCode.used_by) {
      return { valid: false, error: 'Promo code has already been used' };
    }
  }

  return { valid: true, activationCode };
}

/**
 * Redeem activation code for user (supports both usage systems)
 */
export async function redeemActivationCode(
  code: string,
  userId: string,
  ipAddress: string,
  plan: SubscriptionPlan
): Promise<ActivationCode> {
  const validation = await validateActivationCodeWithDetails(code, plan);

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid or expired activation code');
  }

  const activationCode = validation.activationCode!;
  const now = new Date();
  const statusHistory = activationCode.status_history || [];
  statusHistory.push({
    status: 'used',
    timestamp: now,
    note: `Redeemed by user ${userId}`,
    ip_address: ipAddress
  });

  let result;

  if (activationCode.usage_limit !== undefined) {
    // Usage-limited codes (new system)
    result = await sql(
      `UPDATE activation_codes
       SET current_usage = current_usage + 1, status_history = $1
       WHERE code = $2
       RETURNING *`,
      [JSON.stringify(statusHistory), code]
    );
  } else {
    // One-time use codes (existing system)
    result = await sql(
      `UPDATE activation_codes
       SET used_by = $1, used_at = $2, used_ip_address = $3, status_history = $4
       WHERE code = $5
       RETURNING *`,
      [userId, now.toISOString(), ipAddress, JSON.stringify(statusHistory), code]
    );
  }

  return mapActivationCodeFromDb(result[0] as ActivationCodeRecord);
}

/**
 * Get activation code by code string
 */
export async function getActivationCode(code: string): Promise<ActivationCode | null> {
  const result = await sql(
    'SELECT * FROM activation_codes WHERE code = $1',
    [code]
  );

  if (result.length === 0) {
    return null;
  }

  return mapActivationCodeFromDb(result[0] as ActivationCodeRecord);
}

/**
 * List all activation codes (admin)
 */
export async function listActivationCodes(
  filters: {
    is_active?: boolean;
    used_by?: number;
    campaign_name?: string;
  } = {}
): Promise<ActivationCode[]> {
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(filters.is_active);
  }

  if (filters.used_by !== undefined) {
    conditions.push(`used_by = $${paramIndex++}`);
    params.push(filters.used_by);
  }

  if (filters.campaign_name) {
    conditions.push(`campaign_name = $${paramIndex++}`);
    params.push(filters.campaign_name);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const result = await sql(
    `SELECT * FROM activation_codes ${whereClause} ORDER BY created_at DESC`,
    params
  );

  return result.map((row: unknown) => mapActivationCodeFromDb(row as ActivationCodeRecord));
}

/**
 * Deactivate activation code
 */
export async function deactivateActivationCode(codeId: number): Promise<void> {
  await sql(
    'UPDATE activation_codes SET is_active = false WHERE id = $1',
    [codeId]
  );
}

/**
 * Update activation code
 */
export async function updateActivationCode(
  codeId: number,
  updates: {
    is_active?: boolean;
    expires_at?: Date;
    campaign_name?: string;
    notes?: string;
  }
): Promise<void> {
  const setParts: string[] = [];
  const params: (boolean | string | Date)[] = [];
  let paramIndex = 1;

  if (updates.is_active !== undefined) {
    setParts.push(`is_active = $${paramIndex++}`);
    params.push(updates.is_active);
  }

  if (updates.expires_at !== undefined) {
    setParts.push(`expires_at = $${paramIndex++}`);
    params.push(updates.expires_at.toISOString());
  }

  if (updates.campaign_name !== undefined) {
    setParts.push(`campaign_name = $${paramIndex++}`);
    params.push(updates.campaign_name);
  }

  if (updates.notes !== undefined) {
    setParts.push(`notes = $${paramIndex++}`);
    params.push(updates.notes);
  }

  if (setParts.length === 0) {
    return; // No updates to apply
  }

  params.push(String(codeId));

  await sql(
    `UPDATE activation_codes SET ${setParts.join(', ')} WHERE id = $${paramIndex}`,
    params
  );
}

/**
 * Map database row to ActivationCode interface
 */
function mapActivationCodeFromDb(row: ActivationCodeRecord): ActivationCode {
  // Handle applicable_plans - JSONB columns are automatically parsed by database driver
  let applicablePlans: SubscriptionPlan[];
  if (Array.isArray(row.applicable_plans)) {
    // Already parsed as array (JSONB column behavior)
    applicablePlans = row.applicable_plans as SubscriptionPlan[];
  } else if (typeof row.applicable_plans === 'string') {
    try {
      // String that needs JSON parsing
      applicablePlans = JSON.parse(row.applicable_plans) as SubscriptionPlan[];
    } catch {
      // Fallback: comma-separated string (legacy format)
      applicablePlans = row.applicable_plans.split(',').map((plan: string) => plan.trim() as SubscriptionPlan);
    }
  } else {
    // Unexpected type, use default
    applicablePlans = ['monthly', 'quarterly', 'annual'] as SubscriptionPlan[];
  }

  return {
    id: row.id,
    code: row.code,
    discount_percent: parseFloat(row.discount_percent.toString()),
    applicable_plans: applicablePlans,
    payment_amount: row.payment_amount ? parseFloat(row.payment_amount.toString()) : undefined,
    payment_currency: row.payment_currency,
    payment_amount_usd: row.payment_amount_usd ? parseFloat(row.payment_amount_usd.toString()) : undefined,
    payment_method: row.payment_method as PaymentMethod,
    exchange_rate: row.exchange_rate ? parseFloat(row.exchange_rate.toString()) : undefined,
    payment_reference: row.payment_reference,
    payment_date: row.payment_date ? new Date(row.payment_date) : undefined,
    wallet_address: row.wallet_address,
    bank_reference: row.bank_reference,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
    used_by: row.used_by,
    used_at: row.used_at ? new Date(row.used_at) : undefined,
    used_ip_address: row.used_ip_address,
    is_active: row.is_active,
    campaign_name: row.campaign_name,
    notes: row.notes,
    status_history: Array.isArray(row.status_history) ? row.status_history as StatusHistoryEntry[] : [],
    // New QR code and usage limiting fields
    gcash_qr_url: row.gcash_qr_url,
    gotyme_qr_url: row.gotyme_qr_url,
    usage_limit: row.usage_limit,
    current_usage: row.current_usage
  };
}