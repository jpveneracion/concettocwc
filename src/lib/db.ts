import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { neon } from '@neondatabase/serverless';
import { VerificationStatus, PaymentVerification } from '@/types/payment';
import type { DatabaseRole } from '@/types/roles';

// Database error types for better error handling
export interface DatabaseError extends Error {
  code: 'CONNECTION_ERROR' | 'QUERY_ERROR' | 'TIMEOUT' | 'CONTEXT_ERROR' | 'NOT_FOUND' | 'VALIDATION_ERROR';
  mobileMessage: string;
  details?: Record<string, unknown>;
}

class DatabaseErrorImpl extends Error implements DatabaseError {
  code: DatabaseError['code'];
  mobileMessage: string;
  details?: Record<string, unknown>;

  constructor(
    code: DatabaseError['code'],
    message: string,
    mobileMessage: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.mobileMessage = mobileMessage;
    this.details = details;
  }
}

if (!process.env.DATABASE_URL) {
  throw new DatabaseErrorImpl(
    'VALIDATION_ERROR',
    'DATABASE_URL environment variable is not set',
    'Database configuration error'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false,
  },
});

export type QueryParams = string | number | boolean | Date | null | Buffer;

/**
 * Execute query with RLS tenant context
 * All database operations MUST use this to maintain proper RLS isolation
 * Uses transaction-local configuration to ensure RLS settings only apply to current transaction
 */
export async function query<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params: QueryParams[] = [],
  companyId?: string,
  userRole?: 'user' | 'admin' | 'superadmin'
): Promise<QueryResult<T>> {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Set RLS context with transaction-local scope (third param = true)
    if ((companyId !== undefined && companyId !== null && companyId.trim() !== '') ||
        (userRole !== undefined && userRole !== null && userRole.trim() !== '')) {
      if (companyId !== undefined && companyId !== null && companyId.trim() !== '') {
        await client.query(`SELECT set_config('rls.current_company_id', $1, true)`, [companyId]);
      }
      if (userRole !== undefined && userRole !== null && userRole.trim() !== '') {
        await client.query(`SELECT set_config('rls.current_user_role', $1, true)`, [userRole]);
      }
    }

    // Execute the actual query
    const result = await client.query<T>(sql, params);

    // Commit transaction
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // Rollback on error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.warn('Rollback error:', rollbackError);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    const mobileMessage = 'Database connection issue - please try again';

    throw new DatabaseErrorImpl(
      'QUERY_ERROR',
      `Database query failed: ${errorMessage}`,
      mobileMessage,
      {
        sql: sql.substring(0, 100),
        companyId,
        userRole,
        paramsCount: params?.length,
        originalError: errorMessage
      }
    );
  } finally {
    client.release();
  }
}

// Keep the old sql export for backwards compatibility but deprecate it
export const sql = neon(process.env.DATABASE_URL);

/**
 * Template literal SQL function using pg.Pool connection for RLS compatibility
 * This should be used instead of `sql` when you need RLS policies to work
 * @example
 * const result = await querySQL`SELECT * FROM users WHERE id = ${userId}`;
 */
export async function querySQL<T extends QueryResultRow = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: QueryParams[]
): Promise<T[]> {
  // Convert template literal to parameterized query
  let sql = '';
  const params: QueryParams[] = [];
  let paramIndex = 1;

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < values.length) {
      const value = values[i];
      if (value !== null && value !== undefined) {
        sql += `$${paramIndex}`;
        params.push(value);
        paramIndex++;
      } else {
        sql += 'NULL';
      }
    }
  }

  // Get current RLS context from session if available
  let companyId: string | undefined;
  let userRole: 'user' | 'admin' | 'superadmin' | undefined;

  try {
    // Try to get RLS context from the current session
    const { getCurrentCompanyId, getCurrentUserRole } = await import('./rls');

    const currentCompanyId = await getCurrentCompanyId();
    const currentUserRole = await getCurrentUserRole();

    if (currentCompanyId) companyId = currentCompanyId;
    if (currentUserRole) userRole = currentUserRole;
  } catch (error) {
    // If RLS functions aren't available, proceed without context
    console.debug('RLS context not available:', error);
  }

  const result = await query<T>(sql, params, companyId, userRole);
  return result.rows || [];
}

/**
 * RLS context interface for type safety
 */
export interface RLSContext {
  companyId: string;
  userRole: string;
}

/**
 * Generic database query function with type safety
 * @param sqlQuery - SQL query template string
 * @param params - Query parameters
 * @returns Promise of typed result array
 * @throws Error if query execution fails
 */
/**
 * Database count result interface
 */
interface CountResult {
  count: string;
}

/**
 * Gateway status union type for type safety
 */
type GatewayStatusType = 'online' | 'offline' | 'degraded';

/**
 * Payment method union type for type safety
 */
type PaymentMethod = 'gcash' | 'gotyme' | 'usdc';

/**
 * Database user record interface
 */
interface UserRecord {
  id: string; // UUID in database
  email: string;
  email_hash: string;
  company_id: string;
  role?: string; // User role: 'user', 'admin', 'super_admin'
  trial_expires_at?: Date | null;
  subscription_activated?: boolean | null;
  subscription_plan?: string | null;
  is_admin?: boolean | null;
  password_hash?: string | null;
  activation_code?: string;
  discount_percent?: number;
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
  const startTime = Date.now();

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

    await withRetry(async () =>
      withQueryTimeout(async () =>
        sql(`UPDATE users SET ${setClause} WHERE id = $1`, values)
      )
    );

    const duration = Date.now() - startTime;

    structuredLog(
      'user_updated',
      'updateUser',
      {
        user_id: userId,
        updated_fields: Object.keys(updates)
      },
      duration,
      true
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'user_update_failed',
      'updateUser',
      {
        user_id: userId,
        error: errorMessage
      },
      duration,
      false
    );

    throw new Error(`Failed to update user: ${errorMessage}`);
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
    // Use SECURITY DEFINER function directly through query()
    // RLS context will be set by requireSessionWithRLS wrapper (Task 8)
    const result = await query<{
      user_id: string;
      user_email: string;
      user_email_hash: string;
      user_company_id: string;
      user_role: string | null;
      user_trial_expires_at: Date | null;
      user_subscription_activated: boolean | null;
      user_subscription_plan: string | null;
      user_is_admin: boolean | null;
      user_password_hash: string | null;
      user_created_at: Date;
    }>('SELECT * FROM find_user_by_id($1)', [userId]);

    if (!result.rows[0]) {
      throw new DatabaseErrorImpl('NOT_FOUND', `User with ID ${userId} not found`, 'User account not found');
    }

    return {
      id: result.rows[0].user_id,
      email: result.rows[0].user_email,
      email_hash: result.rows[0].user_email_hash,
      company_id: result.rows[0].user_company_id,
      role: result.rows[0].user_role as DatabaseRole | undefined,
      trial_expires_at: result.rows[0].user_trial_expires_at,
      subscription_activated: result.rows[0].user_subscription_activated,
      subscription_plan: result.rows[0].user_subscription_plan,
      is_admin: result.rows[0].user_is_admin,
      password_hash: result.rows[0].user_password_hash,
      created_at: result.rows[0].user_created_at ? new Date(result.rows[0].user_created_at).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof DatabaseErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new DatabaseErrorImpl('QUERY_ERROR', `Failed to get user: ${errorMessage}`, 'Unable to load user profile', { userId, originalError: errorMessage });
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
  status: VerificationStatus;
  admin_notes?: string;
  admin_id?: string;
  submitted_at: Date;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
  promo_code?: string;
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
  const startTime = Date.now();

  try {
    const result = await withRetry(async () =>
      withQueryTimeout(async () =>
        sql(
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
        )
      )
    );

    const duration = Date.now() - startTime;

    if (!result[0]) {
      structuredLog(
        'payment_verification_creation_failed',
        'createPaymentVerification',
        {
          user_id: verification.user_id,
          plan_id: verification.plan_id,
          error: 'No data returned from database'
        },
        duration,
        false
      );
      throw new Error('Failed to create payment verification record');
    }

    structuredLog(
      'payment_verification_created',
      'createPaymentVerification',
      {
        user_id: verification.user_id,
        plan_id: verification.plan_id,
        has_reference_number: !!verification.reference_number
      },
      duration,
      true
    );

    // Convert database result to match PaymentVerificationRecord interface
    const dbRecord = result[0];
    return {
      ...dbRecord,
      submitted_at: new Date(dbRecord.submitted_at),
      reviewed_at: dbRecord.reviewed_at ? new Date(dbRecord.reviewed_at) : undefined,
      created_at: new Date(dbRecord.created_at),
      updated_at: new Date(dbRecord.updated_at)
    } as PaymentVerificationRecord;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'payment_verification_creation_failed',
      'createPaymentVerification',
      {
        user_id: verification.user_id,
        plan_id: verification.plan_id,
        error: errorMessage
      },
      duration,
      false
    );

    if (error instanceof Error && error.message.includes('Failed to create')) {
      throw error;
    }
    throw new Error(`Payment verification creation failed: ${errorMessage}`);
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
    // Use query() with automatic RLS context instead of raw sql()
    const result = await query('SELECT * FROM payment_verifications WHERE id = $1', [id]);
    return (result.rows[0] as unknown as PaymentVerificationRecord) || null;
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
  status?: 'pending' | 'approved' | 'rejected'
): Promise<PaymentVerificationRecord[]> {
  try {
    let sqlQuery = 'SELECT * FROM payment_verifications WHERE user_id = $1';
    const params: QueryParams[] = [userId];

    if (status) {
      sqlQuery += ' AND status = $2';
      params.push(status);
    }

    sqlQuery += ' ORDER BY submitted_at DESC';

    // Use query() with automatic RLS context
    const result = await query(sqlQuery, params);
    return result.rows as unknown as PaymentVerificationRecord[];
  } catch (error) {
    throw new Error(`Failed to get payment verifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get payment verifications by user ID with plan details
 * @param userId - The ID of the user to get verifications for
 * @param status - Optional status filter (pending, approved, rejected, expired)
 * @returns Promise containing array of payment verification records with plan details
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * // Get all verifications with plan details for user
 * const verifications = await getPaymentVerificationsByUserIdWithPlanDetails('user-uuid');
 *
 * // Get only pending verifications with plan details
 * const pending = await getPaymentVerificationsByUserIdWithPlanDetails('user-uuid', 'pending');
 * ```
 */
export async function getPaymentVerificationsByUserIdWithPlanDetails(
  userId: string,
  status?: 'pending' | 'approved' | 'rejected'
): Promise<PaymentVerification[]> {
  try {
    let query: string;
    let params: (string | number)[];

    if (status) {
      query = `
        SELECT
          pv.*,
          sp.name as plan_name,
          sp.amount as plan_amount
        FROM payment_verifications pv
        LEFT JOIN subscription_plans sp ON pv.plan_id = sp.id
        WHERE pv.user_id = $1 AND pv.status = $2
        ORDER BY pv.submitted_at DESC
      `;
      params = [userId, status];
    } else {
      query = `
        SELECT
          pv.*,
          sp.name as plan_name,
          sp.amount as plan_amount
        FROM payment_verifications pv
        LEFT JOIN subscription_plans sp ON pv.plan_id = sp.id
        WHERE pv.user_id = $1
        ORDER BY pv.submitted_at DESC
      `;
      params = [userId];
    }

    const result = await withQueryTimeout(async () => sql(query, params));
    return result as PaymentVerification[];
  } catch (error) {
    throw new Error(`Failed to get payment verifications with plan details: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  status?: VerificationStatus;
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
    const countResult = await withQueryTimeout(async () => sql(countQuery, params));

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

    const verifications = await withQueryTimeout(async () => sql(query, params));

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
  status: 'approved' | 'rejected',
  adminId?: string,
  adminNotes?: string
): Promise<PaymentVerificationRecord | null> {
  const startTime = Date.now();

  try {
    const result = await withRetry(async () =>
      withQueryTimeout(async () =>
        sql(
          `UPDATE payment_verifications
           SET status = $1, admin_id = $2, admin_notes = $3, reviewed_at = NOW(), updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [status, adminId || null, adminNotes || null, id]
        )
      )
    );

    const duration = Date.now() - startTime;

    structuredLog(
      'payment_verification_status_updated',
      'updatePaymentVerificationStatus',
      {
        verification_id: id,
        new_status: status,
        admin_id: adminId,
        has_notes: !!adminNotes
      },
      duration,
      true
    );

    return (result[0] as PaymentVerificationRecord) || null;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'payment_verification_status_update_failed',
      'updatePaymentVerificationStatus',
      {
        verification_id: id,
        status: status,
        admin_id: adminId,
        error: errorMessage
      },
      duration,
      false
    );

    throw new Error(`Failed to update verification status: ${errorMessage}`);
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

/**
 * GCash webhook data record interface
 */
interface GCashWebhookData {
  id: string;
  transaction_number: string;
  amount: number;
  sender_name?: string;
  sender_account?: string;
  receiver_name?: string;
  receiver_account?: string;
  transaction_time: Date;
  notification_text?: string;
  raw_webhook_payload?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create GCash webhook data record
 * @param webhook - Object containing webhook notification details
 * @param webhook.transaction_number - GCash transaction number (unique identifier)
 * @param webhook.amount - Payment amount
 * @param webhook.sender_name - Optional sender name
 * @param webhook.sender_account - Optional sender account number
 * @param webhook.receiver_name - Optional receiver name
 * @param webhook.receiver_account - Optional receiver account number
 * @param webhook.transaction_time - Transaction timestamp
 * @param webhook.notification_text - Optional notification text content
 * @param webhook.raw_webhook_payload - Optional raw webhook payload data
 * @returns Promise containing the created or updated webhook data record
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const webhook = await createGCashWebhookData({
 *   transaction_number: 'GCASH123456',
 *   amount: 299.00,
 *   sender_name: 'Juan Dela Cruz',
 *   sender_account: '09171234567',
 *   receiver_name: 'Merchant Account',
 *   transaction_time: new Date('2024-01-15T10:30:00Z'),
 *   notification_text: 'You received P299.00 from Juan Dela Cruz'
 * });
 * ```
 */
export async function createGCashWebhookData(webhook: {
  transaction_number: string;
  amount: number;
  sender_name?: string;
  sender_account?: string;
  receiver_name?: string;
  receiver_account?: string;
  transaction_time: Date;
  notification_text?: string;
  raw_webhook_payload?: Record<string, unknown>;
}): Promise<GCashWebhookData> {
  const startTime = Date.now();

  try {
    const result = await withRetry(async () =>
      withQueryTimeout(async () =>
        sql(
          `INSERT INTO gcash_webhook_data (transaction_number, amount, sender_name, sender_account, receiver_name, receiver_account, transaction_time, notification_text, raw_webhook_payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (transaction_number) DO UPDATE SET
             amount = EXCLUDED.amount,
             sender_name = EXCLUDED.sender_name,
             sender_account = EXCLUDED.sender_account,
             receiver_name = EXCLUDED.receiver_name,
             receiver_account = EXCLUDED.receiver_account,
             transaction_time = EXCLUDED.transaction_time,
             notification_text = EXCLUDED.notification_text,
             raw_webhook_payload = EXCLUDED.raw_webhook_payload,
             updated_at = NOW()
           RETURNING *`,
          [
            webhook.transaction_number,
            webhook.amount,
            webhook.sender_name || null,
            webhook.sender_account || null,
            webhook.receiver_name || null,
            webhook.receiver_account || null,
            webhook.transaction_time,
            webhook.notification_text || null,
            JSON.stringify(webhook.raw_webhook_payload || {})
          ]
        )
      )
    );

    const duration = Date.now() - startTime;

    if (!result[0]) {
      structuredLog(
        'gcash_webhook_creation_failed',
        'createGCashWebhookData',
        {
          transaction_number: webhook.transaction_number,
          amount: webhook.amount,
          error: 'No data returned from database'
        },
        duration,
        false
      );
      throw new Error('Failed to create GCash webhook data record');
    }

    structuredLog(
      'gcash_webhook_created',
      'createGCashWebhookData',
      {
        transaction_number: webhook.transaction_number,
        amount: webhook.amount,
        sender_name: webhook.sender_name
      },
      duration,
      true
    );

    return result[0] as GCashWebhookData;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'gcash_webhook_creation_failed',
      'createGCashWebhookData',
      {
        transaction_number: webhook.transaction_number,
        amount: webhook.amount,
        error: errorMessage
      },
      duration,
      false
    );

    if (error instanceof Error && error.message.includes('Failed to create')) {
      throw error;
    }
    throw new Error(`GCash webhook data creation failed: ${errorMessage}`);
  }
}

/**
 * Get GCash webhook data by transaction number
 * @param transactionNumber - The GCash transaction number to search for
 * @returns Promise containing the webhook data record or null if not found
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const webhook = await getGCashWebhookByTransactionNumber('GCASH123456');
 * if (webhook) {
 *   console.log('Webhook received:', webhook.transaction_time);
 * }
 * ```
 */
export async function getGCashWebhookByTransactionNumber(transactionNumber: string): Promise<GCashWebhookData | null> {
  try {
    const result = await sql(
      'SELECT * FROM gcash_webhook_data WHERE transaction_number = $1',
      [transactionNumber]
    );
    return (result[0] as GCashWebhookData) || null;
  } catch (error) {
    throw new Error(`Failed to get GCash webhook data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gateway device heartbeat record interface
 */
interface GatewayHeartbeat {
  id: string;
  device_id: string;
  last_ping: Date;
  status?: GatewayStatusType;
  ip_address?: string;
  battery_level?: number;
  macrodroid_version?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create or update gateway heartbeat record
 * @param heartbeat - Object containing device heartbeat information
 * @param heartbeat.device_id - Unique device identifier
 * @param heartbeat.status - Device status ('online', 'offline', 'degraded')
 * @param heartbeat.ip_address - Optional device IP address
 * @param heartbeat.battery_level - Optional battery level percentage
 * @param heartbeat.macrodroid_version - Optional Macrodroid version
 * @returns Promise containing the created or updated heartbeat record
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const heartbeat = await upsertGatewayHeartbeat({
 *   device_id: 'android-device-001',
 *   status: 'online',
 *   ip_address: '192.168.1.100',
 *   battery_level: 85,
 *   macrodroid_version: '5.2.3'
 * });
 * ```
 */
export async function upsertGatewayHeartbeat(heartbeat: {
  device_id: string;
  status?: GatewayStatusType;
  ip_address?: string;
  battery_level?: number;
  macrodroid_version?: string;
}): Promise<GatewayHeartbeat> {
  const startTime = Date.now();

  try {
    const result = await withRetry(async () =>
      withQueryTimeout(async () =>
        sql(
          `INSERT INTO gateway_device_heartbeat (device_id, last_ping, status, ip_address, battery_level, macrodroid_version)
           VALUES ($1, NOW(), $2, $3, $4, $5)
           ON CONFLICT (device_id) DO UPDATE SET
             last_ping = NOW(),
             status = COALESCE(EXCLUDED.status, gateway_device_heartbeat.status),
             ip_address = EXCLUDED.ip_address,
             battery_level = EXCLUDED.battery_level,
             macrodroid_version = EXCLUDED.macrodroid_version,
             updated_at = NOW()
           RETURNING *`,
          [
            heartbeat.device_id,
            heartbeat.status || 'online',
            heartbeat.ip_address || null,
            heartbeat.battery_level || null,
            heartbeat.macrodroid_version || null
          ]
        )
      )
    );

    const duration = Date.now() - startTime;

    if (!result[0]) {
      structuredLog(
        'gateway_heartbeat_failed',
        'upsertGatewayHeartbeat',
        {
          device_id: heartbeat.device_id,
          status: heartbeat.status,
          error: 'No data returned from database'
        },
        duration,
        false
      );
      throw new Error('Failed to update gateway heartbeat');
    }

    structuredLog(
      'gateway_heartbeat_updated',
      'upsertGatewayHeartbeat',
      {
        device_id: heartbeat.device_id,
        status: heartbeat.status,
        battery_level: heartbeat.battery_level
      },
      duration,
      true
    );

    return result[0] as GatewayHeartbeat;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'gateway_heartbeat_failed',
      'upsertGatewayHeartbeat',
      {
        device_id: heartbeat.device_id,
        status: heartbeat.status,
        error: errorMessage
      },
      duration,
      false
    );

    if (error instanceof Error && error.message.includes('Failed to update')) {
      throw error;
    }
    throw new Error(`Gateway heartbeat update failed: ${errorMessage}`);
  }
}

/**
 * Gateway status response interface
 */
interface GatewayStatus {
  online: boolean;
  last_ago: number;
}

/**
 * Gateway status database result interface
 */
interface GatewayStatusDbResult {
  status: string;
  seconds_ago: number;
}

/**
 * Get current gateway status
 * @returns Promise containing object with gateway online status and seconds since last ping
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const status = await getGatewayStatus();
 * if (status.online) {
 *   console.log(`Gateway online, last ping ${status.last_ago}s ago`);
 * } else {
 *   console.log('Gateway offline or unavailable');
 * }
 * ```
 */
export async function getGatewayStatus(): Promise<GatewayStatus> {
  const startTime = Date.now();

  try {
    const result = await withQueryTimeout(async () =>
      sql(`
        SELECT
          status,
          EXTRACT(EPOCH FROM (NOW() - last_ping)) as seconds_ago
        FROM gateway_device_heartbeat
        ORDER BY last_ping DESC
        LIMIT 1
      `)
    );

    const duration = Date.now() - startTime;

    if (!result[0]) {
      structuredLog(
        'gateway_status_not_found',
        'getGatewayStatus',
        { message: 'No gateway heartbeat records found' },
        duration,
        true
      );

      return { online: false, last_ago: Infinity };
    }

    const row = result[0] as GatewayStatusDbResult;
    const status = {
      online: row.status === 'online' && row.seconds_ago < 1800, // 30 minutes
      last_ago: Math.floor(row.seconds_ago)
    };

    structuredLog(
      'gateway_status_retrieved',
      'getGatewayStatus',
      {
        online: status.online,
        last_ago: status.last_ago,
        db_status: row.status
      },
      duration,
      true
    );

    return status;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'gateway_status_failed',
      'getGatewayStatus',
      { error: errorMessage },
      duration,
      false
    );

    throw new Error(`Failed to get gateway status: ${errorMessage}`);
  }
}

/**
 * Payment settings record interface
 */
interface PaymentSettings {
  id: string;
  payment_method: PaymentMethod;
  active: boolean;
  gcash_device_id?: string;
  gcash_webhook_url?: string;
  gcash_api_key?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get payment settings by payment method
 * @param method - The payment method to retrieve settings for (e.g., 'gcash', 'gotyme', 'usdc')
 * @returns Promise containing the payment settings record or null if not found
 * @throws Error if database operation fails
 * @example
 * ```typescript
 * const gcashSettings = await getPaymentSettings('gcash');
 * if (gcashSettings) {
 *   console.log('GCash webhook URL:', gcashSettings.gcash_webhook_url);
 * }
 * ```
 */
export async function getPaymentSettings(method: PaymentMethod): Promise<PaymentSettings | null> {
  try {
    const result = await sql(
      'SELECT * FROM payment_settings WHERE payment_method = $1 AND active = TRUE',
      [method]
    );
    return (result[0] as PaymentSettings) || null;
  } catch (error) {
    throw new Error(`Failed to get payment settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Structured logging utility for consistent log format
 * @param event - Event name for identification
 * @param functionName - Name of the function generating the log
 * @param details - Additional details to log
 * @param duration - Optional duration in milliseconds
 * @param success - Whether the operation succeeded
 */
function structuredLog(
  event: string,
  functionName: string,
  details: Record<string, unknown>,
  duration?: number,
  success: boolean = true
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    function: functionName,
    success,
    duration,
    ...details
  };

  // In production, this would go to a proper logging system
  // For now, we'll use console.error for failures and console.log for success
  if (success) {
    console.log(JSON.stringify(logEntry));
  } else {
    console.error(JSON.stringify(logEntry));
  }
}

/**
 * Retry utility with exponential backoff for transient database failures
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000ms)
 * @returns Promise of the function result with retry logic
 * @throws Error if all retries fail
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt);

      structuredLog(
        'retry_attempt',
        'withRetry',
        {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delayMs: delay,
          error: lastError.message
        },
        delay,
        false
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Query timeout wrapper to prevent long-running queries
 * @param fn - Function to execute with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns Promise of the function result with timeout protection
 * @throws Error if timeout is exceeded
 */
async function withQueryTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout exceeded ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Execute database operations with RLS tenant context
 * This wrapper automatically sets the tenant context before operations
 * and resets it after completion, ensuring proper isolation.
 *
 * @param companyId - The company ID UUID for tenant context
 * @param userRole - The user role ('user', 'admin', 'superadmin')
 * @param operation - Function to execute with tenant context
 * @returns Promise of the operation result
 * @throws Error if context setup fails or operation fails
 *
 * @example
 * ```typescript
 * const result = await withRLSContext(
 *   session.companyId,
 *   session.role || 'user',
 *   async () => {
 *     return await sql('SELECT * FROM quotes');
 *   }
 * );
 * ```
 */
export async function withRLSContext<T>(
  companyId: string,
  userRole: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    // Validate inputs
    if (!companyId) {
      throw new Error('Company ID is required for RLS context');
    }

    if (!userRole) {
      throw new Error('User role is required for RLS context');
    }

    if (!['user', 'admin', 'superadmin'].includes(userRole)) {
      throw new Error(`Invalid user role: ${userRole}`);
    }

    // Set tenant context using direct transaction-local calls
    await sql(`
      SELECT set_config('rls.current_company_id', $1, true),
             set_config('rls.current_user_role', $2, true)
    `, [companyId, userRole]);

    try {
      // Execute the operation with tenant context
      const result = await operation();

      const duration = Date.now() - startTime;

      structuredLog(
        'rls_operation_success',
        'withRLSContext',
        {
          company_id: companyId,
          user_role: userRole,
          duration
        },
        duration,
        true
      );

      return result;
    } finally {
      // Always reset context, even if operation fails
      try {
        await sql('SELECT reset_tenant_context()');
      } catch (resetError) {
        // Log but don't throw if reset fails
        const errorMessage = resetError instanceof Error ? resetError.message : 'Unknown error';
        structuredLog(
          'rls_context_reset_failed',
          'withRLSContext',
          {
            company_id: companyId,
            error: errorMessage
          },
          Date.now() - startTime,
          false
        );
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    structuredLog(
      'rls_operation_failed',
      'withRLSContext',
      {
        company_id: companyId,
        user_role: userRole,
        error: errorMessage,
        duration
      },
      duration,
      false
    );

    throw error;
  }
}

/**
 * Execute database operations with admin RLS context
 * Convenience wrapper for admin operations
 *
 * @param companyId - The company ID UUID for tenant context
 * @param operation - Function to execute with admin context
 * @returns Promise of the operation result
 * @throws Error if context setup fails or operation fails
 *
 * @example
 * ```typescript
 * const result = await withAdminRLSContext(
 *   session.companyId,
 *   async () => {
 *     return await sql('SELECT * FROM admin_dashboard');
 *   }
 * );
 * ```
 */
export async function withAdminRLSContext<T>(
  companyId: string,
  operation: () => Promise<T>
): Promise<T> {
  return withRLSContext(companyId, 'admin', operation);
}

/**
 * Execute database operations with superadmin RLS context
 * Superadmin can access all companies' data
 *
 * @param operation - Function to execute with superadmin context
 * @returns Promise of the operation result
 * @throws Error if context setup fails or operation fails
 *
 * @example
 * ```typescript
 * const result = await withSuperadminRLSContext(async () => {
 *   return await sql('SELECT * FROM all_companies_data');
 * });
 * ```
 */
export async function withSuperadminRLSContext<T>(
  operation: () => Promise<T>
): Promise<T> {
  // Superadmin operations use a special context company ID
  // This allows access to all companies' data
  const SUPERADMIN_CONTEXT_ID = '00000000-0000-0000-0000-000000000000';
  return withRLSContext(SUPERADMIN_CONTEXT_ID, 'superadmin', operation);
}

/**
 * Check if RLS context is currently set
 * @returns Promise indicating if tenant context is active
 *
 * @example
 * ```typescript
 * const hasContext = await hasRLSContext();
 * if (!hasContext) {
 *   console.warn('No RLS context set - queries may not be properly isolated');
 * }
 * ```
 */
export async function hasRLSContext(): Promise<boolean> {
  try {
    const result = await sql('SELECT get_current_company_id() as company_id');
    return result[0] && result[0].company_id !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get current RLS context information
 * @returns Promise with RLS context or null if not set
 *
 * @example
 * ```typescript
 * const context = await getRLSContext();
 * if (context) {
 *   console.log(`Current company: ${context.companyId}, role: ${context.userRole}`);
 * }
 * ```
 */
export async function getRLSContext(): Promise<RLSContext | null> {
  try {
    const result = await sql(`
      SELECT
        get_current_company_id() as company_id,
        get_current_user_role() as user_role
    `);

    if (!result[0] || !result[0].company_id) {
      return null;
    }

    return {
      companyId: result[0].company_id,
      userRole: result[0].user_role
    };
  } catch (error) {
    return null;
  }
}

