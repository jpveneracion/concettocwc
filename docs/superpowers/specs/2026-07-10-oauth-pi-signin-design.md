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
  email TEXT NOT NULL,
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
   - If email exists → Link OAuth account, login
   - If new → Redirect to account creation choice
8. Create session, redirect appropriately

### Pi Sign-in Flow (Implicit Flow)

1. User clicks "Sign in with Pi" button
2. Frontend: `Pi.signIn()` or redirect to `accounts.pinet.com`
3. User approves in Pi interface
4. Redirect back with `#access_token`
5. Frontend: Read token from URL fragment
6. Frontend: Call `POST /api/auth/pi/callback` with token
7. Backend: Call `api.minepi.com/v2/me` with token
8. Backend: Get `{uid, username, wallet_address}`
9. Backend: Check for existing uid/email:
   - If uid exists → Login (existing Pi user)
   - If email exists → Link Pi account, login
   - If new → Redirect to account creation choice
10. Create session, redirect appropriately

### Account Creation Choice Flow

```
New user detected → Redirect to /auth/account-choice
├─ Option 1: "Join Existing Company"
│  ├─ Enter company code
│  ├─ Validate company exists
│  └─ Create user account, link to company, login
└─ Option 2: "Create New Company"
   ├─ Enter company details
   ├─ Create company
   └─ Create user account, link to company, login
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

### CSRF Protection
- State parameter validation (Pi Sign-in)
- NextAuth.js built-in CSRF protection (Google/Microsoft)

### Token Security
- HTTPS-only cookies in production
- Secure token storage (no localStorage for sensitive tokens)
- Short-lived access tokens (Pi Sign-in)

### Account Linking
- Verify email ownership before linking
- Prevent unauthorized account linking
- Audit log for account linking events

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
- ✅ OAuth accounts auto-link to existing password accounts
- ✅ New users can join or create companies
- ✅ Mobile-responsive authentication flow
- ✅ All TypeScript compilation passes
- ✅ Backward compatibility with existing email/password authentication
- ✅ Production build successful

---

**Design Completed:** 2026-07-10  
**Status:** Ready for Implementation Planning  
**Next Step:** Create detailed implementation plan using writing-plans skill