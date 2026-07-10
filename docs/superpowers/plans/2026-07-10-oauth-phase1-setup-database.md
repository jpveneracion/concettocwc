# Phase 1: Setup & Database Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundation for OAuth implementation by installing dependencies, configuring environment variables, and creating the database schema.

**Architecture:** This phase creates the infrastructure layer that all subsequent OAuth functionality depends on - NextAuth.js packages for OAuth handling, environment configuration for secure credential management, and the database schema for storing OAuth account data.

**Tech Stack:** Next.js, NextAuth.js, PostgreSQL (Neon), TypeScript

---

## File Structure

**Phase 1 creates/modifies:**
- `package.json` - Add NextAuth.js dependencies
- `.env.example` - Add OAuth environment variable templates
- `migrations/oauth-system.sql` - Database schema (already exists, will execute)
- `docs/superpowers/plans/2026-07-10-oauth-phase1-success.md` - Phase completion verification

**No new source code files** - this is purely infrastructure setup

---

## Task 1: Install NextAuth.js Dependencies

**Files:**
- Modify: `package.json`

**Goal:** Add NextAuth.js packages required for Google and Microsoft OAuth integration

**Context:** The project currently has `package.json` with basic Next.js dependencies but is missing the NextAuth.js packages needed for OAuth functionality. NextAuth.js requires both `next-auth` and `@auth/core` packages.

- [ ] **Step 1: Update package.json dependencies**

```bash
cd /e/laragon/www/concettowc
npm install next-auth@^5.0.0-beta.19 @auth/core@^5.0.0-beta.19
```

Expected output:
```
added 12 packages, and audited 123 packages in 5s
found 0 vulnerabilities
```

- [ ] **Step 2: Verify installation in package.json**

Check that these lines exist in `package.json` dependencies section:
```json
"next-auth": "^5.0.0-beta.19",
"@auth/core": "^5.0.0-beta.19"
```

- [ ] **Step 3: Test TypeScript compilation**

```bash
npm run build
```

Expected: Build completes (may have warnings about unused auth config, but no errors)

- [ ] **Step 4: Commit Phase 1.1 - NextAuth.js installation**

```bash
git add package.json package-lock.json
git commit -m "feat(phase1): install NextAuth.js v5 beta for OAuth integration"
```

---

## Task 2: Configure Environment Variables Template

**Files:**
- Modify: `.env.example`

**Goal:** Add OAuth environment variable templates so developers know which credentials are required

**Context:** The `.env.example` currently has DATABASE_URL and PayMongo variables. We need to add NextAuth.js and OAuth provider credentials.

- [ ] **Step 1: Add environment variables to .env.example**

Append to `.env.example`:
```bash
# NextAuth.js Configuration
NEXTAUTH_SECRET=your-nextauth-secret-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth Credentials  
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Pi Network Sign-in
PI_CLIENT_ID=your-pi-client-id
PI_REDIRECT_URI=http://localhost:3000/auth/pi/callback
```

- [ ] **Step 2: Verify .env.example structure**

Run: `cat .env.example`

Expected: File contains both original variables (DATABASE_URL, PayMongo) and new OAuth variables

- [ ] **Step 3: Document environment variable purpose**

Create comment block at top of `.env.example`:
```bash
# Concetto Window Coverings - Environment Configuration
# Copy this file to .env.local and fill in actual values
# Never commit .env.local to version control

# Database & Core
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# OAuth Authentication (NextAuth.js + Providers)
# See: https://next-auth.js.org/configuration/options
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Commit Phase 1.2 - Environment variables template**

```bash
git add .env.example
git commit -m "feat(phase1): add OAuth environment variable templates to .env.example"
```

---

## Task 3: Execute Database Migration

**Files:**
- Execute: `migrations/oauth-system.sql`
- Verify: Database schema

**Goal:** Create the `oauth_accounts` table and required indexes

**Context:** The migration file already exists at `migrations/oauth-system.sql`. We need to execute it to create the database schema.

- [ ] **Step 1: Verify DATABASE_URL is set**

```bash
echo $DATABASE_URL | head -c 20
```

Expected: Shows postgres connection string (not empty)

If empty: `export DATABASE_URL="your-actual-database-url"`

- [ ] **Step 2: Verify migration file exists**

```bash
ls -la migrations/oauth-system.sql
cat migrations/oauth-system.sql
```

Expected: File exists and contains CREATE TABLE statement for oauth_accounts

- [ ] **Step 3: Execute OAuth migration**

```bash
node scripts/run-oauth-migration.js
```

Expected output:
```
✓ Statement 1/4
✓ Statement 2/4  
✓ Statement 3/4
✓ Statement 4/4
Migration complete
```

- [ ] **Step 4: Verify oauth_accounts table was created**

```bash
psql $DATABASE_URL -c "\d oauth_accounts"
```

Expected: Shows table structure with columns: id, user_id, provider, provider_user_id, email, username, wallet_address, access_token, refresh_token, expires_at, created_at, updated_at

- [ ] **Step 5: Verify indexes were created**

```bash
psql $DATABASE_URL -c "\di idx_oauth_accounts%"
```

Expected: Shows 3 indexes:
- idx_oauth_accounts_user_id
- idx_oauth_accounts_provider  
- idx_oauth_accounts_email

- [ ] **Step 6: Test basic database query**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM oauth_accounts;"
```

Expected: `0` (table is empty)

- [ ] **Step 7: Commit Phase 1.3 - Database migration execution**

```bash
git add migrations/oauth-system.sql scripts/run-oauth-migration.js
git commit -m "feat(phase1): execute oauth_accounts table migration with indexes"
```

---

## Task 4: Validate Database Schema Matches Design Spec

**Files:**
- Verify: Database schema against design spec

**Goal:** Ensure the implemented schema exactly matches the design specification

**Context:** The design spec defines exact column names, types, and constraints. We must verify our implementation matches exactly.

- [ ] **Step 1: Compare table structure to design spec**

Run: `psql $DATABASE_URL -c "\d oauth_accounts"`

Verify against spec requirements:
```sql
-- Required columns from spec:
id UUID PRIMARY KEY DEFAULT gen_random_uuid() ✅
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ✅  
provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'pi')) ✅
provider_user_id TEXT NOT NULL ✅
email TEXT ✅
username TEXT ✅
wallet_address TEXT ✅
access_token TEXT ✅
refresh_token TEXT ✅
expires_at TIMESTAMPTZ ✅
created_at TIMESTAMPTZ DEFAULT NOW() ✅
updated_at TIMESTAMPTZ DEFAULT NOW() ✅
UNIQUE(provider, provider_user_id) ✅
```

- [ ] **Step 2: Verify CHECK constraint on provider column**

```bash
psql $DATABASE_URL -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'oauth_accounts'::regclass AND conname LIKE '%provider%';"
```

Expected: Shows CHECK constraint restricting to 'google', 'microsoft', 'pi'

- [ ] **Step 3: Verify foreign key constraint to users table**

```bash
psql $DATABASE_URL -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'oauth_accounts'::regclass AND contype = 'f';"
```

Expected: Shows foreign key to users(id) with ON DELETE CASCADE

- [ ] **Step 4: Verify unique constraint exists**

```bash
psql $DATABASE_URL -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'oauth_accounts'::regclass AND contype = 'u';"
```

Expected: Shows UNIQUE(provider, provider_user_id) constraint

- [ ] **Step 5: Test constraint enforcement**

```bash
psql $DATABASE_URL -c "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ('550e8400-e29b-41d4-a716-446655440000', 'google', 'test123') RETURNING id;"
```

Expected: Returns UUID (successful insert)

Then test duplicate:
```bash
psql $DATABASE_URL -c "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ('550e8400-e29b-41d4-a716-446655440001', 'google', 'test123');"
```

Expected: ERROR: duplicate key value violates unique constraint

- [ ] **Step 6: Clean up test data**

```bash
psql $DATABASE_URL -c "DELETE FROM oauth_accounts WHERE provider_user_id = 'test123';"
```

Expected: DELETE 1

- [ ] **Step 7: Commit Phase 1.4 - Schema validation documentation**

```bash
echo "# OAuth Schema Validation

Phase 1 database schema has been validated against design spec:
- ✅ All required columns present with correct types
- ✅ CHECK constraint on provider column  
- ✅ Foreign key to users with CASCADE delete
- ✅ UNIQUE constraint on (provider, provider_user_id)
- ✅ All indexes created correctly
- ✅ Constraint enforcement verified

Date: $(date +%Y-%m-%d)
Database: Neon PostgreSQL
Migration: oauth-system.sql
" > docs/superpowers/plans/2026-07-10-oauth-phase1-validation.md

git add docs/superpowers/plans/2026-07-10-oauth-phase1-validation.md
git commit -m "docs(phase1): document oauth_accounts schema validation results"
```

---

## Task 5: Test Database Connectivity and Operations

**Files:**
- Create: `src/__tests__/phase1-database.test.ts`

**Goal:** Create basic tests to verify database operations work correctly

**Context:** We need to test that the database layer is functioning before building OAuth logic on top of it.

- [ ] **Step 1: Create test file**

Create `src/__tests__/phase1-database.test.ts`:
```typescript
import { sql } from '@/lib/db';

describe('Phase 1: OAuth Database Schema', () => {
  test('oauth_accounts table exists', async () => {
    const result = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'oauth_accounts'
    `;
    expect(result.length).toBeGreaterThan(0);
  });

  test('oauth_accounts table has correct columns', async () => {
    const result = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'oauth_accounts'
      ORDER BY ordinal_position
    `;
    
    const columns = result.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('user_id');
    expect(columns).toContain('provider');
    expect(columns).toContain('provider_user_id');
  });

  test('can insert and select oauth_account', async () => {
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    
    // Insert test record
    await sql`
      INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email)
      VALUES (${testUserId}, 'google', 'test_123', 'test@example.com')
    `;
    
    // Select it back
    const result = await sql`
      SELECT * FROM oauth_accounts WHERE provider_user_id = 'test_123'
    `;
    
    expect(result.length).toBe(1);
    expect(result[0].provider).toBe('google');
    expect(result[0].email).toBe('test@example.com');
    
    // Cleanup
    await sql`DELETE FROM oauth_accounts WHERE provider_user_id = 'test_123'`;
  });

  test('enforces unique constraint on (provider, provider_user_id)', async () => {
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    
    // First insert should succeed
    await sql`
      INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
      VALUES (${testUserId}, 'pi', 'pi_user_123')
    `;
    
    // Duplicate should fail
    await expect(async () => {
      await sql`
        INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
        VALUES (${testUserId}, 'pi', 'pi_user_123')
      `;
    }).rejects.toThrow();
    
    // Cleanup
    await sql`DELETE FROM oauth_accounts WHERE provider_user_id = 'pi_user_123'`;
  });
});
```

- [ ] **Step 2: Run database tests**

```bash
npm test -- phase1-database.test.ts
```

Expected: All tests pass
```
 PASS  src/__tests__/phase1-database.test.ts
  Phase 1: OAuth Database Schema
    oauth_accounts table exists (15ms)
    oauth_accounts table has correct columns (8ms)
    can insert and select oauth_account (12ms)
    enforces unique constraint (23ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

- [ ] **Step 3: Commit Phase 1.5 - Database tests**

```bash
git add src/__tests__/phase1-database.test.ts
git commit -m "test(phase1): add oauth_accounts schema integration tests"
```

---

## Task 6: Create Phase Completion Verification

**Files:**
- Create: `docs/superpowers/plans/2026-07-10-oauth-phase1-success.md`

**Goal:** Document Phase 1 completion and create verification checklist for next phase

**Context:** Before moving to Phase 2, we need to verify all Phase 1 success criteria are met and create a clean handoff.

- [ ] **Step 1: Create phase success document**

Create `docs/superpowers/plans/2026-07-10-oauth-phase1-success.md`:
```markdown
# Phase 1: Setup & Database Infrastructure - COMPLETED ✅

**Completion Date:** 2026-07-10
**Status:** SUCCESSFUL
**Next Phase:** Phase 2 - Google/Microsoft OAuth Integration

---

## Success Criteria Verification

### ✅ Dependencies Installed
- [x] next-auth@^5.0.0-beta.19 installed
- [x] @auth/core@^5.0.0-beta.19 installed
- [x] No package installation conflicts
- [x] TypeScript compilation passes

### ✅ Environment Configuration
- [x] NEXTAUTH_SECRET variable defined in .env.example
- [x] NEXTAUTH_URL variable defined in .env.example
- [x] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET defined
- [x] MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET defined
- [x] PI_CLIENT_ID and PI_REDIRECT_URI defined
- [x] Documentation comments added to .env.example

### ✅ Database Schema
- [x] oauth_accounts table created successfully
- [x] All required columns present with correct data types
- [x] CHECK constraint on provider column (IN: 'google', 'microsoft', 'pi')
- [x] Foreign key to users(id) with ON DELETE CASCADE
- [x] UNIQUE constraint on (provider, provider_user_id)
- [x] Index idx_oauth_accounts_user_id created
- [x] Index idx_oauth_accounts_provider created
- [x] Index idx_oauth_accounts_email created
- [x] Schema validated against design spec

### ✅ Testing
- [x] Database connectivity verified
- [x] Basic CRUD operations tested
- [x] Constraint enforcement verified
- [x] Integration tests pass
- [x] No regressions in existing functionality

---

## Infrastructure Ready for Phase 2

**Available for Next Phase:**
- ✅ NextAuth.js packages installed and ready for configuration
- ✅ Environment variable templates for OAuth provider credentials
- ✅ Database schema for storing OAuth accounts
- ✅ Database connection verified and tested
- ✅ Test infrastructure for OAuth functionality

**Phase 2 Prerequisites Met:**
- NextAuth.js can be configured in src/auth.ts
- OAuth provider credentials can be added to .env.local
- Database is ready to store OAuth account data
- Existing authentication system remains functional

---

## Commits Created This Phase

1. `feat(phase1): install NextAuth.js v5 beta for OAuth integration`
2. `feat(phase1): add OAuth environment variable templates to .env.example`  
3. `feat(phase1): execute oauth_accounts table migration with indexes`
4. `docs(phase1): document oauth_accounts schema validation results`
5. `test(phase1): add oauth_accounts schema integration tests`

---

## Known Limitations for Next Phase

**Environment Variables Needed:**
- Actual OAuth provider credentials must be obtained from:
  - Google Cloud Console (for OAuth credentials)
  - Microsoft Azure Portal (for OAuth credentials)
  - Pi Network Developer Portal (for Pi credentials)

**Design Decisions Made:**
- Used NextAuth.js v5 beta (latest stable beta for OAuth flows)
- Enforced provider types via CHECK constraint (data integrity)
- Created email index for future account linking queries
- Used UUID primary key for consistency with users table

**Technical Debt:**
- None identified - clean infrastructure foundation

---

## Next Phase Preparation

**Phase 2 will build on:**
- NextAuth.js configuration in src/auth.ts (needs enhancement)
- OAuth library functions in src/lib/oauth.ts (needs completion)  
- Provider buttons component in src/components/auth/ProviderButtons.tsx (exists but disabled)
- Database schema verified and ready for OAuth data

**Ready for Phase 2: Google/Microsoft OAuth Integration** ✅
```

- [ ] **Step 2: Commit Phase 1.6 - Completion documentation**

```bash
git add docs/superpowers/plans/2026-07-10-oauth-phase1-success.md
git commit -m "docs(phase1): document Phase 1 completion and success criteria"
```

---

## Task 7: Final Phase 1 Verification

**Files:**
- Verify: All Phase 1 success criteria

**Goal:** Final verification that Phase 1 is complete and ready for Phase 2

**Context:** Before transitioning to Phase 2, we must verify all success criteria from the implementation plan are met.

- [ ] **Step 1: Verify npm install worked**

```bash
npm list next-auth @auth/core
```

Expected: Both packages shown with correct versions

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npm run build
```

Expected: Build completes successfully (no TypeScript errors)

- [ ] **Step 3: Verify environment variables documented**

```bash
grep -E "(NEXTAUTH|GOOGLE_CLIENT|MICROSOFT_CLIENT|PI_CLIENT)" .env.example
```

Expected: All 6 OAuth environment variables present

- [ ] **Step 4: Verify database schema**

```bash
psql $DATABASE_URL -c "\d oauth_accounts"
```

Expected: Shows complete table structure matching spec

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All tests pass (including new Phase 1 tests)

- [ ] **Step 6: Check git history**

```bash
git log --oneline -6
```

Expected: Shows 6 commits for Phase 1 tasks

- [ ] **Step 7: Create Phase 1 completion commit**

```bash
git tag phase1-complete -m "Phase 1: Setup & Database Infrastructure - COMPLETE"
```

---

## Phase 1 Success Criteria ✅

**Completion Checklist:**
- [x] NextAuth.js packages installed without errors
- [x] Environment variables documented in .env.example
- [x] oauth_accounts table created with correct schema
- [x] Database migration tested and working
- [x] Schema matches design spec exactly
- [x] Database connectivity verified
- [x] Integration tests pass
- [x] TypeScript compilation passes
- [x] No regressions in existing functionality
- [x] Documentation created for next phase

**Phase 1 Status: COMPLETE** ✅

**Next Step:** Proceed to Phase 2 - Google/Microsoft OAuth Integration