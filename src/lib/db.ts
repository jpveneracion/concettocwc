import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

export async function query<T>(sqlQuery: TemplateStringsArray, ...params: (string | number | boolean | null)[]): Promise<T[]> {
  const result = await sql(sqlQuery, ...params);
  return result as T[];
}

/**
 * Database user record interface
 */
interface UserRecord {
  id: string; // UUID in database
  email: string;
  name: string;
  trial_expires_at?: string;
  subscription_activated?: boolean;
  activation_code?: string;
  discount_percent?: number;
  subscription_plan?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Update user subscription information
 */
export async function updateUser(userId: string, updates: {
  trial_expires_at?: string;
  subscription_activated?: boolean;
  activation_code?: string;
  discount_percent?: number;
  subscription_plan?: string;
}): Promise<void> {
  const setClause = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(', ');

  const values = [userId, ...Object.values(updates)];
  await sql(`UPDATE users SET ${setClause} WHERE id = $1`, values);
}

/**
 * Get user by ID with subscription info
 */
export async function getUser(userId: string): Promise<UserRecord> {
  const result = await sql('SELECT * FROM users WHERE id = $1', [userId]);
  return result[0] as UserRecord;
}

/**
 * Payment verification record interface
 */
interface PaymentVerificationRecord {
  id: string;
  user_id: string;
  plan_id: string;
  screenshot_url: string;
  reference_number?: string;
  notes?: string;
  status: string;
  admin_notes?: string;
  admin_id?: string;
  submitted_at: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create payment verification
 */
export async function createPaymentVerification(verification: {
  user_id: string;
  plan_id: string;
  screenshot_url: string;
  reference_number?: string;
  notes?: string;
}): Promise<PaymentVerificationRecord> {
  const result = await sql(
    `INSERT INTO payment_verifications (user_id, plan_id, screenshot_url, reference_number, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      verification.user_id,
      verification.plan_id,
      verification.screenshot_url,
      verification.reference_number || null,
      verification.notes || null
    ]
  );
  return result[0] as PaymentVerificationRecord;
}

/**
 * Get payment verification by ID
 */
export async function getPaymentVerificationById(id: string): Promise<PaymentVerificationRecord | null> {
  const result = await sql('SELECT * FROM payment_verifications WHERE id = $1', [id]);
  return result[0] as PaymentVerificationRecord || null;
}

/**
 * Get payment verifications by user ID
 */
export async function getPaymentVerificationsByUserId(
  userId: string,
  status?: string
): Promise<PaymentVerificationRecord[]> {
  if (status) {
    const result = await sql(
      'SELECT * FROM payment_verifications WHERE user_id = $1 AND status = $2 ORDER BY submitted_at DESC',
      [userId, status]
    );
    return result as PaymentVerificationRecord[];
  }

  const result = await sql(
    'SELECT * FROM payment_verifications WHERE user_id = $1 ORDER BY submitted_at DESC',
    [userId]
  );
  return result as PaymentVerificationRecord[];
}

/**
 * Get pending payment verifications for admin
 */
export async function getPendingVerifications(limit: number = 50, offset: number = 0): Promise<PaymentVerificationRecord[]> {
  const result = await sql(
    `SELECT * FROM payment_verifications
     WHERE status = 'pending'
     ORDER BY submitted_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result as PaymentVerificationRecord[];
}

/**
 * Get all payment verifications with filters (admin)
 */
export async function getAllPaymentVerifications(filters: {
  status?: string;
  user_id?: string;
  plan_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ verifications: PaymentVerificationRecord[]; total: number }> {
  let query = 'SELECT * FROM payment_verifications WHERE 1=1';
  const params: (string | number | boolean | null)[] = [];
  let paramIndex = 1;

  if (filters.status) {
    query += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.user_id) {
    query += ` AND user_id = $${paramIndex}`;
    params.push(filters.user_id);
    paramIndex++;
  }

  if (filters.plan_id) {
    query += ` AND plan_id = $${paramIndex}`;
    params.push(filters.plan_id);
    paramIndex++;
  }

  if (filters.date_from) {
    query += ` AND submitted_at >= $${paramIndex}`;
    params.push(filters.date_from);
    paramIndex++;
  }

  if (filters.date_to) {
    query += ` AND submitted_at <= $${paramIndex}`;
    params.push(filters.date_to);
    paramIndex++;
  }

  if (filters.search) {
    query += ` AND (reference_number ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  // Get total count
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
  const countResult = await sql(countQuery, ...params);
  const total = parseInt((countResult[0] as any).count);

  // Add ordering and pagination
  query += ' ORDER BY submitted_at DESC';

  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(filters.limit);
    paramIndex++;
  }

  if (filters.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(filters.offset);
  }

  const verifications = await sql(query, ...params);

  return {
    verifications: verifications as PaymentVerificationRecord[],
    total
  };
}

/**
 * Update payment verification status
 */
export async function updatePaymentVerificationStatus(
  id: string,
  status: string,
  adminId?: string,
  adminNotes?: string
): Promise<PaymentVerificationRecord | null> {
  const result = await sql(
    `UPDATE payment_verifications
     SET status = $1, admin_id = $2, admin_notes = $3, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, adminId || null, adminNotes || null, id]
  );
  return result[0] as PaymentVerificationRecord || null;
}

/**
 * Get pending verification count
 */
export async function getPendingVerificationCount(): Promise<number> {
  const result = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['pending']);
  return parseInt((result[0] as any).count);
}

/**
 * Get verification statistics
 */
export async function getVerificationStats(): Promise<{
  total_pending: number;
  pending_today: number;
  approved_today: number;
  rejected_today: number;
  total_approved: number;
  total_rejected: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['pending']);
  const pendingTodayResult = await sql(
    'SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1 AND submitted_at >= $2',
    ['pending', today.toISOString()]
  );
  const approvedTodayResult = await sql(
    'SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1 AND reviewed_at >= $2',
    ['approved', today.toISOString()]
  );
  const rejectedTodayResult = await sql(
    'SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1 AND reviewed_at >= $2',
    ['rejected', today.toISOString()]
  );
  const totalApprovedResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['approved']);
  const totalRejectedResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['rejected']);

  return {
    total_pending: parseInt((pendingResult[0] as any).count),
    pending_today: parseInt((pendingTodayResult[0] as any).count),
    approved_today: parseInt((approvedTodayResult[0] as any).count),
    rejected_today: parseInt((rejectedTodayResult[0] as any).count),
    total_approved: parseInt((totalApprovedResult[0] as any).count),
    total_rejected: parseInt((totalRejectedResult[0] as any).count)
  };
}
