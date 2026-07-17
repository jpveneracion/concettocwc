# Cookie Persistence Fix Plan

## Executive Summary

**Root Cause:** Cookie persistence issues caused by missing domain configuration in custom session cookies, dual authentication system conflicts, and middleware blocking root path access.

**Research Sources:**
- [NextAuth Configuration Options](https://next-auth.js.org/configuration/options)
- [I Fixed NextAuth Cookie Hell in Production](https://medium.com/@thxdeadshotxht/i-fixed-nextauth-cookie-hell-in-production-heres-the-ultimate-cookie-config-b24acf441cd9)
- [Next.js Middleware Documentation](https://nextjs.org/docs/14/app/building-your-application/routing/middleware)
- [Session Cookie Not Set in Production]((https://stackoverflow.com/questions/76505850/session-cookie-not-set-in-production-with-next-auth-in-next.js)
- [Next.js Middleware Authentication Guide](https://www.authgear.com/post/nextjs-middleware-authentication/)

## Problem Analysis

### Current Issues Found:

1. **Missing Cookie Domain Configuration**
   - All cookie-setting code missing `domain` parameter
   - Affects both development and production environments
   - Custom session cookies don't persist when users modify URL

2. **Dual Authentication System Conflicts**
   - **NextAuth**: Creates own cookies with proper domain handling (JWT strategy, 30-day expiration)
   - **Custom System**: Creates "session" cookie without domain configuration (7-day expiration)
   - **Systems become desynchronized** when users navigate different paths

3. **Middleware Path Blocking**
   - `src/proxy.ts` doesn't allow root path `/` in public routes
   - Forces authentication check on landing page access
   - Causes redirect to login when cookies don't persist

4. **Unused Infrastructure**
   - Existing `cookie-helpers.ts` and `session-validator.ts` files not being used
   - Manual cookie setting in multiple places without standardized approach

## Proposed Solution Strategy

### Phase 1: Fix Cookie Domain Configuration (Quick Win)

**Goal:** Ensure all cookies use proper domain configuration without changing authentication logic.

**Changes Required:**

1. **Update cookie configuration in existing auth files:**
   - `src/auth.ts` - NextAuth custom session callback
   - `src/app/api/login/route.ts` - Email/password login
   - Add proper `domain` parameter to cookie settings

2. **Add environment variable for domain configuration:**
   - Update `.env.example` with `NEXT_PUBLIC_APP_DOMAIN` 
   - Development: Leave empty or set to `localhost`
   - Production: Set to `.yourdomain.com` for subdomain support

**Impact:** Low risk, no authentication logic changes, only cookie configuration fixes.

### Phase 2: Resolve Middleware Root Path Issue

**Goal:** Allow authenticated users to access root path while protecting other routes.

**Options Considered:**

**Option A: Modify Existing `src/proxy.ts`** (RECOMMENDED)
- Add `/` to allowed public paths in proxy.ts
- Pros: Uses existing infrastructure, minimal changes
- Cons: May need additional logic for authentication checks

**Option B: Create New Root Page Logic**
- Make root page check for existing session and redirect
- Pros: Simpler authentication flow
- Cons: Doesn't fix middleware blocking issue

**Decision:** Option A - Modify existing proxy.ts

### Phase 3: Standardize Cookie Management

**Goal:** Consolidate cookie setting logic using existing helper files.

**Approach:**
1. Integrate existing `cookie-helpers.ts` into authentication flow
2. Replace manual cookie setting with helper functions
3. Ensure consistent cookie configuration across all auth paths

**Files to Update:**
- `src/auth.ts` - Use cookie helpers in NextAuth callbacks
- `src/app/api/login/route.ts` - Use cookie helpers for email login
- Keep `src/proxy.ts` using existing session reading logic

### Phase 4: Address Dual Authentication System (Future Enhancement)

**Goal:** Resolve conflicts between NextAuth and custom session cookies.

**Options:**
1. **Migrate to NextAuth-only** - Remove custom session cookie
2. **Keep dual system** - Improve synchronization between systems
3. **Hybrid approach** - Use NextAuth for OAuth, custom for email/password

**Recommendation:** Keep current dual system for now, improve synchronization in Phase 3.

## Implementation Plan

### Step 1: Update Environment Configuration
```bash
# Add to .env.example
NEXT_PUBLIC_APP_DOMAIN= # Leave empty for localhost, set to .example.com for production
```

### Step 2: Update Cookie Domain Configuration
Update all cookie-setting code to include proper domain parameter:

```typescript
// Generic cookie configuration function
function getCookieDomain(): string | undefined {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return undefined;
    }
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
      return `.${domainParts.slice(-2).join('.')}`;
    }
  }
  return process.env.NEXT_PUBLIC_APP_DOMAIN?.startsWith('.')
    ? process.env.NEXT_PUBLIC_APP_DOMAIN
    : `.${process.env.NEXT_PUBLIC_APP_DOMAIN}`;
}

// Update cookie settings
cookieStore.set('session', JSON.stringify(sessionData), {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
  domain: getCookieDomain(), // ADD THIS
});
```

### Step 3: Fix Middleware Root Path Issue
Update `src/proxy.ts` to allow root path with proper authentication checks:

```typescript
// In proxy.ts middleware
const publicPaths = [
  '/login', 
  '/signup', 
  '/reset-password',
  '/', // ADD ROOT PATH
  '/activate-code',
  // ... existing paths
];

// Add authentication check for root path
if (pathname === '/' && sessionCookie) {
  // User is authenticated, redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

### Step 4: Testing Strategy
1. **Development Testing:**
   - Test cookie persistence when navigating to `localhost:3000`
   - Test URL modifications (deleting subpaths, navigating to root)
   - Verify OAuth flow still works correctly

2. **Production Considerations:**
   - Ensure HTTPS is used for cookies with `secure: true`
   - Test subdomain cookie access
   - Verify domain configuration works in production environment

## Risk Assessment

**Low Risk:**
- Phase 1 (Cookie domain configuration) - Only cookie settings, no auth logic changes
- Step 1 (Environment variables) - Configuration only

**Medium Risk:**
- Phase 2 (Middleware changes) - Affects routing logic
- Phase 3 (Cookie management consolidation) - Multiple file changes

**Mitigation Strategy:**
- Implement changes incrementally
- Test thoroughly after each phase
- Keep rollback plan ready (git revert)
- Monitor for authentication failures

## Success Criteria

✅ **Primary Success:** Users can navigate to `localhost:3000` and remain logged in

✅ **Secondary Success:** 
- Cookies persist across URL modifications
- OAuth authentication continues to work
- Email/password authentication continues to work  
- No authentication failures in production

✅ **Testing Validation:**
- Manual testing of cookie persistence scenarios
- No build errors (TypeScript compilation)
- No console errors during authentication flows

## Questions for User Approval

1. **Approach Confirmation:** Do you agree with the phased approach starting with cookie domain configuration?

2. **Middleware Strategy:** Should we modify existing `src/proxy.ts` or create new middleware logic?

3. **Dual Authentication:** Are you comfortable keeping the dual authentication system for now, or do you want to address this immediately?

4. **Implementation Order:** Does the implementation order make sense, or should we prioritize differently?

**Ready to proceed with implementation upon your approval.**

---

**Sources:**
- [NextAuth Configuration Options](https://next-auth.js.org/configuration/options)
- [I Fixed NextAuth Cookie Hell in Production](https://medium.com/@thxdeadshotxht/i-fixed-nextauth-cookie-hell-in-production-heres-the-ultimate-cookie-config-b24acf441cd9)
- [Next.js Middleware Documentation](https://nextjs.org/docs/14/app/building-your-application/routing/middleware)
- [Session Cookie Not Set in Production](https://stackoverflow.com/questions/76505850/session-cookie-not-set-in-production-with-next-auth-in-next.js)
- [Next.js Middleware Authentication Guide](https://www.authgear.com/post/nextjs-middleware-authentication/)