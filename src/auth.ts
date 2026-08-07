import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { findUserByEmail, createUserWithOAuth, findOAuthAccount, linkOAuthAccount, type UserRecord } from '@/lib/oauth';
import type { AccountLinkRequest, OAuthProvider } from '@/types/oauth';
import { cookies } from 'next/headers';
import { setTrialExpiration } from '@/lib/subscription';
import { setTenantContext, resetTenantContext, type RLSUserRole } from '@/lib/rls';
import { normalizeRoleForRLS } from '@/types/roles';
import crypto from 'crypto';

// Helper function to get the appropriate cookie domain based on environment
function getCookieDomain(): string | undefined {
  // For development: don't set domain (browser default for localhost)
  if (process.env.NODE_ENV === 'development') {
    return undefined;
  }

  // For production: use environment variable if set
  if (process.env.COOKIE_DOMAIN) {
    const domain = process.env.COOKIE_DOMAIN.trim();
    // Ensure domain starts with dot for subdomain support
    return domain.startsWith('.') ? domain : `.${domain}`;
  }

  // Default: no domain (let browser handle it)
  return undefined;
}

// Helper function to set custom session cookie for compatibility with proxy middleware
async function setCustomSessionCookie(userId: string, companyId: string, email: string, role?: string) {
  console.log('🔍 setCustomSessionCookie called for userId:', userId, 'companyId:', companyId);
  try {
    const cookieStore = await cookies();

    // Set session data with what we have - don't fail if we can't get company details
    let companyCode = 'UNKNOWN';
    let normalizedRole = normalizeRoleForRLS(role);

    // Try to get company code and user role, but don't fail if we can't
    try {
      // Must use query() with RLS context: a raw sql() call has no tenant
      // context, so companies RLS hides the row and companyCode falls back
      // to 'UNKNOWN' (quote prefixes would be UNKNOWN-...).
      const { query } = await import('@/lib/db');
      console.log('🔍 Fetching company and user data...');

      const result = await query<{ company_code: string; user_role: string }>(
        `SELECT
          companies.code as company_code,
          users.role as user_role
        FROM companies
        JOIN users ON users.company_id = companies.id
        WHERE companies.id = $1 AND users.id = $2`,
        [companyId, userId],
        companyId,
        normalizedRole
      );

      const companyAndUser = result.rows[0];

      if (companyAndUser) {
        companyCode = companyAndUser.company_code || 'UNKNOWN';
        normalizedRole = normalizeRoleForRLS(companyAndUser.user_role || role);
        console.log('🔍 Got company code:', companyCode, 'and role:', normalizedRole);
      }
    } catch (dbError) {
      console.warn('⚠️ Could not fetch company/user data, using defaults:', dbError);
      // Continue with defaults - session is more important than company code
    }

    const sessionData = {
      userId,
      companyId, // This is the critical part that was failing before
      companyCode,
      email,
      role: normalizedRole,
    };

    console.log('🔍 Setting session cookie with data:', sessionData);

    cookieStore.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      domain: getCookieDomain(),
    });

    console.log('✅ Custom session cookie set for user:', userId, 'with companyId:', companyId);

    // Note: RLS context will be set in session callback to avoid duplicate database calls
    // This optimizes mobile performance by reducing unnecessary database operations
  } catch (error) {
    console.error('❌ Failed to set custom session cookie:', error);
    throw error; // Re-throw so the OAuth flow knows something went wrong
  }
}

const providers: Array<ReturnType<typeof Google>> = [];

// Debug environment variables
console.log('=== OAuth Configuration Debug ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_PI_CLIENT_ID:', process.env.NEXT_PUBLIC_PI_CLIENT_ID ? '✅ Set' : '❌ Missing');

// Google Provider (if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('✅ Google Provider configured');
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
} else {
  console.warn('⚠️ Google Provider not configured - missing environment variables');
}

if (providers.length === 0) {
  console.warn('⚠️ No OAuth providers configured - OAuth authentication will not work');
}

// Debug environment variable loading
console.log('=== NextAuth Configuration Debug ===');
console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Set (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : '❌ Missing');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ Missing');

export const authOptions = {
  providers,
  trustHost: true, // Allow localhost for development
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }: any) {
      console.log('🔍 signIn callback START');
      if (!user?.email || !account) {
        console.error('OAuth sign-in failed: Missing user data');
        return false;
      }

      try {
        console.log('🔍 Processing OAuth sign-in for:', user.email);

        // Check if OAuth account already exists
        const existingAccount = await findOAuthAccount(
          account.provider as OAuthProvider,
          account.providerAccountId
        );

        if (existingAccount) {
          console.log('✅ Existing OAuth account found, user ID:', existingAccount.user_id);
          // Add user ID to the user object for later use
          user.id = existingAccount.user_id;

          // Get user's company ID and role using SECURITY DEFINER function to bypass RLS
          const { sql } = await import('@/lib/db');
          console.log('🔍 Fetching user data using SECURITY DEFINER function...');
          const [userData] = await sql`SELECT * FROM find_user_by_id(${existingAccount.user_id}::uuid)`;
          console.log('🔍 User data from SECURITY DEFINER function:', userData);

          if (userData) {
            console.log('🔍 Calling setCustomSessionCookie...');
            await setCustomSessionCookie(existingAccount.user_id, userData.user_company_id, user.email, userData.user_role);
            console.log('🔍 setCustomSessionCookie completed');
          } else {
            console.log('❌ No user data found!');
          }

          return true;
        }

        // Check if user exists by email
        const existingUser = await findUserByEmail(user.email);

        if (existingUser) {
          // Link OAuth account to existing user
          console.log('✅ Linking OAuth account to existing user:', existingUser.id);

          const accountData: AccountLinkRequest = {
            provider: account.provider as OAuthProvider,
            provider_user_id: account.providerAccountId,
            email: user.email,
            username: user.name || undefined,
            access_token: account.access_token || undefined,
            refresh_token: account.refresh_token || undefined,
            expires_at: account.expires_at ? new Date(account.expires_at * 1000) : undefined
          };

          await linkOAuthAccount(existingUser.id, accountData);
          console.log('✅ OAuth account linked successfully');
          user.id = existingUser.id;

          // Set custom session cookie for existing user with role
          await setCustomSessionCookie(existingUser.id, existingUser.company_id, user.email, existingUser.role || 'user');

          return true;
        }

        // New user with OAuth - create them with a temporary company
        console.log('⚠️ New OAuth user, creating account with default company');

        // Create a default company for the new user
        const companyCode = user.email.split('@')[0].toUpperCase().slice(0, 10);
        const defaultCompanyData = {
          code: companyCode,
          name: `${user.name || user.email}'s Company`,
          address: '',
          mobile: '',
          email: user.email
        };

        // First create the company to get its UUID
        const { createCompany, validateCompanyCode } = await import('@/lib/oauth');

        // Check if company already exists (RLS-bypass lookup via SECURITY DEFINER)
        let company = await validateCompanyCode(companyCode);
        if (company && (company.userCount ?? 0) > 0) {
          // The code already belongs to an active company. Never silently join
          // another tenant's workspace (email local parts can derive the same
          // 10-char code) - fall back to a unique random code instead.
          console.log('⚠️ Company code already in use by an active company, generating unique code:', company.code);
          company = null;
          defaultCompanyData.code = await generateUniqueCompanyCode();
        }

        if (!company) {
          // Create new company if it doesn't exist (or code was taken)
          company = await createCompany(defaultCompanyData);
          console.log('✅ Created new company:', company.id);
        } else {
          console.log('✅ Reusing orphaned company:', company.id);
        }

        const accountData: AccountLinkRequest = {
          provider: account.provider as OAuthProvider,
          provider_user_id: account.providerAccountId,
          email: user.email,
          username: user.name || undefined,
          access_token: account.access_token || undefined,
          refresh_token: account.refresh_token || undefined,
          expires_at: account.expires_at ? new Date(account.expires_at * 1000) : undefined
        };

        const { user: newUser } = await createUserWithOAuth(
          user.email,
          company.id, // Use the company UUID, not the code
          accountData
        );

        console.log('✅ Created new OAuth user:', newUser.id, 'with company:', company.id);
        user.id = newUser.id;

        // Set trial expiration for new OAuth users (fire and forget for mobile performance)
        setTrialExpiration(newUser.id, 3)
          .then(() => console.log('✅ Set 3-day trial expiration for new user:', newUser.id))
          .catch(err => console.error('⚠️ Failed to set trial expiration (non-critical):', err));

        // Set custom session cookie for new user with role and error handling
        try {
          await setCustomSessionCookie(newUser.id, company.id, user.email, 'user');
        } catch (cookieError) {
          console.error('⚠️ Failed to set session cookie (non-critical):', cookieError);
          // Don't fail sign-in if cookie setup fails
        }

        return true;

      } catch (error) {
        console.error('❌ Error processing OAuth sign-in:', error);
        return false;
      }
    },

    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      console.log('🔍 Redirect callback called:', { url, baseUrl });
      // Handles the redirect after successful authentication
      // If the url is relative, prepend baseUrl, otherwise use url or default to dashboard
      const redirectUrl = url.startsWith('/') ? `${baseUrl}${url}` : (url || `${baseUrl}/dashboard`);
      console.log('🔍 Redirect callback returning:', redirectUrl);
      return redirectUrl;
    },

    async jwt({ token, account, user, profile }: any) {
      console.log('🔍 JWT callback called, user.id =', user?.id);
      if (account && user) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.email = profile?.email || user.email;
        token.emailVerified = (profile as any)?.email_verified || false;
        // Store the user ID from signIn callback
        token.userId = user.id;
        console.log('🔍 JWT token.userId set to:', token.userId);
      }
      console.log('🔍 JWT callback returning token:', token);
      return token;
    },

    async session({ session, token }: any) {
      console.log('🔍🔍🔍 SESSION CALLBACK CALLED 🔍🔍🔍');
      console.log('🔍 Session callback START - token.userId =', token.userId);
      console.log('🔍 Session callback - full token:', JSON.stringify(token));
      if (token) {
        (session as any).provider = token.provider as string;
        (session as any).providerAccountId = token.providerAccountId as string;
        (session as any).user = {
          ...(session.user || {}),
          id: token.userId || token.sub || '',
          email: token.email as string,
          name: token.name as string,
        };

        console.log('🔍 Session user set:', (session as any).user);

        // Add RLS information to session if userId is available
        if (token.userId) {
          try {
            console.log('🔍 Fetching RLS info for userId:', token.userId);
            const { sql } = await import('@/lib/db');

            const [userData] = await sql`SELECT * FROM find_user_by_id(${token.userId}::uuid)`;

            console.log('🔍 Session callback: userData =', userData);

            if (userData) {
              const normalizedRole = normalizeRoleForRLS(userData.user_role);
              (session as any).user.role = normalizedRole;
              (session as any).user.companyId = userData.user_company_id;
              (session as any).user.companyCode = userData.company_code ?? undefined;

              // Set RLS context for this session
              try {
                await setTenantContext(userData.user_company_id, normalizedRole);
                console.log('✅ RLS context set in session callback for user:', token.userId);
              } catch (rlsError) {
                console.error('❌ Failed to set RLS context in session callback (authentication will proceed):', rlsError);
                // Don't fail authentication if RLS context setting fails
              }
            }
          } catch (error) {
            console.error('❌ Failed to fetch user data for RLS context:', error);
            // Don't fail session creation if user data fetch fails
          }
        }
      }
      return session;
    }
  },
  events: {
    async signIn({ user, account, profile }: any) {
      console.log('✅ OAuth sign-in successful:', {
        user: user.email,
        userId: user.id,
        provider: account?.provider
      });
    },
  },
  debug: process.env.NODE_ENV === 'development'
};

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);

// Generate a unique company code (mirrors the account-choice flow)
async function generateUniqueCompanyCode(): Promise<string> {
  const { sql } = await import('@/lib/db');
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const existing = await sql`
    SELECT check_company_exists(${code}) as exists
  `;
  if (existing.length > 0 && existing[0].exists) {
    return generateUniqueCompanyCode(); // Retry if collision
  }
  return code;
}