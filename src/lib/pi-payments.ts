// src/lib/pi-payments.ts
// Server-side helpers for Pi Network payments (sandbox/test flow).
// Flow: SDK createPayment (client, Pi Browser) -> approve (this lib) -> complete (this lib).

import { query, type RLSContext } from '@/lib/db';

const PI_API_BASE = 'https://api.minepi.com/v2';

// 1 Pi = 1 USD equivalent; plans are priced in PHP, so convert PHP -> USD -> Pi.
const DEFAULT_PHP_TO_USD_RATE = 0.0178571; // ~56 PHP per USD
const DEFAULT_PI_USD_PRICE = 1.0; // Fallback if the live price feed is unavailable

export function getPhpToUsdRate(): number {
  const raw = process.env.PHP_TO_USD_RATE;
  const rate = raw ? Number(raw) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) {
    return DEFAULT_PHP_TO_USD_RATE;
  }
  return rate;
}

// ============================================================================
// Live Pi price (USD), cached for 60s. Falls back to 1 USD on failure.
// ============================================================================

let cachedPiUsdPrice: number | null = null;
let cachedPiUsdPriceAt = 0;
const PI_PRICE_TTL_MS = 60_000;
const PI_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd';

export async function getPiUsdPrice(): Promise<number> {
  const now = Date.now();
  if (cachedPiUsdPrice !== null && now - cachedPiUsdPriceAt < PI_PRICE_TTL_MS) {
    return cachedPiUsdPrice;
  }

  try {
    const res = await fetch(PI_PRICE_URL);
    if (!res.ok) {
      throw new Error(`CoinGecko responded with status ${res.status}`);
    }
    const data = await res.json();
    const price = Number(data?.['pi-network']?.usd);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Invalid Pi price payload from CoinGecko');
    }
    cachedPiUsdPrice = price;
    cachedPiUsdPriceAt = now;
    return price;
  } catch (error) {
    console.error('Failed to fetch live Pi price, falling back to 1 USD:', error);
    cachedPiUsdPrice = DEFAULT_PI_USD_PRICE;
    cachedPiUsdPriceAt = now;
    return DEFAULT_PI_USD_PRICE;
  }
}

/**
 * Pi amount for a PHP plan price: (PHP -> USD) / live Pi price.
 * Pass piUsdPrice to reuse a single fetch across callers.
 */
export async function computePiAmount(amountPhp: number, piUsdPrice?: number): Promise<number> {
  const usd = amountPhp * getPhpToUsdRate();
  const price = piUsdPrice ?? (await getPiUsdPrice());
  // Round to 6 decimals (Pi platform precision)
  return Math.round((usd / price) * 1_000_000) / 1_000_000;
}

export function getPiApiKey(): string | null {
  const key = process.env.PI_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

/**
 * Call the Pi payments API server-to-server.
 * Authenticates with the app's API key (Authorization: Key <api_key>).
 */
export async function callPiPaymentsApi(
  path: string,
  method: 'POST' | 'GET' = 'POST'
): Promise<{ ok: boolean; status: number; data: any }> {
  const apiKey = getPiApiKey();
  if (!apiKey) {
    throw new Error('PI_API_KEY is not configured');
  }

  const res = await fetch(`${PI_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

export async function approvePiPayment(paymentId: string): Promise<void> {
  const result = await callPiPaymentsApi(`/payments/${paymentId}/approve`);
  if (!result.ok) {
    throw new Error(
      `Pi approve failed (${result.status}): ${JSON.stringify(result.data ?? {})}`
    );
  }
}

export async function completePiPayment(paymentId: string): Promise<void> {
  const result = await callPiPaymentsApi(`/payments/${paymentId}/complete`);
  if (!result.ok) {
    throw new Error(
      `Pi complete failed (${result.status}): ${JSON.stringify(result.data ?? {})}`
    );
  }
}

// ============================================================================
// DB helpers (pi_payments table, RLS-context aware like payment_verifications)
// ============================================================================

export interface PiPaymentRecord {
  id: string;
  payment_id: string;
  user_id: string;
  company_id: string;
  plan_id: string;
  amount_pi: number;
  amount_php: number;
  memo: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  txid: string | null;
  subscription_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function upsertPiPayment(
  data: {
    payment_id: string;
    user_id: string;
    company_id: string;
    plan_id: string;
    amount_pi: number;
    amount_php: number;
    memo?: string | null;
    metadata?: Record<string, unknown> | null;
    status: string;
    txid?: string | null;
    subscription_id?: string | null;
  },
  rlsContext: RLSContext
): Promise<PiPaymentRecord> {
  const result = await query<PiPaymentRecord>(
    `INSERT INTO pi_payments
       (payment_id, user_id, company_id, plan_id, amount_pi, amount_php, memo, metadata, status, txid, subscription_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (payment_id) DO UPDATE SET
       status = EXCLUDED.status,
       txid = COALESCE(EXCLUDED.txid, pi_payments.txid),
       subscription_id = COALESCE(EXCLUDED.subscription_id, pi_payments.subscription_id),
       metadata = COALESCE(EXCLUDED.metadata, pi_payments.metadata),
       updated_at = NOW()
     RETURNING *`,
    [
      data.payment_id,
      data.user_id,
      data.company_id,
      data.plan_id,
      data.amount_pi,
      data.amount_php,
      data.memo ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.status,
      data.txid ?? null,
      data.subscription_id ?? null,
    ],
    rlsContext.companyId,
    rlsContext.userRole
  );

  if (!result.rows[0]) {
    throw new Error('Failed to record Pi payment');
  }
  return result.rows[0];
}

export async function getPiPaymentByPaymentId(
  paymentId: string,
  rlsContext: RLSContext
): Promise<PiPaymentRecord | null> {
  const result = await query<PiPaymentRecord>(
    `SELECT * FROM pi_payments WHERE payment_id = $1 LIMIT 1`,
    [paymentId],
    rlsContext.companyId,
    rlsContext.userRole
  );
  return result.rows[0] ?? null;
}
