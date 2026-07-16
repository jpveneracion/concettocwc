import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

/**
 * Generic database query function with type safety
 * @param sqlQuery - SQL query template string
 * @param params - Query parameters
 * @returns Promise of typed result array
 * @throws Error if query execution fails
 */
export async function query<T>(sqlQuery: TemplateStringsArray, ...params: (string | number | boolean | null)[]): Promise<T[]> {
  try {
    const result = await sql(sqlQuery, ...params);
    return result as T[];
  } catch (error) {
    throw new Error(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Database count result interface
 */
interface CountResult {
  count: string;
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
 * @param userId - The unique identifier of the user to update
 * @param updates - Object containing the fields to update (all optional)
 * @returns Promise that resolves when update is complete
 * @throws Error if update fails or user doesn't exist
 * @example
 * ```typescript
 * await updateUser('user-uuid', {
 *   subscription_activated: true,
 *   subscription_plan: 'premium',
 *   trial_expires_at: '2024-12-31'
 * });
 * ```
 */
export async function updateUser(userId: string, updates: {
  trial_expires_at?: string;
  subscription_activated?: boolean;
  activation_code?: string;
  discount_percent?: number;
  subscription_plan?: string;
}): Promise<void> {
  try {
    // Build dynamic SET clause based on provided fields
    // Maps object keys to parameterized SQL to prevent SQL injection
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [userId, ...Object.values(updates)];

    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    await sql(`UPDATE users SET ${setClause} WHERE id = $1`, values);
  } catch (error) {
    throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user by ID with subscription info
 * @param userId - The unique identifier of the user
 * @returns Promise containing the user record with subscription information
 * @throws Error if user not found or database operation fails
 */
export async function getUser(userId: string): Promise<UserRecord> {
  try {
    const result = await sql('SELECT * FROM users WHERE id = $1', [userId]);

    if (!result[0]) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return result[0] as UserRecord;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
 * @param verification - Object containing payment verification details
 * @param verification.user_id - The ID of the user submitting the verification
 * @param verification.plan_id - The ID of the subscription plan being verified
 * @param verification.screenshot_url - URL to the payment screenshot image
 * @param verification.reference_number - Optional payment reference number
 * @param verification.notes - Optional additional notes from user
 * @returns Promise containing the created payment verification record
 * @throws Error if creation fails or validation errors occur
 * @example
 * ```typescript
 * const verification = await createPaymentVerification({
 *   user_id: 'user-uuid',
 *   plan_id: 'plan-uuid',
 *   screenshot_url: 'https://example.com/screenshot.jpg',
 *   reference_number: 'REF123456',
 *   notes: 'Payment via GCash'
 * });
 * ```
 */
export async function createPaymentVerification(verification: {
  user_id: string;
  plan_id: string;
  screenshot_url: string;
  reference_number?: string;
  notes?: string;
}): Promise<PaymentVerificationRecord> {
  try {
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

    if (!result[0]) {
      throw new Error('Failed to create payment verification record');
    }

    return result[0] as PaymentVerificationRecord;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to create')) {
      throw error;
    }
    throw new Error(`Payment verification creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get payment verification by ID
 * @param id - The unique identifier of the payment verification
 * @returns Promise containing the payment verification record or null if not found
 * @throws Error if database operation fails
 */
export async function getPaymentVerificationById(id: string): Promise<PaymentVerificationRecord | null> {
  try {
    const result = await sql('SELECT * FROM payment_verifications WHERE id = $1', [id]);
    return (result[0] as PaymentVerificationRecord) || null;
  } catch (error) {
    throw new Error(`Failed to get payment verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get payment verifications by user ID with optional status filtering
 * @param userId - The unique identifier of the user
 * @param status - Optional status filter ('pending', 'approved', 'rejected')
 * @returns Promise containing array of payment verification records
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * // Get all verifications for user
 * const verifications = await getPaymentVerificationsByUserId('user-uuid');
 *
 * // Get only pending verifications
 * const pending = await getPaymentVerificationsByUserId('user-uuid', 'pending');
 * ```
 */
export async function getPaymentVerificationsByUserId(
  userId: string,
  status?: string
): Promise<PaymentVerificationRecord[]> {
  try {
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
  } catch (error) {
    throw new Error(`Failed to get payment verifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get pending payment verifications for admin review
 * @param limit - Maximum number of records to return (default: 50)
 * @param offset - Number of records to skip for pagination (default: 0)
 * @returns Promise containing array of pending payment verification records
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * // Get first 50 pending verifications
 * const pending = await getPendingVerifications();
 *
 * // Get next 50 pending verifications (pagination)
 * const nextPending = await getPendingVerifications(50, 50);
 * ```
 */
export async function getPendingVerifications(limit: number = 50, offset: number = 0): Promise<PaymentVerificationRecord[]> {
  try {
    const result = await sql(
      `SELECT * FROM payment_verifications
       WHERE status = 'pending'
       ORDER BY submitted_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result as PaymentVerificationRecord[];
  } catch (error) {
    throw new Error(`Failed to get pending verifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all payment verifications with advanced filtering (admin function)
 * Supports filtering by status, user, plan, date range, and text search
 *
 * @param filters - Object containing filter criteria (all optional)
 * @param filters.status - Filter by verification status ('pending', 'approved', 'rejected')
 * @param filters.user_id - Filter by specific user ID
 * @param filters.plan_id - Filter by specific subscription plan ID
 * @param filters.date_from - Filter by submissions after this date (ISO string)
 * @param filters.date_to - Filter by submissions before this date (ISO string)
 * @param filters.search - Search in reference_number and notes fields (case-insensitive)
 * @param filters.limit - Maximum records to return (default: no limit)
 * @param filters.offset - Records to skip for pagination (default: 0)
 * @returns Promise containing object with verifications array and total count
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * // Get all pending verifications from a specific date range
 * const result = await getAllPaymentVerifications({
 *   status: 'pending',
 *   date_from: '2024-01-01',
 *   date_to: '2024-12-31',
 *   limit: 100
 * });
 *
 * // Search for specific reference numbers
 * const searchResult = await getAllPaymentVerifications({
 *   search: 'REF123456'
 * });
 * ```
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
  try {
    // Build dynamic WHERE clause based on provided filters
    // Each condition uses parameterized queries to prevent SQL injection
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
      // ILIKE provides case-insensitive pattern matching in PostgreSQL
      query += ` AND (reference_number ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Get total count matching the filters (before pagination)
    // This helps frontend calculate total pages
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await sql(countQuery, params);

    // Use type-safe interface instead of 'any' cast
    const total = parseInt((countResult[0] as CountResult).count);

    // Add ordering and pagination to main query
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

    const verifications = await sql(query, params);

    return {
      verifications: verifications as PaymentVerificationRecord[],
      total
    };
  } catch (error) {
    throw new Error(`Failed to get filtered verifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update payment verification status with admin review information
 * Automatically sets reviewed_at and updated_at timestamps
 *
 * @param id - The unique identifier of the payment verification to update
 * @param status - The new status ('approved' or 'rejected')
 * @param adminId - Optional ID of the admin performing the review
 * @param adminNotes - Optional notes from the admin about the decision
 * @returns Promise containing the updated payment verification record or null if not found
 * @throws Error if update fails
 * @example
 * ```typescript
 * // Approve a verification
 * const approved = await updatePaymentVerificationStatus(
 *   'verification-id',
 *   'approved',
 *   'admin-id',
 *   'Payment confirmed via bank statement'
 * );
 *
 * // Reject a verification
 * const rejected = await updatePaymentVerificationStatus(
 *   'verification-id',
 *   'rejected',
 *   'admin-id',
 *   'Screenshot unclear - please resubmit'
 * );
 * ```
 */
export async function updatePaymentVerificationStatus(
  id: string,
  status: string,
  adminId?: string,
  adminNotes?: string
): Promise<PaymentVerificationRecord | null> {
  try {
    const result = await sql(
      `UPDATE payment_verifications
       SET status = $1, admin_id = $2, admin_notes = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, adminId || null, adminNotes || null, id]
    );
    return (result[0] as PaymentVerificationRecord) || null;
  } catch (error) {
    throw new Error(`Failed to update verification status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get count of pending payment verifications
 * Useful for admin dashboards and notification systems
 *
 * @returns Promise containing the count of pending verifications
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const pendingCount = await getPendingVerificationCount();
 * console.log(`${pendingCount} verifications awaiting review`);
 * ```
 */
export async function getPendingVerificationCount(): Promise<number> {
  try {
    const result = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['pending']);
    // Use type-safe interface instead of 'any' cast
    return parseInt((result[0] as CountResult).count);
  } catch (error) {
    throw new Error(`Failed to get pending verification count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get comprehensive verification statistics for admin dashboard
 * Provides counts for pending verifications and daily activity metrics
 *
 * @returns Promise containing object with various statistics:
 * - `total_pending`: All pending verifications
 * - `pending_today`: Verifications submitted today
 * - `approved_today`: Verifications approved today
 * - `rejected_today`: Verifications rejected today
 * - `total_approved`: All approved verifications (historical)
 * - `total_rejected`: All rejected verifications (historical)
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const stats = await getVerificationStats();
 * console.log(`Pending reviews: ${stats.total_pending}`);
 * console.log(`Today's activity: ${stats.approved_today} approved, ${stats.rejected_today} rejected`);
 * ```
 */
export async function getVerificationStats(): Promise<{
  total_pending: number;
  pending_today: number;
  approved_today: number;
  rejected_today: number;
  total_approved: number;
  total_rejected: number;
}> {
  try {
    // Calculate today's date at midnight for daily statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Execute multiple queries in parallel for better performance
    const [
      pendingResult,
      pendingTodayResult,
      approvedTodayResult,
      rejectedTodayResult,
      totalApprovedResult,
      totalRejectedResult
    ] = await Promise.all([
      sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['pending']),
      sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1 AND submitted_at >= $2', ['pending', today.toISOString()]),
      sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1 AND reviewed_at >= $2', ['approved', today.toISOString()]),
      sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1 AND reviewed_at >= $2', ['rejected', today.toISOString()]),
      sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['approved']),
      sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['rejected'])
    ]);

    // Use type-safe interface instead of 'any' casts
    return {
      total_pending: parseInt((pendingResult[0] as CountResult).count),
      pending_today: parseInt((pendingTodayResult[0] as CountResult).count),
      approved_today: parseInt((approvedTodayResult[0] as CountResult).count),
      rejected_today: parseInt((rejectedTodayResult[0] as CountResult).count),
      total_approved: parseInt((totalApprovedResult[0] as CountResult).count),
      total_rejected: parseInt((totalRejectedResult[0] as CountResult).count)
    };
  } catch (error) {
    throw new Error(`Failed to get verification statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
