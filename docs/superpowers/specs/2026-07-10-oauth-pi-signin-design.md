# OAuth + Pi Sign-in Authentication Design

**Project:** Concetto Window Coverings Multi-tenant Quotation System  
**Date:** 2026-07-10  
**Status:** Design Approved - Ready for Implementation  
**Version:** 1.0

---

## Overview

Implement OAuth authentication (Google, Microsoft) and Pi Network Sign-in for the Concetto Window Coverings quotation system. This hybrid approach combines standard OAuth flows with Pi Network's implicit flow implementation.

## Requirements

**Authentication Providers:**
- Google OAuth (standard OAuth 2.0 authorization code flow)
- Microsoft OAuth (standard OAuth 2.0 authorization code flow)  
- Pi Network Sign-in (OAuth 2.0 implicit flow)

**Account Management:**
- Auto-link OAuth accounts to existing password accounts (same email)
- New users choose: Join existing company OR Create new company
- Maintain multi-tenant architecture (companies + users)

**Technical Requirements:**
- Mobile-first responsive design
- TypeScript with strict typing
- Integration with existing session management
- Backward compatibility with existing email/password authentication

## Architecture

### Hybrid Approach

**Google/Microsoft:** NextAuth.js framework (server-side OAuth)
**Pi Sign-in:** Custom implementation (frontend implicit flow)

```
Login Page → Provider Choice:
├─ Google/Microsoft → NextAuth.js → Standard OAuth Flow → Session
└─ Pi Sign-in → Custom SDK → Implicit Flow → API Call → Session
```

### Database Schema

**New Table: oauth_accounts**
```sql
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'microsoft', 'pi'
  provider_user_id TEXT NOT NULL, -- Pi uid, Google sub, etc.
  email TEXT, -- Nullable (Pi Network doesn't provide email)
  username TEXT, -- Pi username
  wallet_address TEXT, -- Pi wallet (if requested)
  access_token TEXT, -- All providers (short-lived for Pi)
  refresh_token TEXT, -- Google/Microsoft only (Pi doesn't provide)
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);

-- Add company_id NULL constraint to users table for abandonment state detection
ALTER TABLE users ADD CONSTRAINT users_company_id_required 
  CHECK (company_id IS NOT NULL); -- Enable after initial migration
```

## Authentication Flows

### Google/Microsoft Flow (Standard OAuth)

1. User clicks Google/Microsoft button
2. NextAuth.js redirects to provider
3. User approves on provider site
4. Provider redirects back to `/api/auth/callback`
5. NextAuth.js exchanges code for tokens
6. Gets user info (email, name, etc.)
7. Checks for existing account:
   - If email exists AND provider email is verified:
     - Require password confirmation for account linking
     - Link OAuth account, login
   - If email exists BUT provider email is unverified:
     - Require additional verification or manual approval
   - If new user → Redirect to account creation choice
8. Create session, redirect appropriately
9. **Layout-based check:** If user.company_id === null, redirect to account choice

### Pi Sign-in Flow (Implicit Flow)

1. User clicks "Sign in with Pi" button
2. Frontend: `Pi.signIn()` or redirect to `accounts.pinet.com`
3. User approves in Pi interface
4. Redirect back with `#access_token`
5. Frontend: Read token from URL fragment
6. Frontend: Call `POST /api/auth/pi/callback` with token
7. Backend: Validate token immediately by calling `api.minepi.com/v2/me`
8. Backend: Get `{uid, username, wallet_address}` (NO email provided)
9. Backend: Check for existing uid:
   - If uid exists → Login (existing Pi user)
   - If new → Redirect to account creation choice (requires email input)
10. Create session, redirect appropriately
11. **Middleware check:** If user.company_id === null, redirect to account choice

**Pi Network Specific Considerations:**
- No email returned from `/v2/me` endpoint
- Account lookup strictly by `uid` (app-specific per user)
- New users must provide email during account creation
- Auto-linking not available for Pi users (no email to match)

### Account Creation Choice Flow

```
New user detected → Redirect to /auth/account-choice
├─ **If Pi Network user:**
│  ├─ Request email address (not provided by Pi)
│  └─ Validate email is not already in use
├─ Option 1: "Join Existing Company"
│  ├─ Enter company code
│  ├─ Validate company exists
│  ├─ Create user account with email, link to company, login
│  └─ Ensure company_id is set (no abandonment state)
└─ Option 2: "Create New Company"
   ├─ Enter company details
   ├─ Create company
   ├─ Create user account with email, link to company, login
   └─ Ensure company_id is set (no abandonment state)

**Abandonment State Prevention:**
- Database constraint: company_id must NOT be NULL  
- Layout-based auth checks redirect users without company_id back to account choice
- Session temporarily allows account-choice page access only
- OAuth tokens stored temporarily until completion
```

## UI Components

### Login Page Updates
- **4 sign-in options:** Email/Password (existing), Google, Microsoft, Pi Sign-in
- **Mobile-first layout:** Vertical stack, full-width buttons, clear provider icons
- **Provider buttons:** Consistent styling, provider colors, mobile-optimized touch targets

### New Components
1. **ProviderButtons.tsx** - OAuth provider selection buttons
2. **AccountChoicePage.tsx** - Join/Create company selection  
3. **PiSignInButton.tsx** - Pi Sign-in specific button with SDK integration
4. **OAuthCallbackPage.tsx** - Handle OAuth redirects

### Mobile-First Specifications
- Touch-friendly buttons (min 44px height)
- Responsive provider button layout (1 col mobile, 2 col desktop)
- Clear visual hierarchy (email/password primary, providers secondary)
- Loading states during OAuth flows
- Error messages inline and mobile-optimized

## API Routes

### New Routes
1. `POST /api/auth/pi/callback` - Process Pi Sign-in tokens
2. `POST /api/auth/account-choice` - Handle company creation/joining
3. `GET /api/auth/providers` - Get available OAuth providers

### Existing Routes (Enhanced)
- Existing `/api/auth/login` - Account linking logic
- Existing `/api/auth/signup` - OAuth user company creation

## Implementation Considerations

### Pi Network Token Redirect Handling
**Critical:** Pi Network returns tokens in URL fragments (`#access_token`) which are never sent to the server.

**Frontend Implementation:**
```typescript
// Safe fragment extraction
const params = new URLSearchParams(window.location.hash.slice(1));
const accessToken = params.get('access_token');

// Clear fragment from URL history
history.replaceState(null, '', window.location.pathname);

// Send to backend for validation
await fetch('/api/auth/pi/callback', {
  method: 'POST',
  body: JSON.stringify({ access_token: accessToken })
});
```

**SSR Considerations:**
- Handle token extraction on client-side only
- Avoid SSR crashes from missing fragment data
- Use loading state during token processing

### Abandonment State Prevention (Implementation Options)
**Option 1: Layout-Based Check (Recommended)**
```typescript
// app/layout.tsx - Server-side check
export default async function RootLayout({ children }) {
  const session = await getSession();
  
  if (session && !session.companyId) {
    const pathname = headers().get('x-path') || '';
    if (!pathname.startsWith('/auth/account-choice')) {
      redirect('/auth/account-choice');
    }
  }
  
  return <html>{children}</html>;
}
```

**Option 2: AuthGuard Component**
```typescript
// components/AuthGuard.tsx - Client-side check
'use client';
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (session && !session.companyId) {
      router.replace('/auth/account-choice');
    }
  }, [session, router]);
  
  if (isLoading) return <LoadingSpinner />;
  return <>{children}</>;
}
```

**Option 3: API Route Check**
```typescript
// API route middleware pattern
export async function requireCompleteSession(req: Request) {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  if (!session.companyId) {
    throw new Error('ACCOUNT_INCOMPLETE');
  }
  
  return session;
}
```

**Temporary Session State:**
- Allow access only to `/auth/account-choice` during completion
- Store OAuth tokens temporarily
- Expire temporary state after 30 minutes

## Error Handling

### OAuth Failures
- Provider denial (user cancelled)
- Network errors during OAuth flow
- Token expiration during session
- Invalid OAuth responses

### Account Linking Conflicts
- Email exists with different provider
- Provider account already linked to different user
- Multiple OAuth accounts with same email

### Company Validation
- Invalid company code
- Duplicate company code
- Company doesn't exist

### Session Management
- Token expiration handling
- Session invalidation
- Multi-provider session conflicts

## Security Considerations

### Multi-Tenant Account Linking Security
**CRITICAL:** Auto-linking OAuth accounts by email in multi-tenant systems creates security vulnerabilities.

**Protected Account Linking Flow:**
1. **Email Verification Required:** Only link OAuth accounts if provider guarantees verified email
2. **Password Confirmation:** For existing accounts, require password confirmation before linking OAuth
3. **Multi-Factor Verification:** Require additional verification for admin/owner accounts
4. **Audit Logging:** Log all account linking events with IP, timestamp, provider

**Safe Auto-Linking Logic:**
```
If OAuth email exists in system:
  If provider email is verified AND user confirms password:
    Link accounts safely
  Else if user has admin/owner role:
    Require MFA or manual verification
  Else:
    Require manual approval or create separate account
```

### Abandonment State Prevention
**Problem:** Users who authenticate via OAuth but don't complete company selection are left in limbo.

**Solution:** Layout-based authentication check (replaces deprecated middleware):
```typescript
// app/layout.tsx or auth-provider-wrapper.tsx
export default async function RootLayout({ children }) {
  const session = await getSession();
  
  // Check if user is authenticated but missing company affiliation
  if (session && !session.companyId) {
    // Only allow access to account choice page during completion
    const currentPath = headers().get('x-path') || '';
    if (!currentPath.startsWith('/auth/account-choice')) {
      redirect('/auth/account-choice');
    }
  }
  
  return <html>{children}</html>;
}
```

**Alternative: AuthProvider Component**
```typescript
// components/AuthGuard.tsx
'use client';
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (session && !session.companyId) {
      router.replace('/auth/account-choice');
    }
  }, [session, router]);
  
  if (isLoading) return <LoadingSpinner />;
  return <>{children}</>;
}
```

**Database Constraint:**
- Add `CHECK (company_id IS NOT NULL)` constraint after migration
- Temporary allowance during OAuth flow
- Enforce completion before granting system access

### CSRF Protection
- State parameter validation (Pi Sign-in)
- NextAuth.js built-in CSRF protection (Google/Microsoft)
- Double-submit cookie pattern for sensitive operations

### Token Security
- HTTPS-only cookies in production
- Secure token storage (no localStorage for sensitive tokens)
- Short-lived access tokens (Pi Sign-in)
- Immediate token validation on backend

### Account Linking (Updated)
- Verify email ownership before linking
- Password confirmation for existing accounts
- Prevent unauthorized account linking
- Audit log for account linking events
- Rate limiting on linking attempts

### Rate Limiting
- OAuth initiation rate limits
- Account creation rate limits
- Company code validation limits

### Input Validation
- Company code format validation
- Email address validation
- Provider token validation

## Dependencies

### Required Packages
```json
{
  "next-auth": "^5.0.0-beta.19",
  "@auth/core": "^5.0.0-beta.19"
}
```

### Environment Variables
```bash
# NextAuth.js
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Pi Sign-in
PI_CLIENT_ID=your-pi-client-id
PI_REDIRECT_URI=http://localhost:3000/auth/pi/callback
```

## Implementation Order

1. **Phase 1:** Setup & Database
   - Create oauth_accounts table
   - Install NextAuth.js dependencies
   - Configure environment variables

2. **Phase 2:** Google/Microsoft OAuth
   - Setup NextAuth.js configuration
   - Implement Google/Microsoft providers
   - Create OAuth callback handling
   - Account linking logic

3. **Phase 3:** Pi Sign-in Integration
   - Implement Pi SDK integration
   - Create Pi callback API route
   - Frontend token handling
   - API integration with `/v2/me`

4. **Phase 4:** Account Creation Flow
   - Build account choice page
   - Company joining logic
   - Company creation logic
   - Session management

5. **Phase 5:** UI Implementation
   - Update login page
   - Create provider buttons
   - Mobile responsive design
   - Error handling UI

6. **Phase 6:** Testing & Deployment
   - Test all OAuth flows
   - Test account linking
   - Test company creation
   - Security testing
   - Build and deploy

## Success Criteria

- ✅ Users can sign in with Google, Microsoft, and Pi Network
- ✅ Protected account linking with email verification and password confirmation
- ✅ OAuth accounts safely link to existing password accounts
- ✅ New users can join or create companies
- ✅ No abandonment state - all users have company_id after OAuth
- ✅ Pi Network users provide email during account creation
- ✅ Mobile-responsive authentication flow
- ✅ All TypeScript compilation passes
- ✅ Backward compatibility with existing email/password authentication
- ✅ Multi-tenant security enforced (no cross-tenant access)
- ✅ Production build successful

**Security Requirements:**
- ✅ Email verification required for account linking
- ✅ Password confirmation for existing account links
- ✅ Abandonment state prevented by middleware
- ✅ Audit logging for all account linking events
- ✅ Rate limiting on OAuth and account creation

---

**Design Completed:** 2026-07-10  
**Status:** Ready for Implementation Planning  
**Next Step:** Create detailed implementation plan using writing-plans skill