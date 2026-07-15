import { sql } from '@/lib/db';
import type { OAuthAccount, OAuthProvider, OAuthUserInfo, AccountLinkRequest, PiUserInfo } from '@/types/oauth';

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
interface UserRecord {
  id: string;
  email: string;
  email_hash: string;
  password_hash?: string;
  company_id: string;
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
}

// Find existing OAuth account
export async function findOAuthAccount(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccount | null> {
  const results = await sql`
    SELECT * FROM oauth_accounts
    WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
  `;
  if (!results[0]) return null;

  return results[0] as unknown as OAuthAccount;
}

// Find user by email
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const emailHash = hashEmail(email);
  const results = await sql`
    SELECT id, email, email_hash, password_hash, company_id
    FROM users
    WHERE email_hash = ${emailHash}
  `;
  return (results[0] as UserRecord) || null;
}

// Link OAuth account to existing user
export async function linkOAuthAccount(userId: string, accountData: AccountLinkRequest): Promise<OAuthAccount> {
  const [account] = await sql`
    INSERT INTO oauth_accounts (
      user_id, provider, provider_user_id, email, username,
      wallet_address, access_token, refresh_token, expires_at
    ) VALUES (
      ${userId}, ${accountData.provider}, ${accountData.provider_user_id},
      ${accountData.email}, ${accountData.username || null},
      ${accountData.wallet_address || null}, ${accountData.access_token || null},
      ${accountData.refresh_token || null}, ${accountData.expires_at || null}
    )
    RETURNING *
  `;
  return account as unknown as OAuthAccount;
}

// Create new user with OAuth account
export async function createUserWithOAuth(email: string, companyId: string, accountData: AccountLinkRequest): Promise<{ user: UserRecord; oauthAccount: OAuthAccount }> {
  const emailHash = hashEmail(email);

  // Create user without password_hash (OAuth users authenticate via OAuth providers)
  const [user] = await sql`
    INSERT INTO users (company_id, email, email_hash)
    VALUES (${companyId}, ${email}, ${emailHash})
    RETURNING id, email, company_id
  `;

  // Link OAuth account
  const oauthAccount = await linkOAuthAccount(user.id, accountData);

  return { user: user as UserRecord, oauthAccount };
}

// Validate company code
export async function validateCompanyCode(companyCode: string): Promise<CompanyRecord | null> {
  const results = await sql`
    SELECT id, code, name FROM companies
    WHERE UPPER(code) = ${companyCode.toUpperCase()}
  `;
  return (results[0] as CompanyRecord) || null;
}

// Create new company
export async function createCompany(companyData: CompanyData): Promise<CompanyRecord> {
  const [company] = await sql`
    INSERT INTO companies (code, name, address, mobile, email)
    VALUES (
      ${companyData.code.toUpperCase()},
      ${companyData.name},
      ${companyData.address || ''},
      ${companyData.mobile || ''},
      ${companyData.email || ''}
    )
    RETURNING id, code, name
  `;
  return company as CompanyRecord;
}

// Get OAuth accounts by user ID
export async function getOAuthAccountsByUserId(userId: string): Promise<OAuthAccount[]> {
  const results = await sql`
    SELECT * FROM oauth_accounts WHERE user_id = ${userId} ORDER BY created_at
  `;
  return results as unknown as OAuthAccount[];
}