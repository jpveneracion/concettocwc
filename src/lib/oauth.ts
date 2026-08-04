import { sql } from '@/lib/db';
import type { OAuthAccount, OAuthProvider, OAuthUserInfo, AccountLinkRequest, PiUserInfo } from '@/types/oauth';
import type { DatabaseRole } from '@/types/roles';

// OAuth error interface for better error handling
export interface OAuthError extends Error {
  code: 'ACCOUNT_NOT_FOUND' | 'USER_NOT_FOUND' | 'COMPANY_NOT_FOUND' | 'ACCOUNT_CREATION_FAILED' | 'USER_CREATION_FAILED' | 'COMPANY_CREATION_FAILED' | 'VALIDATION_ERROR';
  mobileMessage: string;
  details?: Record<string, unknown>;
}

class OAuthErrorImpl extends Error implements OAuthError {
  code: OAuthError['code'];
  mobileMessage: string;
  details?: Record<string, unknown>;

  constructor(
    code: OAuthError['code'],
    message: string,
    mobileMessage: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.mobileMessage = mobileMessage;
    this.details = details;
  }
}

// Simple string-based email hashing (Edge Runtime compatible)
function hashEmail(email: string): string {
  // Simple hash function for email lookup (not for security)
  const normalized = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16) + normalized.length.toString(16);
}

// User record interface for OAuth operations
export interface UserRecord {
  id: string;
  email: string;
  email_hash: string;
  password_hash?: string;
  company_id: string;
  role?: DatabaseRole; // User role with standardized type
}

// Company record interface
interface CompanyRecord {
  id: string;
  code: string;
  name: string;
}

// Company data interface for creation
interface CompanyData {
  code: string;
  name: string;
  address?: string;
  mobile?: string;
  email?: string;
  minimum_area_sqft?: number;
}

// Find existing OAuth account (uses SECURITY DEFINER function to bypass RLS for OAuth)
export async function findOAuthAccount(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccount | null> {
  try {
    // Use SECURITY DEFINER function to bypass RLS during OAuth authentication
    const { query } = await import('@/lib/db');

    const result = await query<{
      oauth_account_id: string;
      oauth_user_id: string;
      oauth_provider: string;
      oauth_provider_user_id: string;
    }>(
      'SELECT * FROM find_oauth_account_by_provider($1, $2)',
      [provider, providerUserId]
    );

    if (!result.rows[0]) {
      return null;
    }

    // Map the SECURITY DEFINER function result to OAuthAccount interface
    return {
      id: result.rows[0].oauth_account_id,
      user_id: result.rows[0].oauth_user_id, // Map oauth_user_id to user_id
      provider: result.rows[0].oauth_provider as OAuthProvider,
      provider_user_id: result.rows[0].oauth_provider_user_id,
      email: null,
      username: null,
      wallet_address: null,
      access_token: null,
      refresh_token: null,
      expires_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'ACCOUNT_NOT_FOUND',
      `Failed to find OAuth account: ${errorMessage}`,
      'Unable to find OAuth account - please try again',
      { provider, providerUserId, originalError: errorMessage }
    );
  }
}

// Find user by email (uses SECURITY DEFINER function to bypass RLS for OAuth)
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  try {
    const emailHash = hashEmail(email);

    // Use SECURITY DEFINER function to bypass RLS during OAuth authentication
    const { query } = await import('@/lib/db');

    const result = await query<{
      user_id: string;
      user_email: string;
      user_email_hash: string;
      user_company_id: string;
      user_role: string | null;
    }>(
      'SELECT * FROM find_user_by_email_hash($1)',
      [emailHash]
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      id: result.rows[0].user_id,
      email: result.rows[0].user_email,
      email_hash: result.rows[0].user_email_hash,
      company_id: result.rows[0].user_company_id,
      role: result.rows[0].user_role as DatabaseRole | undefined
    };
  } catch (error) {
    if (error instanceof OAuthErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'USER_NOT_FOUND',
      `Failed to find user by email: ${errorMessage}`,
      'Unable to find user account - please try again',
      { email, originalError: errorMessage }
    );
  }
}

// Link OAuth account to existing user (uses SECURITY DEFINER function)
export async function linkOAuthAccount(userId: string, accountData: AccountLinkRequest): Promise<OAuthAccount> {
  try {
    // Use SECURITY DEFINER function for OAuth account creation during signup
    const { query } = await import('@/lib/db');

    const accountResult = await query<{
      oauth_account_id: string;
      oauth_user_id: string;
      oauth_provider: string;
    }>(
      `SELECT * FROM create_oauth_account($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        accountData.provider,
        accountData.provider_user_id,
        accountData.email,
        accountData.username || null,
        accountData.access_token || null,
        accountData.refresh_token || null,
        accountData.expires_at || null
      ]
    );

    if (!accountResult.rows[0]) {
      throw new OAuthErrorImpl(
        'ACCOUNT_CREATION_FAILED',
        'Failed to create OAuth account',
        'Unable to link OAuth account - please try again'
      );
    }

    // Get the full OAuth account record to return
    const fullAccount = await query<OAuthAccount>(
      `SELECT * FROM oauth_accounts WHERE id = $1`,
      [accountResult.rows[0].oauth_account_id]
    );

    if (!fullAccount.rows[0]) {
      throw new OAuthErrorImpl(
        'ACCOUNT_CREATION_FAILED',
        'Failed to retrieve created OAuth account',
        'Unable to retrieve OAuth account - please try again'
      );
    }

    return fullAccount.rows[0];
  } catch (error) {
    if (error instanceof OAuthErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'ACCOUNT_CREATION_FAILED',
      `Failed to link OAuth account: ${errorMessage}`,
      'Unable to link OAuth account - please try again',
      { userId, originalError: errorMessage }
    );
  }
}

// Create new user with OAuth account (uses SECURITY DEFINER functions)
export async function createUserWithOAuth(email: string, companyId: string, accountData: AccountLinkRequest): Promise<{ user: UserRecord; oauthAccount: OAuthAccount }> {
  try {
    const emailHash = hashEmail(email);

    // Use SECURITY DEFINER function for initial user creation during OAuth signup
    const { query } = await import('@/lib/db');

    const userResult = await query<{user_id: string, user_email: string, user_company_id: string, user_role: string}>(
      `SELECT * FROM create_user_with_oauth($1, $2, $3)`,
      [companyId, email, emailHash]
    );

    if (!userResult.rows[0]) {
      throw new OAuthErrorImpl(
        'USER_CREATION_FAILED',
        'Failed to create user',
        'Unable to create user account - please try again'
      );
    }

    const user: UserRecord = {
      id: userResult.rows[0].user_id,
      email: userResult.rows[0].user_email,
      email_hash: emailHash,
      company_id: userResult.rows[0].user_company_id,
      role: userResult.rows[0].user_role as DatabaseRole
    };

    // Link OAuth account using SECURITY DEFINER function
    const oauthAccount = await linkOAuthAccount(user.id, accountData);

    return { user, oauthAccount };
  } catch (error) {
    if (error instanceof OAuthErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'USER_CREATION_FAILED',
      `Failed to create user with OAuth: ${errorMessage}`,
      'Unable to create user account - please try again',
      { email, companyId, originalError: errorMessage }
    );
  }
}

// Validate company code
export async function validateCompanyCode(companyCode: string): Promise<CompanyRecord | null> {
  try {
    const results = await sql`
      SELECT id, code, name FROM companies
      WHERE UPPER(code) = ${companyCode.toUpperCase()}
    `;
    return (results[0] as CompanyRecord) || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'COMPANY_NOT_FOUND',
      `Failed to validate company code: ${errorMessage}`,
      'Unable to validate company code - please try again',
      { companyCode, originalError: errorMessage }
    );
  }
}

// Create new company (uses SECURITY DEFINER function for OAuth signup)
export async function createCompany(companyData: CompanyData): Promise<CompanyRecord> {
  try {
    const minimumArea = Number.isFinite(companyData.minimum_area_sqft) && (companyData.minimum_area_sqft ?? 0) >= 0
      ? (companyData.minimum_area_sqft as number)
      : 15;

    // Use SECURITY DEFINER function for initial company creation during OAuth signup
    // This follows the mypiroll pattern for RLS bypass during signup
    const { query } = await import('@/lib/db');

    const result = await query<{company_id: string, company_code: string, company_name: string}>(
      `SELECT * FROM create_company_with_context($1, $2, $3, $4, $5, $6)`,
      [
        companyData.code.toUpperCase(),
        companyData.name,
        companyData.address || '',
        companyData.mobile || '',
        companyData.email || '',
        minimumArea
      ]
    );

    if (!result.rows[0]) {
      throw new OAuthErrorImpl(
        'COMPANY_CREATION_FAILED',
        'Failed to create company',
        'Unable to create company - please try again'
      );
    }

    // Map SECURITY DEFINER function result to CompanyRecord interface
    return {
      id: result.rows[0].company_id,
      code: result.rows[0].company_code,
      name: result.rows[0].company_name
    };
  } catch (error) {
    if (error instanceof OAuthErrorImpl) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'COMPANY_CREATION_FAILED',
      `Failed to create company: ${errorMessage}`,
      'Unable to create company - please try again',
      { companyCode: companyData.code, originalError: errorMessage }
    );
  }
}

// Get OAuth accounts by user ID
export async function getOAuthAccountsByUserId(userId: string): Promise<OAuthAccount[]> {
  try {
    const results = await sql`
      SELECT * FROM oauth_accounts WHERE user_id = ${userId} ORDER BY created_at
    `;
    return results as unknown as OAuthAccount[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthErrorImpl(
      'ACCOUNT_NOT_FOUND',
      `Failed to get OAuth accounts: ${errorMessage}`,
      'Unable to retrieve OAuth accounts - please try again',
      { userId, originalError: errorMessage }
    );
  }
}