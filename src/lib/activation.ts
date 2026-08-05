// src/lib/activation.ts

import {
  ActivationCode,
  GenerateActivationCodeRequest,
  PaymentMethod,
  SubscriptionPlan,
  StatusHistoryEntry
} from '@/types/subscription';
import { sql, query } from './db';
import { mapPlanIdToSubscriptionPlan } from './subscription-activation';

/**
 * Convert plan identifier (UUID or SubscriptionPlan enum) to SubscriptionPlan enum
 * Handles both UUID-based plan identifiers and direct enum values
 */
async function resolvePlanIdentifier(
  planIdentifier: string | SubscriptionPlan
): Promise<SubscriptionPlan> {
  // If already a SubscriptionPlan enum value, return as-is
  if (typeof planIdentifier === 'string' &&
      ['monthly', 'quarterly', 'annual'].includes(planIdentifier)) {
    return planIdentifier as SubscriptionPlan;
  }

  // Handle legacy plan identifiers (BASIC, PRO, etc.) by mapping to appropriate billing periods
  const legacyPlanMapping: Record<string, SubscriptionPlan> = {
    'basic': SubscriptionPlan.MONTHLY,
    'pro': SubscriptionPlan.MONTHLY,
    'premium': SubscriptionPlan.MONTHLY,
    'enterprise': SubscriptionPlan.ANNUAL
  };

  const lowerIdentifier = typeof planIdentifier === 'string'
    ? planIdentifier.toLowerCase()
    : planIdentifier;

  if (lowerIdentifier in legacyPlanMapping) {
    return legacyPlanMapping[lowerIdentifier];
  }

  // Otherwise, treat as UUID and use the existing mapping function
  try {
    const mapping = await mapPlanIdToSubscriptionPlan(planIdentifier as string);
    if (!mapping) {
      throw new Error(`Subscription plan not found: ${planIdentifier}`);
    }
    return mapping.subscriptionPlan;
  } catch (error) {
    console.error('Error resolving plan identifier:', error);
    throw new Error(`Failed to resolve plan identifier: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

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
 * Format: Short, memorable codes like "early10", "summer25", etc.
 */
export function generateActivationCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  // Generate 6-8 character short code
  const length = Math.floor(Math.random() * 3) + 6; // 6-8 characters
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code; // Format: early10, summer25, etc.
}

/**
 * Create promo code in database (without payment details)
 */
export async function createPromoCode(
  discountPercent: number,
  applicablePlans: string[],
  expiresAt: Date | undefined,
  campaignName: string | undefined,
  notes: string | undefined,
  createdBy: string,
  qrCodes?: { gcash?: string; gotyme?: string },
  usageLimit?: number,
  customCode?: string, // Optional custom code
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
): Promise<ActivationCode> {
  const code = customCode || generateActivationCode();
  const now = new Date();

  const status_history: StatusHistoryEntry[] = [{
    status: 'created',
    timestamp: now,
    note: `Promo code created for campaign: ${campaignName || 'general'}`
  }];

  const sqlText = `INSERT INTO activation_codes (
      code, discount_percent, applicable_plans,
      created_by, expires_at, campaign_name, notes,
      status_history, gcash_qr_url, gotyme_qr_url, usage_limit, current_usage,
      payment_currency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`;

  const sqlParams: any[] = [
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
  ];

  let row: ActivationCodeRecord;
  if (rlsContext) {
    const result = await query<ActivationCodeRecord>(sqlText, sqlParams, rlsContext.companyId, rlsContext.userRole);
    row = result.rows[0] as ActivationCodeRecord;
  } else {
    const result = await sql(sqlText, sqlParams);
    row = result[0] as ActivationCodeRecord;
  }

  return mapActivationCodeFromDb(row);
}

/**
 * Create activation code in database
 */
export async function createActivationCode(
  request: GenerateActivationCodeRequest,
  createdBy: string,
  qrCodes?: { gcash?: string; gotyme?: string },
  usageLimit?: number,
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
): Promise<ActivationCode> {
  const code = generateActivationCode();
  const now = new Date();

  const status_history: StatusHistoryEntry[] = [{
    status: 'created',
    timestamp: now,
    note: `Generated for ${request.payment_method} payment ${request.payment_reference}`
  }];

  const sqlParams: any[] = [
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
  ];

  let row: ActivationCodeRecord;
  if (rlsContext) {
    const result = await query<ActivationCodeRecord>(
      `INSERT INTO activation_codes (
      code, discount_percent, applicable_plans,
      payment_amount, payment_currency, payment_method,
      payment_reference, payment_date,
      created_by, expires_at, campaign_name, notes,
      status_history, gcash_qr_url, gotyme_qr_url, usage_limit, current_usage
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
      sqlParams,
      rlsContext.companyId,
      rlsContext.userRole
    );
    row = result.rows[0] as ActivationCodeRecord;
  } else {
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
    row = result[0] as ActivationCodeRecord;
  }

  return mapActivationCodeFromDb(row);
}

/**
 * Validate activation code with enhanced usage limiting support
 */
export async function validateActivationCode(
  code: string,
  plan: string | SubscriptionPlan,
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
): Promise<ActivationCode | null> {
  // Resolve plan identifier to SubscriptionPlan enum
  const resolvedPlan = await resolvePlanIdentifier(plan);

  let result;
  if (rlsContext) {
    const queryResult = await query<ActivationCodeRecord>(
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
      [code],
      rlsContext.companyId,
      rlsContext.userRole
    );
    result = queryResult.rows;
  } else {
    result = await sql(
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
  }

  if (result.length === 0) {
    return null;
  }

  const activationCode = mapActivationCodeFromDb(result[0] as ActivationCodeRecord);

  // Check if code applies to requested plan
  if (!activationCode.applicable_plans.includes(resolvedPlan)) {
    return null;
  }

  return activationCode;
}

/**
 * Validate activation code with detailed error messages
 */
export async function validateActivationCodeWithDetails(
  code: string,
  plan: string | SubscriptionPlan,
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
): Promise<{ valid: boolean; activationCode?: ActivationCode; error?: string }> {
  // Resolve plan identifier to SubscriptionPlan enum
  const resolvedPlan = await resolvePlanIdentifier(plan);

  let result;
  if (rlsContext) {
    const queryResult = await query<ActivationCodeRecord>(
      `SELECT * FROM activation_codes WHERE code = $1`,
      [code],
      rlsContext.companyId,
      rlsContext.userRole
    );
    result = queryResult.rows;
  } else {
    result = await sql(
      `SELECT * FROM activation_codes WHERE code = $1`,
      [code]
    );
  }

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
  if (!activationCode.applicable_plans.includes(resolvedPlan)) {
    return { valid: false, error: `Promo code not applicable to ${resolvedPlan} plan` };
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
  plan: string | SubscriptionPlan,
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
): Promise<ActivationCode> {
  const validation = await validateActivationCodeWithDetails(code, plan, rlsContext);

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

  // Increment usage via SECURITY DEFINER function. This bypasses RLS tenant
  // isolation on activation_codes so a promo created by one company can be
  // redeemed by another (payment approval runs as the acting admin's company,
  // and a direct UPDATE would otherwise affect 0 rows and stay at 0 usage).
  // The function handles both usage-limited (current_usage+1) and one-time
  // (used_by/used_at) codes.
  const incrementParams = [code, userId, ipAddress, JSON.stringify(statusHistory)];
  if (rlsContext) {
    const queryResult = await query<ActivationCodeRecord>(
      `SELECT * FROM increment_promo_usage($1, $2, $3, $4::jsonb)`,
      incrementParams,
      rlsContext.companyId,
      rlsContext.userRole
    );
    result = queryResult.rows;
  } else {
    result = await sql(
      `SELECT * FROM increment_promo_usage($1, $2, $3, $4::jsonb)`,
      incrementParams
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
  } = {},
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
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

  let rows: ActivationCodeRecord[];
  if (rlsContext) {
    // Run via db.query() so RLS context is set in the same transaction
    const result = await query<ActivationCodeRecord>(
      `SELECT * FROM activation_codes ${whereClause} ORDER BY created_at DESC`,
      params,
      rlsContext.companyId,
      rlsContext.userRole
    );
    rows = result.rows;
  } else {
    rows = await sql(
      `SELECT * FROM activation_codes ${whereClause} ORDER BY created_at DESC`,
      params
    ) as unknown as ActivationCodeRecord[];
  }

  return rows.map((row: unknown) => mapActivationCodeFromDb(row as ActivationCodeRecord));
}

/**
 * Deactivate activation code
 * Uses SECURITY DEFINER function to bypass RLS infinite recursion
 */
export async function deactivateActivationCode(
  codeId: number,
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin'; userId?: string }
): Promise<void> {
  await query(
    'SELECT deactivate_activation_code($1, $2, $3, $4)',
    [codeId, rlsContext?.companyId || '', rlsContext?.userRole || 'user', rlsContext?.userId || ''],
    rlsContext?.companyId,
    rlsContext?.userRole
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
  },
  rlsContext?: { companyId: string; userRole: 'user' | 'admin' | 'superadmin' }
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

  const sqlText = `UPDATE activation_codes SET ${setParts.join(', ')} WHERE id = $${paramIndex}`;

  if (rlsContext) {
    await query(sqlText, params, rlsContext.companyId, rlsContext.userRole);
  } else {
    await sql(sqlText, params);
  }
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