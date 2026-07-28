import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { findUserByEmail, createUserWithOAuth, findOAuthAccount, linkOAuthAccount } from '@/lib/oauth';
import type { AccountLinkRequest, OAuthProvider } from '@/types/oauth';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { setTrialExpiration } from '@/lib/subscription';
import { setTenantContext, resetTenantContext, type RLSUserRole } from '@/lib/rls';

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

/**
 * Normalize database role to RLS role format
 * Maps 'super_admin' (database) to 'superadmin' (RLS functions)
 */
function normalizeRoleForRLS(dbRole: string | null | undefined): RLSUserRole {
  const role = dbRole?.toLowerCase() || 'user';

  // Map database 'super_admin' to RLS 'superadmin'
  if (role === 'super_admin') {
    return 'superadmin';
  }

  // Validate role is allowed
  if (role === 'admin' || role === 'user' || role === 'superadmin') {
    return role as RLSUserRole;
  }

  // Default to 'user' for any unknown role
  return 'user';
}

// Helper function to set custom session cookie for compatibility with proxy middleware
async function setCustomSessionCookie(userId: string, companyId: string, email: string, role?: string) {
  try {
    // Get company code and user role for the session
    const [companyAndUser] = await sql`
      SELECT
        companies.code as company_code,
        users.role as user_role
      FROM companies
      JOIN users ON users.company_id = companies.id
      WHERE companies.id = ${companyId} AND users.id = ${userId}
    `;

    const normalizedRole = normalizeRoleForRLS(companyAndUser?.user_role || role);

    const cookieStore = await cookies();
    cookieStore.set('session', JSON.stringify({
      userId,
      companyId,
      companyCode: companyAndUser?.company_code || 'UNKNOWN',
      email,
      role: normalizedRole,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      domain: getCookieDomain(),
    });

    console.log('✅ Custom session cookie set for user:', userId, 'with role:', normalizedRole);

    // Set RLS context after successful authentication
    try {
      await setTenantContext(companyId, normalizedRole);
      console.log('✅ RLS context set for user:', userId, 'company:', companyId, 'role:', normalizedRole);
    } catch (rlsError) {
      console.error('❌ Failed to set RLS context (authentication will proceed):', rlsError);
      // Don't fail authentication if RLS context setting fails
      // This allows graceful degradation while maintaining security
    }
  } catch (error) {
    console.error('❌ Failed to set custom session cookie:', error);
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
      if (!user?.email || !account) {
        console.error('OAuth sign-in failed: Missing user data');
        return false;
      }

      try {
        console.log('Processing OAuth sign-in for:', user.email);

        // Check if OAuth account already exists
        const existingAccount = await findOAuthAccount(
          account.provider as OAuthProvider,
          account.providerAccountId
        );

        if (existingAccount) {
          console.log('✅ Existing OAuth account found, user ID:', existingAccount.user_id);
          // Add user ID to the user object for later use
          user.id = existingAccount.user_id;

          // Get user's company ID and role and set custom session cookie
          const [userData] = await sql`
            SELECT company_id, role FROM users WHERE id = ${existingAccount.user_id}
          `;
          if (userData) {
            await setCustomSessionCookie(existingAccount.user_id, userData.company_id, user.email, userData.role);
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

        // Check if company already exists
        let company = await validateCompanyCode(companyCode);
        if (!company) {
          // Create new company if it doesn't exist
          company = await createCompany(defaultCompanyData);
          console.log('✅ Created new company:', company.id);
        } else {
          console.log('✅ Using existing company:', company.id);
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

        // Set trial expiration for new OAuth users with timeout protection
        try {
          const trialPromise = setTrialExpiration(newUser.id, 3);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Trial setup timeout')), 5000)
          );

          await Promise.race([trialPromise, timeoutPromise]);
          console.log('✅ Set 3-day trial expiration for new user:', newUser.id);
        } catch (trialError) {
          console.error('⚠️ Failed to set trial expiration (non-critical):', trialError);
          // Don't fail sign-in if trial setup fails - continue with login
        }

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
      // Handle redirects after OAuth sign-in
      console.log('OAuth redirect:', { url, baseUrl });

      // If URL is explicitly provided (like callback URLs), use it
      if (url && url !== '/login') {
        console.log('Using provided URL:', url);
        // If the URL is relative, make it absolute
        if (url.startsWith('/')) {
          return `${baseUrl}${url}`;
        }
        return url;
      }

      // Default redirect to dashboard after successful OAuth sign-in
      console.log('Redirecting to dashboard after successful sign-in');
      return `${baseUrl}/dashboard`;
    },

    async jwt({ token, account, user, profile }: any) {
      if (account && user) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.email = profile?.email || user.email;
        token.emailVerified = (profile as any)?.email_verified || false;
        // Store the user ID from signIn callback
        token.userId = user.id;
      }
      return token;
    },

    async session({ session, token }: any) {
      if (token) {
        (session as any).provider = token.provider as string;
        (session as any).providerAccountId = token.providerAccountId as string;
        (session as any).user = {
          ...(session.user || {}),
          id: token.userId || token.sub || '',
          email: token.email as string,
          name: token.name as string,
        };

        // Add RLS information to session if userId is available
        if (token.userId) {
          try {
            const [userAndCompany] = await sql`
              SELECT
                users.role as user_role,
                users.company_id as company_id,
                companies.code as company_code
              FROM users
              JOIN companies ON companies.id = users.company_id
              WHERE users.id = ${token.userId}
            `;

            if (userAndCompany) {
              const normalizedRole = normalizeRoleForRLS(userAndCompany.user_role);
              (session as any).user.role = normalizedRole;
              (session as any).user.companyId = userAndCompany.company_id;
              (session as any).user.companyCode = userAndCompany.company_code;

              // Set RLS context for this session
              try {
                await setTenantContext(userAndCompany.company_id, normalizedRole);
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