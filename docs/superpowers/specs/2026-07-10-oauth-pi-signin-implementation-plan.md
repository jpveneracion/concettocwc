# OAuth + Pi Sign-in Implementation Plan

**Project:** Concetto Window Coverings Multi-tenant Quotation System  
**Date:** 2026-07-10  
**Status:** Ready for Phase-by-Phase Implementation  
**Version:** 1.0  
**Design Spec:** [2026-07-10-oauth-pi-signin-design.md](./2026-07-10-oauth-pi-signin-design.md)

---

## Implementation Approach

**Strategy:** Linear Phase-by-Phase with Subagent Execution + Spec Validation Gates

**Process Flow:**
```
Phase 1 → Subagent Implementation → Spec Review → ✅/❌ → Phase 2 → ...
```

**Quality Gates:** Each phase must pass spec review before proceeding to next phase.

**Review Criteria:**
- ✅ All phase requirements implemented per design spec
- ✅ TypeScript compilation passes (npm run build)
- ✅ No regressions in existing functionality  
- ✅ Code follows project patterns and standards
- ✅ Ready for next phase dependencies

---

## Phase 1: Setup & Database Infrastructure

**Goals:** Establish foundation for OAuth implementation

**Tasks:**
1. Install NextAuth.js dependencies
2. Configure environment variables in `.env.example`
3. Run database migration for `oauth_accounts` table
4. Verify database schema matches design spec
5. Test database connectivity

**Deliverables:**
- `next-auth` and `@auth/core` packages installed
- Complete environment variables in `.env.example`
- `oauth_accounts` table created and verified
- Migration script tested and working

**Success Criteria:**
- `npm install` completes without errors
- Database migration runs successfully
- `oauth_accounts` table structure matches spec exactly
- Can query oauth_accounts table successfully

**Spec Review Checklist:**
- [ ] All required dependencies installed
- [ ] Environment variables documented and complete
- [ ] Database schema matches design spec Section "Database Schema"
- [ ] Migration script executes without errors
- [ ] Database indexes created as specified

---

## Phase 2: Google/Microsoft OAuth Integration

**Goals:** Implement standard OAuth 2.0 authorization code flow

**Tasks:**
1. Complete NextAuth.js configuration for Google provider
2. Complete NextAuth.js configuration for Microsoft provider  
3. Implement OAuth callback handling in NextAuth routes
4. Add account linking logic with email verification
5. Implement password confirmation for existing accounts
6. Add audit logging for account linking events
7. Test Google OAuth flow end-to-end
8. Test Microsoft OAuth flow end-to-end

**Deliverables:**
- Complete NextAuth.js configuration in `src/auth.ts`
- Enhanced session management with OAuth data
- Account linking logic in `src/lib/oauth.ts`
- Audit logging for OAuth events
- Working Google OAuth sign-in flow
- Working Microsoft OAuth sign-in flow

**Success Criteria:**
- Google OAuth redirects and callback work correctly
- Microsoft OAuth redirects and callback work correctly
- Account linking with existing email accounts works
- New users are properly redirected to account choice
- Audit logs capture all OAuth events
- No security vulnerabilities in account linking

**Spec Review Checklist:**
- [ ] NextAuth.js configuration matches design spec Section "Google/Microsoft Flow"
- [ ] Account linking includes email verification (security requirement)
- [ ] Password confirmation required for existing account links
- [ ] Audit logging implemented as per security section
- [ ] Session management includes provider data
- [ ] OAuth flows tested end-to-end successfully

---

## Phase 3: Pi Sign-in Integration

**Goals:** Implement Pi Network implicit flow OAuth

**Tasks:**
1. Implement Pi Network SDK integration
2. Complete Pi callback API route implementation
3. Add frontend token extraction from URL fragments
4. Implement API integration with `api.minepi.com/v2/me`
5. Add Pi-specific user handling (no email scenario)
6. Enable Pi Sign-in button in UI
7. Test Pi Sign-in flow end-to-end

**Deliverables:**
- Complete Pi callback implementation in `src/app/api/auth/pi/callback/route.ts`
- Frontend Pi SDK integration for token handling
- Pi Network user validation and session creation
- Enabled Pi Sign-in button in `ProviderButtons.tsx`
- Working Pi Sign-in flow

**Success Criteria:**
- Pi Network token extraction works correctly
- Token validation with Pi API succeeds
- Pi users are properly identified by `uid`
- New Pi users redirected to account choice with email requirement
- Existing Pi users logged in successfully
- Pi Sign-in button functional and enabled

**Spec Review Checklist:**
- [ ] Pi Network token extraction handles URL fragments correctly
- [ ] API integration with `/v2/me` endpoint implemented
- [ ] Pi users identified by `uid` as per spec
- [ ] Email requirement handled for new Pi users
- [ ] Token validation and security implemented per spec
- [ ] Pi Sign-in button enabled and functional
- [ ] Pi flow tested end-to-end successfully

---

## Phase 4: Account Creation Flow

**Goals:** Implement company joining/creation for new OAuth users

**Tasks:**
1. Build account choice page UI (`/auth/account-choice`)
2. Complete account choice API implementation
3. Implement company joining logic with code validation
4. Implement company creation logic with unique code generation
5. Add abandonment state prevention in layout
6. Implement temporary session state management
7. Test account creation flows end-to-end

**Deliverables:**
- Complete account choice page in `src/app/auth/account-choice/page.tsx`
- Enhanced account choice API in `src/app/api/auth/account-choice/route.ts`
- Abandonment state prevention in `src/app/layout.tsx`
- Working company join flow
- Working company creation flow

**Success Criteria:**
- Account choice page displays correctly for all OAuth providers
- Company code validation works accurately
- New company creation generates unique codes
- Users properly linked to companies
- Abandonment state prevented (no users with null company_id)
- Temporary session state expires appropriately

**Spec Review Checklist:**
- [ ] Account choice page handles all OAuth providers correctly
- [ ] Email input required for Pi users per spec
- [ ] Company code validation implemented and tested
- [ ] Company creation generates unique codes
- [ ] Abandonment state prevention implemented per design spec
- [ ] Layout-based auth checks redirect users without company_id
- [ ] Database constraint `company_id NOT NULL` enforced
- [ ] Temporary session state works and expires correctly

---

## Phase 5: UI Implementation & Polish

**Goals:** Complete mobile-first responsive authentication UI

**Tasks:**
1. Update login page with all OAuth providers
2. Enhance provider buttons with proper styling
3. Implement loading states for OAuth flows
4. Add error handling UI components
5. Ensure mobile-first responsive design
6. Test UI on mobile and desktop viewports
7. Add proper error messages and user feedback

**Deliverables:**
- Complete login page with 4 sign-in options
- Enhanced provider buttons with mobile-optimized styling
- Loading states for all OAuth flows
- Error handling UI components
- Mobile-responsive authentication flow

**Success Criteria:**
- Login page displays all 4 sign-in options clearly
- Provider buttons are mobile-optimized (44px min height)
- Loading states provide good user feedback
- Error messages are clear and mobile-friendly
- Responsive design works on all screen sizes
- Touch targets are appropriately sized for mobile

**Spec Review Checklist:**
- [ ] Login page matches design spec Section "Login Page Updates"
- [ ] Provider buttons use proper colors and styling
- [ ] Mobile-first specifications met (Section "Mobile-First Specifications")
- [ ] Loading states implemented for all OAuth flows
- [ ] Error handling UI covers all scenarios in Section "Error Handling"
- [ ] Responsive design tested and working
- [ ] All buttons meet 44px minimum height requirement

---

## Phase 6: Testing & Deployment

**Goals:** Comprehensive testing and production deployment

**Tasks:**
1. Write comprehensive tests for OAuth flows
2. Write tests for account linking logic
3. Write tests for company creation/joining
4. Perform security testing on OAuth implementation
5. Test all OAuth flows end-to-end
6. Test backward compatibility with email/password auth
7. Run `npm run build` successfully
8. Test deployment to production environment
9. Verify multi-tenant security (no cross-tenant access)
10. Push implementation to GitHub

**Deliverables:**
- Comprehensive test suite for OAuth functionality
- Security audit results
- Successful production build
- Deployment verification
- GitHub repository updated with working implementation

**Success Criteria:**
- All OAuth flows have test coverage
- Account linking logic thoroughly tested
- Security testing shows no vulnerabilities
- `npm run build` completes without errors
- Production deployment successful
- Backward compatibility maintained
- Multi-tenant security enforced

**Spec Review Checklist:**
- [ ] All success criteria from design spec met
- [ ] All security requirements implemented and tested
- [ ] TypeScript compilation passes (npm run build)
- [ ] OAuth flows tested end-to-end
- [ ] Account linking tested and secure
- [ ] Company creation/joining tested
- [ ] Backward compatibility with email/password verified
- [ ] Multi-tenant security enforced (no cross-tenant access)
- [ ] Production build successful
- [ ] Code pushed to GitHub

---

## Implementation Timeline Estimate

**Phase 1:** 1-2 hours (Setup & Database)  
**Phase 2:** 3-4 hours (Google/Microsoft OAuth)  
**Phase 3:** 2-3 hours (Pi Sign-in Integration)  
**Phase 4:** 3-4 hours (Account Creation Flow)  
**Phase 5:** 2-3 hours (UI Implementation & Polish)  
**Phase 6:** 2-3 hours (Testing & Deployment)  

**Total Estimated Time:** 13-19 hours

---

## Risk Mitigation

**Potential Risks:**
1. **OAuth Provider Issues:** Provider API changes or rate limits
   - *Mitigation:* Use latest NextAuth.js versions, implement error handling
   
2. **Pi Network Integration:** Pi API changes or instability
   - *Mitigation:* Thorough error handling, graceful fallbacks
   
3. **Database Migration Complexity:** Existing data conflicts
   - *Mitigation:* Backup database, test migration on staging
   
4. **Multi-tenant Security Gaps:** Cross-tenant access vulnerabilities
   - *Mitigation:* Security testing, audit logging, constraints
   
5. **Mobile UI Issues:** Responsive design problems
   - *Mitigation:* Test on multiple devices, use mobile-first approach

---

## Next Steps

1. ✅ Design spec reviewed and approved
2. ✅ Implementation plan created
3. 🔄 **Begin Phase 1: Setup & Database Infrastructure**
4. ⏳ Spec review after each phase
5. ⏳ Continue through Phase 6
6. ⏳ Final deployment and GitHub push

---

**Implementation Plan Created:** 2026-07-10  
**Status:** Ready for Phase 1 Implementation  
**Next Action:** Begin Phase 1 with subagent execution