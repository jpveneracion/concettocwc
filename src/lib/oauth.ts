import { sql } from '@/lib/db';
import crypto from 'crypto';
import type { OAuthAccount, OAuthProvider, OAuthUserInfo, AccountLinkRequest, PiUserInfo } from '@/types/oauth';

// Find existing OAuth account
export async function findOAuthAccount(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccount | null> {
  const results = await sql`
    SELECT * FROM oauth_accounts
    WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
  `;
  if (!results[0]) return null;

  return results[0] as OAuthAccount;
}

// Find user by email
export async function findUserByEmail(email: string): Promise<any> {
  const emailHash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  const results = await sql`
    SELECT id, email, email_hash, password_hash, company_id
    FROM users
    WHERE email_hash = ${emailHash}
  `;
  return results[0] || null;
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
  return account as OAuthAccount;
}

// Create new user with OAuth account
export async function createUserWithOAuth(email: string, companyId: string, accountData: AccountLinkRequest): Promise<{ user: any; oauthAccount: OAuthAccount }> {
  const emailHash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

  // Create user without password_hash (OAuth users authenticate via OAuth providers)
  const [user] = await sql`
    INSERT INTO users (company_id, email, email_hash)
    VALUES (${companyId}, ${email}, ${emailHash})
    RETURNING id, email, company_id
  `;

  // Link OAuth account
  const oauthAccount = await linkOAuthAccount(user.id, accountData);

  return { user, oauthAccount };
}

// Validate company code
export async function validateCompanyCode(companyCode: string): Promise<any> {
  const results = await sql`
    SELECT id, code, name FROM companies
    WHERE UPPER(code) = ${companyCode.toUpperCase()}
  `;
  return results[0] || null;
}

// Create new company
export async function createCompany(companyData: any): Promise<any> {
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
  return company;
}

// Get OAuth accounts by user ID
export async function getOAuthAccountsByUserId(userId: string): Promise<OAuthAccount[]> {
  const results = await sql`
    SELECT * FROM oauth_accounts WHERE user_id = ${userId} ORDER BY created_at
  `;
  return results as OAuthAccount[];
}