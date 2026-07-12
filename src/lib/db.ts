import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

export async function query<T>(sqlQuery: TemplateStringsArray, ...params: any[]): Promise<T[]> {
  const result = await sql(sqlQuery, ...params);
  return result as T[];
}

/**
 * Database user record interface
 */
interface UserRecord {
  id: number;
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
export async function updateUser(userId: number, updates: {
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
export async function getUser(userId: number): Promise<UserRecord> {
  const result = await sql('SELECT * FROM users WHERE id = $1', [userId]);
  return result[0] as UserRecord;
}
