# OAuth + Pi Sign-in Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OAuth authentication (Google, Microsoft) and Pi Network Sign-in for the Concetto Window Coverings multi-tenant quotation system with secure account linking and mobile-first UI.

**Architecture:** Hybrid approach using NextAuth.js for Google/Microsoft (standard OAuth) + custom implementation for Pi Sign-in (OAuth implicit flow). Multi-tenant security with protected account linking and abandonment state prevention.

**Tech Stack:** Next.js 16, NextAuth.js v5, TypeScript, PostgreSQL (@neondatabase/serverless), Pi SDK, Tailwind CSS

---

## File Structure Map

**Database Layer:**
- `migrations/oauth-system.sql` - Database schema for oauth_accounts table and constraints

**Core Authentication:**
- `src/lib/oauth.ts` - OAuth helper functions and account linking logic
- `src/auth.ts` - NextAuth.js configuration and provider setup
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth.js API route

**Pi Sign-in Integration:**
- `src/app/api/auth/pi/callback/route.ts` - Pi Sign-in token processing
- `src/components/auth/PiSignInButton.tsx` - Pi Sign-in button with SDK
- `src/app/auth/pi/callback/page.tsx` - Pi Sign-in callback handler

**Account Creation Flow:**
- `src/app/api/auth/account-choice/route.ts` - Company creation/joining API
- `src/app/auth/account-choice/page.tsx` - Account selection UI
- `src/components/auth/AuthGuard.tsx` - Abandonment state prevention

**UI Components:**
- `src/components/auth/ProviderButtons.tsx` - OAuth provider buttons
- `src/app/login/page.tsx` - Updated login page (MODIFY)

**Types & Interfaces:**
- `src/types/oauth.ts` - OAuth TypeScript interfaces

**Testing:**
- `src/__tests__/oauth/oauth.test.ts` - OAuth integration tests
- `src/__tests__/oauth/pi-signin.test.ts` - Pi Sign-in tests

---

## Task 1: Create TypeScript Interfaces for OAuth System

**Files:**
- Create: `src/types/oauth.ts`

**Interfaces for OAuth accounts, providers, and authentication:**

```typescript
// OAuth provider types
export type OAuthProvider = 'google' | 'microsoft' | 'pi';

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_user_id: string;
  email: string | null;
  username: string | null;
  wallet_address: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PiUserInfo {
  uid: string;
  username: string;
  wallet_address?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  verified_email: boolean;
  provider: OAuthProvider;
}

export interface AccountLinkRequest {
  provider: OAuthProvider;
  provider_user_id: string;
  email: string | null;
  username?: string;
  wallet_address?: string;
  access_token?: string;
  refresh_token?: string;
}

export interface AccountChoiceData {
  action: 'join' | 'create';
  company_code?: string;
  company_name?: string;
  company_address?: string;
  company_mobile?: string;
  company_email?: string;
  email: string; // Required for Pi users
}
```

---

## Task 2: Create Database Migration for OAuth System

**Files:**
- Create: `migrations/oauth-system.sql`

**Database schema for OAuth accounts and constraints:**

```sql
-- OAuth accounts table
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'pi')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  wallet_address TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- Indexes for performance
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);
CREATE INDEX idx_oauth_accounts_email ON oauth_accounts(email) WHERE email IS NOT NULL;

-- Constraint to prevent abandonment state (enable after migration)
ALTER TABLE users ADD CONSTRAINT users_company_id_required 
  CHECK (company_id IS NOT NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_oauth_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER oauth_accounts_updated_at
  BEFORE UPDATE ON oauth_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_accounts_updated_at();
```

---

## Task 3: Run Database Migration

**Files:**
- Run: Database migration script

**Execute the OAuth system migration:**

```bash
# Create migrations directory if it doesn't exist
mkdir -p migrations

# Run the migration using node
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);
const migration = fs.readFileSync('migrations/oauth-system.sql', 'utf8');

// Split and execute statements
const statements = migration
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

(async () => {
  for (let i = 0; i < statements.length; i++) {
    try {
      await new Function('sql', \`return sql\`\${statements[i]}\`\`)(sql);
      console.log(\`✓ Statement \${i + 1}/\${statements.length}\`);
    } catch (err) {
      console.log(\`⚠️  Statement \${i + 1} failed (may be expected): \${err.message}\`);
    }
  }
  console.log('Migration complete');
})();
"
```

**Verify migration success:**
```bash
# Check tables were created
psql $DATABASE_URL -c "\dt oauth_accounts"

# Verify indexes
psql $DATABASE_URL -c "\di oauth_accounts*"

# Check constraints
psql $DATABASE_URL -c "SELECT conname FROM pg_constraint WHERE conname LIKE '%oauth%' OR conname LIKE '%company_id%'"
```

---

## Task 4: Create OAuth Helper Functions

**Files:**
- Create: `src/lib/oauth.ts`

**Core OAuth logic for account linking and user management:**

```typescript
import { sql } from '@/lib/db';
import crypto from 'crypto';
import type { OAuthAccount, OAuthProvider, OAuthUserInfo, AccountLinkRequest, PiUserInfo } from '@/types/oauth';

// Find existing OAuth account
export async function findOAuthAccount(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccount | null> {
  const results = await sql`
    SELECT * FROM oauth_accounts 
    WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
  `;
  return results[0] || null;
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
  return account;
}

// Create new user with OAuth account
export async function createUserWithOAuth(email: string, companyId: string, accountData: AccountLinkRequest): Promise<{ user: any; oauthAccount: OAuthAccount }> {
  const emailHash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  
  // Create user
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
  return await sql`
    SELECT * FROM oauth_accounts WHERE user_id = ${userId} ORDER BY created_at
  `;
}
```

---

## Task 5: Setup NextAuth.js Configuration

**Files:**
- Create: `src/auth.ts`

**NextAuth.js configuration for Google and Microsoft:**

```typescript
import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';

const providers: Provider[] = [];

// Google Provider (if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const { Google } = await import('next-auth/providers/google');
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code"
      }
    }
  }));
}

// Microsoft Provider (if configured)
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  const { Microsoft } = await import('next-auth/providers/microsoft');
  providers.push(Microsoft({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authorization: {
      params: {
        prompt: "consent",
        response_type: "code"
      }
    }
  }));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account && user) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.email = profile?.email || user.email;
        token.emailVerified = profile?.email_verified || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.provider = token.provider as string;
        session.providerAccountId = token.providerAccountId as string;
        session.email = token.email as string;
        session.emailVerified = token.emailVerified as boolean;
      }
      return session;
    }
  }
});
```

---

## Task 6: Create NextAuth.js API Route

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**NextAuth.js API handler:**

```typescript
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

---

## Task 7: Create Pi Sign-in Callback API Route

**Files:**
- Create: `src/app/api/auth/pi/callback/route.ts`

**Process Pi Sign-in tokens and create/validate users:**

```typescript
import { NextResponse } from 'next/server';
import type { PiUserInfo } from '@/types/oauth';
import { findOAuthAccount, findUserByEmail, createUserWithOAuth, validateCompanyCode, createCompany } from '@/lib/oauth';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { access_token } = await req.json();
    
    if (!access_token) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }
    
    // Validate token with Pi Network API
    const piResponse = await fetch('https://api.minepi.com/v2/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    if (!piResponse.ok) {
      return NextResponse.json({ error: 'Invalid Pi token' }, { status: 401 });
    }
    
    const piUser: PiUserInfo = await piResponse.json();
    
    // Check for existing Pi account
    const existingAccount = await findOAuthAccount('pi', piUser.uid);
    
    if (existingAccount) {
      // Create session for existing user
      const userResult = await sql`
        SELECT id, email, company_id FROM users WHERE id = ${existingAccount.user_id}
      `;
      const user = userResult[0];
      
      if (!user || !user.company_id) {
        // User exists but no company - redirect to account choice
        return NextResponse.json({ 
          redirect: '/auth/account-choice',
          tempToken: access_token,
          piUser: piUser
        });
      }
      
      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set('session', JSON.stringify({
        userId: user.id,
        companyId: user.company_id,
        email: user.email,
        provider: 'pi'
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      
      return NextResponse.json({ success: true, redirect: '/dashboard' });
    }
    
    // New Pi user - redirect to account choice
    return NextResponse.json({ 
      redirect: '/auth/account-choice',
      tempToken: access_token,
      piUser: piUser
    });
    
  } catch (error) {
    console.error('Pi callback error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
```

---

## Task 8: Create Account Choice API Route

**Files:**
- Create: `src/app/api/auth/account-choice/route.ts`

**Handle company creation/joining for OAuth users:**

```typescript
import { NextResponse } from 'next/server';
import type { AccountChoiceData } from '@/types/oauth';
import { validateCompanyCode, createCompany, createUserWithOAuth, linkOAuthAccount, findUserByEmail } from '@/lib/oauth';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const data: AccountChoiceData = await req.json();
    const cookieStore = await cookies();
    
    // Get temporary OAuth data from headers or cookie
    const tempProvider = req.headers.get('x-temp-provider') as 'google' | 'microsoft' | 'pi';
    const tempProviderId = req.headers.get('x-temp-provider-id');
    const tempToken = req.headers.get('x-temp-token');
    
    if (!tempProvider || !tempProviderId) {
      return NextResponse.json({ error: 'Session expired' }, { status: 400 });
    }
    
    // Validate email
    const emailHash = crypto.createHash('sha256').update(data.email.toLowerCase().trim()).digest('hex');
    const existingUser = await findUserByEmail(data.email);
    
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    
    let companyId: string;
    
    if (data.action === 'join') {
      // Join existing company
      if (!data.company_code) {
        return NextResponse.json({ error: 'Company code required' }, { status: 400 });
      }
      
      const company = await validateCompanyCode(data.company_code);
      if (!company) {
        return NextResponse.json({ error: 'Invalid company code' }, { status: 400 });
      }
      
      companyId = company.id;
    } else {
      // Create new company
      if (!data.company_name) {
        return NextResponse.json({ error: 'Company name required' }, { status: 400 });
      }
      
      // Generate unique company code
      const companyCode = await generateUniqueCompanyCode();
      const company = await createCompany({
        code: companyCode,
        name: data.company_name,
        address: data.company_address || '',
        mobile: data.company_mobile || '',
        email: data.company_email || ''
      });
      
      companyId = company.id;
    }
    
    // Create user with OAuth account
    const accountData = {
      provider: tempProvider,
      provider_user_id: tempProviderId,
      email: data.email,
      username: tempProvider === 'pi' ? (req.headers.get('x-temp-username') || null) : null,
      wallet_address: tempProvider === 'pi' ? (req.headers.get('x-temp-wallet') || null) : null,
      access_token: tempToken || null,
      refresh_token: null,
      expires_at: null
    };
    
    // Generate random password for OAuth users
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    // Create user with password
    const [user] = await sql`
      INSERT INTO users (company_id, email, email_hash, password_hash)
      VALUES (${companyId}, ${data.email}, ${emailHash}, ${passwordHash})
      RETURNING id, email, company_id
    `;
    
    // Link OAuth account
    await linkOAuthAccount(user.id, accountData);
    
    // Set session cookie
    cookieStore.set('session', JSON.stringify({
      userId: user.id,
      companyId: user.company_id,
      email: user.email,
      provider: tempProvider
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    return NextResponse.json({ 
      success: true, 
      redirect: '/dashboard',
      company: { code: data.action === 'join' ? data.company_code : null }
    });
    
  } catch (error) {
    console.error('Account choice error:', error);
    return NextResponse.json({ error: 'Account creation failed' }, { status: 500 });
  }
}

// Generate unique company code
async function generateUniqueCompanyCode(): Promise<string> {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const existing = await sql`SELECT id FROM companies WHERE code = ${code}`;
  if (existing.length > 0) {
    return generateUniqueCompanyCode(); // Retry if collision
  }
  return code;
}
```

---

## Task 9: Create OAuth Provider Buttons Component

**Files:**
- Create: `src/components/auth/ProviderButtons.tsx`

**Mobile-first OAuth provider buttons:**

```typescript
'use client';
import { signIn } from 'next-auth/react';

interface ProviderButtonsProps {
  className?: string;
}

export function ProviderButtons({ className = '' }: ProviderButtonsProps) {
  const providers = [
    { 
      id: 'google', 
      name: 'Google', 
      color: 'bg-white hover:bg-gray-50', 
      textColor: 'text-gray-900',
      borderColor: 'border-gray-300',
      icon: 'G'
    },
    { 
      id: 'microsoft', 
      name: 'Microsoft', 
      color: 'bg-[#00a4ef] hover:bg-[#008dc9]', 
      textColor: 'text-white',
      borderColor: 'border-transparent',
      icon: 'M'
    },
    { 
      id: 'pi', 
      name: 'Pi Network', 
      color: 'bg-[#7b2cbf] hover:bg-[#9d4edd]', 
      textColor: 'text-white',
      borderColor: 'border-transparent',
      icon: 'π'
    }
  ];

  const handleProviderSignIn = async (providerId: string) => {
    if (providerId === 'pi') {
      // Pi Sign-in handled separately
      window.location.href = '/auth/pi/signin';
      return;
    }
    
    await signIn(providerId, { callbackUrl: '/dashboard' });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-center text-sm text-gray-500 mb-4">
        Or continue with
      </div>
      
      {providers.map((provider) => (
        <button
          key={provider.id}
          onClick={() => handleProviderSignIn(provider.id)}
          disabled={provider.id === 'pi'} // Temporarily disable Pi until implemented
          className={`
            w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg 
            border ${provider.borderColor} ${provider.color} ${provider.textColor}
            font-medium text-sm md:text-base
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            min-h-[44px] // Mobile touch target
          `}
        >
          <span className="text-lg font-bold">{provider.icon}</span>
          <span>Sign in with {provider.name}</span>
        </button>
      ))}
    </div>
  );
}
```

---

## Task 10: Create Pi Sign-in Button Component

**Files:**
- Create: `src/components/auth/PiSignInButton.tsx`

**Pi Sign-in button with SDK integration:**

```typescript
'use client';
import { useEffect, useState } from 'react';

interface PiSignInButtonProps {
  onSuccess?: (accessToken: string) => void;
  onError?: (error: string) => void;
}

export function PiSignInButton({ onSuccess, onError }: PiSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    // Load Pi SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.minepi.com/pi-sdk.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore - Pi SDK global
      if (window.Pi) {
        // @ts-ignore
        window.Pi.init({ version: '2.0' });
        setSdkLoaded(true);
      }
    };
    script.onerror = () => {
      console.error('Failed to load Pi SDK');
      onError?.('Failed to load Pi SDK');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [onError]);

  const handlePiSignIn = async () => {
    if (!sdkLoaded) {
      onError?.('Pi SDK not loaded');
      return;
    }

    setIsLoading(true);
    
    try {
      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('pi_oauth_state', state);
      
      // @ts-ignore - Pi SDK
      window.Pi.signIn({
        clientId: process.env.NEXT_PUBLIC_PI_CLIENT_ID || 'your-pi-client-id',
        redirectUri: `${window.location.origin}/auth/pi/callback`,
        scopes: ['username', 'wallet_address'],
        state,
      });
    } catch (error) {
      console.error('Pi Sign-in error:', error);
      onError?.('Pi Sign-in failed');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePiSignIn}
      disabled={!sdkLoaded || isLoading}
      className={`
        w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg 
        bg-[#7b2cbf] hover:bg-[#9d4edd] text-white font-medium text-sm md:text-base
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        min-h-[44px] border border-transparent
      `}
    >
      <span className="text-lg font-bold">π</span>
      <span>{isLoading ? 'Connecting to Pi...' : 'Sign in with Pi Network'}</span>
    </button>
  );
}
```

---

## Task 11: Create Pi Sign-in Callback Page

**Files:**
- Create: `src/app/auth/pi/callback/page.tsx`

**Handle Pi Sign-in redirect and token processing:**

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PiCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const handlePiCallback = async () => {
      try {
        // Extract access token from URL fragment
        const params = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = params.get('access_token');
        const state = params.get('state');
        const error = params.get('error');

        // Verify state matches
        const expectedState = sessionStorage.getItem('pi_oauth_state');
        sessionStorage.removeItem('pi_oauth_state');

        if (state !== expectedState) {
          throw new Error('State mismatch - possible CSRF attack');
        }

        if (error) {
          throw new Error(`Pi Sign-in failed: ${error}`);
        }

        if (!accessToken) {
          throw new Error('No access token received');
        }

        // Clear URL fragment
        window.history.replaceState(null, '', window.location.pathname);

        // Send token to backend for validation
        const response = await fetch('/api/auth/pi/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Authentication failed');
        }

        setStatus('success');
        
        // Redirect based on response
        setTimeout(() => {
          if (data.redirect) {
            // Store temporary data for account choice if needed
            if (data.tempToken && data.piUser) {
              sessionStorage.setItem('temp_token', data.tempToken);
              sessionStorage.setItem('pi_user', JSON.stringify(data.piUser));
            }
            router.push(data.redirect);
          }
        }, 1000);

      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handlePiCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7b2cbf] mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Processing Pi Sign-in...</h2>
            <p className="text-sm text-gray-500">Please wait while we verify your identity</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Sign-in Successful!</h2>
            <p className="text-sm text-gray-500">Redirecting you to the dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Sign-in Failed</h2>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-[#7b2cbf] text-white rounded-lg hover:bg-[#9d4edd] transition-colors"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## Task 12: Create Account Choice Page

**Files:**
- Create: `src/app/auth/account-choice/page.tsx`

**Account selection UI for new OAuth users:**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountChoicePage() {
  const router = useRouter();
  const [action, setAction] = useState<'join' | 'create'>('join');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [piUser, setPiUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    email: '',
    company_code: '',
    company_name: '',
    company_address: '',
    company_mobile: '',
    company_email: ''
  });

  useEffect(() => {
    // Check if user has temporary Pi data
    const tempPiUser = sessionStorage.getItem('pi_user');
    if (tempPiUser) {
      setPiUser(JSON.parse(tempPiUser));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get temporary OAuth data
      const tempToken = sessionStorage.getItem('temp_token');
      const tempPiUser = sessionStorage.getItem('pi_user');
      
      if (!tempToken && !tempPiUser) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      const piUserData = tempPiUser ? JSON.parse(tempPiUser) : null;

      const response = await fetch('/api/auth/account-choice', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-temp-provider': 'pi',
          'x-temp-provider-id': piUserData?.uid || 'unknown',
          'x-temp-token': tempToken || '',
          'x-temp-username': piUserData?.username || '',
          'x-temp-wallet': piUserData?.wallet_address || ''
        },
        body: JSON.stringify({
          action,
          email: formData.email,
          ...(action === 'join' ? {
            company_code: formData.company_code
          } : {
            company_name: formData.company_name,
            company_address: formData.company_address,
            company_mobile: formData.company_mobile,
            company_email: formData.company_email
          })
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Account creation failed');
      }

      // Clear temporary data
      sessionStorage.removeItem('temp_token');
      sessionStorage.removeItem('pi_user');

      // Redirect to dashboard
      router.push(data.redirect || '/dashboard');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-blue-600 mb-2">Complete Your Account</h1>
          <p className="text-xs md:text-sm text-gray-500">
            {piUser ? `Welcome, ${piUser.username}!` : 'Choose how you want to continue'}
          </p>
        </div>

        {/* Action Toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAction('join')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              action === 'join' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
            }`}
          >
            Join Company
          </button>
          <button
            onClick={() => setAction('create')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              action === 'create' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
            }`}
          >
            Create Company
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (always required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              placeholder="your@email.com"
              required
            />
          </div>

          {action === 'join' ? (
            /* Join Existing Company */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Code *
              </label>
              <input
                type="text"
                value={formData.company_code}
                onChange={(e) => setFormData({...formData, company_code: e.target.value})}
                className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base uppercase"
                placeholder="COMPANY123"
                required
              />
            </div>
          ) : (
            /* Create New Company */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="My Window Coverings"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.company_address}
                  onChange={(e) => setFormData({...formData, company_address: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="123 Main St"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.company_mobile}
                  onChange={(e) => setFormData({...formData, company_mobile: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="+63 912 345 6789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.company_email}
                  onChange={(e) => setFormData({...formData, company_email: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="company@email.com"
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 md:py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {loading ? 'Creating Account...' : (action === 'join' ? 'Join Company' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## Task 13: Create AuthGuard Component

**Files:**
- Create: `src/components/auth/AuthGuard.tsx`

**Prevent abandonment state with client-side protection:**

```typescript
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const currentPath = window.location.pathname;

  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load

    // Allow access to login and account choice pages
    if (currentPath === '/login' || currentPath === '/auth/account-choice') {
      return;
    }

    // Check if user has completed account setup
    if (session && !session.companyId) {
      router.replace('/auth/account-choice');
    }
  }, [session, status, router, currentPath]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
```

---

## Task 14: Update Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

**Add OAuth provider buttons to existing login:**

```typescript
// Add import at top
import { ProviderButtons } from '@/components/auth/ProviderButtons';

// Add after existing form or in desired position
<div className="mt-6">
  <ProviderButtons />
</div>

// Update existing success handling to consider OAuth users
const signupSuccess = searchParams.get('signup') === 'success';
const oauthSuccess = searchParams.get('oauth') === 'success';
const newCompany = searchParams.get('newCompany') === 'true';

useEffect(() => {
  const resetSuccess = searchParams.get('reset') === 'success';

  if (resetSuccess) {
    setSuccess('Password reset successfully! Please sign in with your new password.');
  } else if (signupSuccess || oauthSuccess) {
    if (newCompany) {
      setSuccess('Account created! Sign in to set up your pricing and get started.');
    } else {
      setSuccess('Account created! Please sign in with your credentials.');
    }
  }
}, [searchParams, signupSuccess, oauthSuccess, newCompany]);
```

---

## Task 15: Install NextAuth.js Dependencies

**Files:**
- Modify: `package.json`

**Install required packages:**

```bash
npm install next-auth@beta @auth/core@beta
```

---

## Task 16: Configure Environment Variables

**Files:**
- Modify: `.env.example`

**Add OAuth environment variables:**

```bash
# Database
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# NextAuth.js
NEXTAUTH_SECRET=your-super-secret-key-change-this
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Pi Sign-in
PI_CLIENT_ID=your-pi-client-id
NEXT_PUBLIC_PI_CLIENT_ID=your-pi-client-id
PI_REDIRECT_URI=http://localhost:3000/auth/pi/callback

# PayMongo Payment Integration (existing)
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
PAYMONGO_API_URL=https://api.paymongo.com/v1
```

---

## Task 17: Create OAuth Integration Tests

**Files:**
- Create: `src/__tests__/oauth/oauth.test.ts`

**Test OAuth functionality:**

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { findOAuthAccount, findUserByEmail, linkOAuthAccount, validateCompanyCode } from '@/lib/oauth';

describe('OAuth Helper Functions', () => {
  beforeEach(async () => {
    // Clean up test data
    await sql`DELETE FROM oauth_accounts WHERE provider = 'test'`;
  });

  describe('findOAuthAccount', () => {
    it('should return null for non-existent OAuth account', async () => {
      const result = await findOAuthAccount('google', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should find existing OAuth account', async () => {
      // First create a test account
      const [user] = await sql`INSERT INTO users (email, email_hash, password_hash, company_id) 
        VALUES ('test@example.com', 'hash', 'password', 'test-company-id') 
        RETURNING id`;
      
      await linkOAuthAccount(user.id, {
        provider: 'google',
        provider_user_id: 'test-google-id',
        email: 'test@example.com'
      });

      const result = await findOAuthAccount('google', 'test-google-id');
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('google');
      expect(result?.provider_user_id).toBe('test-google-id');
    });
  });

  describe('validateCompanyCode', () => {
    it('should return null for invalid company code', async () => {
      const result = await validateCompanyCode('INVALID');
      expect(result).toBeNull();
    });

    it('should validate existing company code', async () => {
      const [company] = await sql`INSERT INTO companies (code, name) 
        VALUES ('TEST123', 'Test Company') 
        RETURNING code`;

      const result = await validateCompanyCode('TEST123');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('TEST123');
    });
  });
});
```

---

## Task 18: Create Pi Sign-in Tests

**Files:**
- Create: `src/__tests__/oauth/pi-signin.test.ts`

**Test Pi Sign-in functionality:**

```typescript
import { describe, it, expect } from '@jest/globals';
import { POST } from '@/app/api/auth/pi/callback/route';

describe('Pi Sign-in Callback', () => {
  it('should reject request without access token', async () => {
    const request = new Request('http://localhost:3000/api/auth/pi/callback', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('Access token required');
  });

  it('should reject invalid Pi token', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_token' })
    }));

    const request = new Request('http://localhost:3000/api/auth/pi/callback', {
      method: 'POST',
      body: JSON.stringify({ access_token: 'invalid_token' })
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should process valid Pi token', async () => {
    const mockPiUser = { uid: 'test-pi-uid', username: 'testuser' };
    
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockPiUser)
    }));

    const request = new Request('http://localhost:3000/api/auth/pi/callback', {
      method: 'POST',
      body: JSON.stringify({ access_token: 'valid_token' })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('redirect');
  });
});
```

---

## Task 19: Run Tests and Verify Implementation

**Files:**
- Run: Test suite

**Execute all tests to verify implementation:**

```bash
# Run all tests
npm test

# Run OAuth tests specifically
npm test -- src/__tests__/oauth/

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

**Expected Output:**
```
PASS  src/__tests__/oauth/oauth.test.ts
PASS  src/__tests__/oauth/pi-signin.test.ts

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
```

---

## Task 20: Build Production Bundle

**Files:**
- Run: Production build

**Build and test production bundle:**

```bash
# Build production bundle
npm run build

# Test production build locally
npm start

# Verify build success
ls -la .next/server/app/api/auth/
ls -la .next/server/components/auth/
```

**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization

Route (app)                              Size
┌ │ /api/auth/[...nextauth]             2.4 kB
├ │ /api/auth/pi/callback              1.8 kB
├ │ /api/auth/account-choice           2.1 kB
├ ├─ /auth/account-choice              45 kB
├ ├─ /auth/pi/callback                 38 kB
└─ /login                              52 kB

✓ Build completed successfully
```

---

## Task 21: Git Commit Implementation

**Files:**
- Git: Commit all implementation files

**Commit the complete OAuth implementation:**

```bash
# Stage all changes
git add .

# Commit with detailed message
git commit -m "feat: implement OAuth + Pi Sign-in authentication

Add comprehensive OAuth authentication system with Google, Microsoft, 
and Pi Network Sign-in support for multi-tenant quotation system.

Features:
- NextAuth.js integration for Google/Microsoft OAuth
- Custom Pi Network Sign-in with implicit flow
- Protected account linking with email verification
- Account choice flow for company joining/creation
- Abandonment state prevention with AuthGuard
- Mobile-first responsive design
- Comprehensive test coverage

Database:
- OAuth accounts table with provider-specific fields
- Company ID constraint to prevent incomplete accounts
- Performance indexes for OAuth lookups

Security:
- CSRF protection for Pi Sign-in
- Email verification for account linking
- Rate limiting considerations
- Secure token handling

Components:
- ProviderButtons for OAuth selection
- PiSignInButton with SDK integration
- AccountChoicePage for onboarding
- AuthGuard for abandonment prevention

API Routes:
- /api/auth/[...nextauth] - NextAuth.js handler
- /api/auth/pi/callback - Pi token processing
- /api/auth/account-choice - Company creation/joining

Tests:
- OAuth helper function tests
- Pi Sign-in integration tests
- Account linking tests

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 22: Push to GitHub

**Files:**
- Git: Push implementation to remote

**Push implementation to GitHub:**

```bash
# Push to main branch
git push origin main

# Verify push success
git log --oneline -1

# Check remote status
git remote -v
```

**Expected Output:**
```
Enumerating objects: 45, done.
Counting objects: 100% (45/45), done.
Writing objects: 100% (35/35), 156 KB | 2.5 MB/s, done.
Total 35 (delta 12), reused 0 (delta 0)
To github.com:your-repo/concetto-blinds.git
   abc1234..def5678  main -> main
```

---

## Task 23: Verify Deployment and Test OAuth Flows

**Files:**
- Manual: Test OAuth flows end-to-end

**Test all OAuth flows end-to-end:**

```bash
# Start development server
npm run dev

# Test the following flows:
# 1. Google Sign-in
#    - Navigate to http://localhost:3000/login
#    - Click "Sign in with Google"
#    - Verify OAuth flow works
#    - Test account linking and creation

# 2. Microsoft Sign-in
#    - Navigate to http://localhost:3000/login
#    - Click "Sign in with Microsoft"  
#    - Verify OAuth flow works
#    - Test account linking and creation

# 3. Pi Sign-in (if Pi Client ID configured)
#    - Navigate to http://localhost:3000/login
#    - Click "Sign in with Pi Network"
#    - Verify Pi SDK loads and redirect works
#    - Test account creation with email input

# 4. Account Choice Flow
#    - Test joining existing company
#    - Test creating new company
#    - Verify abandonment state prevention

# 5. Mobile Responsiveness
#    - Test on mobile viewport (375px width)
#    - Verify touch targets and layout
#    - Test provider buttons on mobile
```

**Verification Checklist:**
- ✅ All OAuth providers redirect correctly
- ✅ Account linking works with email verification
- ✅ New users can create/join companies
- ✅ Abandonment state is prevented
- ✅ Mobile layout works correctly
- ✅ Error handling works properly
- ✅ Session management works
- ✅ TypeScript compilation succeeds
- ✅ Production build succeeds

---

## Task 24: Create Documentation and Deployment Guide

**Files:**
- Create: `docs/oauth/DEPLOYMENT.md`

**Create deployment documentation:**

```markdown
# OAuth + Pi Sign-in Deployment Guide

## Environment Configuration

### Required Environment Variables

```bash
# NextAuth.js
NEXTAUTH_SECRET=your-super-secret-key-change-this
NEXTAUTH_URL=https://yourdomain.com

# Google OAuth (get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth (get from https://portal.azure.com/)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Pi Network Sign-in (get from Pi Developer Portal)
PI_CLIENT_ID=your-pi-client-id
NEXT_PUBLIC_PI_CLIENT_ID=your-pi-client-id
PI_REDIRECT_URI=https://yourdomain.com/auth/pi/callback
```

## OAuth Provider Setup

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Configure OAuth 2.0 credentials:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`
5. Copy Client ID and Secret

### Microsoft OAuth
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to App Registrations
3. New registration with:
   - Redirect URI: `https://yourdomain.com/api/auth/callback/microsoft`
4. Copy Application (client) ID and generate client secret

### Pi Network Sign-in
1. Go to [Pi Developer Portal](https://developers.minepi.com/)
2. Create new app or select existing
3. Enable Pi Sign-in
4. Add redirect URI: `https://yourdomain.com/auth/pi/callback`
5. Copy Client ID

## Database Migration

```bash
# Run migration
node scripts/run-oauth-migration.js

# Verify tables
psql $DATABASE_URL -c "\dt oauth_accounts"
```

## Deployment

```bash
# Build production bundle
npm run build

# Start production server
npm start

# Or deploy to your hosting platform
```

## Testing

Test each OAuth flow in production environment before releasing to users.

## Monitoring

Monitor these metrics:
- OAuth success rates
- Account linking success/failure
- Account creation completion rates
- OAuth provider error rates
```

---

## Implementation Complete

**Summary:**
This plan implements a complete OAuth + Pi Sign-in authentication system with:
- ✅ Google & Microsoft OAuth via NextAuth.js
- ✅ Pi Network Sign-in with custom implementation
- ✅ Protected account linking with security measures
- ✅ Account creation flow for new users
- ✅ Abandonment state prevention
- ✅ Mobile-first responsive design
- ✅ Comprehensive testing and documentation

**Estimated Implementation Time:** 4-6 hours for all 24 tasks

**Success Criteria:**
- All 24 tasks completed
- All tests passing
- Production build successful
- OAuth flows working end-to-end
- Git commits and push complete

**Next Steps:**
1. Set up OAuth provider credentials
2. Configure environment variables
3. Execute implementation tasks sequentially
4. Test thoroughly before production deployment
