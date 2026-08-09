# Join Company Flow (Disabled)

## What is it?

Join Company is an account on-boarding option in the OAuth sign-in flow (Google / Pi). After a new user approves the OAuth permission, they are taken to the account-choice page (`/auth/account-choice`), where they previously could choose between:

1. **Create Company** — register a brand-new company workspace (the only option now)
2. **Join Company** — join an *existing* company by entering its company code

Joining was meant for employees/teammates who needed access to a company that was already registered (e.g., an owner signs up first, then their staff join the same workspace using the company's business code).

## How it worked

1. User signs in with Google or Pi (OAuth).
2. Redirected to `/auth/account-choice` with temporary OAuth data in `sessionStorage` (`temp_token`, `pi_user`).
3. User picks **Join Company** and types the target company's code (e.g., `CWC`).
4. `POST /api/auth/account-choice` (and the duplicate `/api/account-choice`) with `action: 'join'` and `company_code`.
5. The API resolved the code via the SECURITY DEFINER function `validateCompanyCode()` (backed by `find_company_by_code`), which bypasses RLS since the request happens before a session/tenant context exists.
6. On success a new user was created inside that company, linked to the OAuth identity, given a session cookie, and redirected to `/dashboard`.

The code is the company's unique business identifier (`companies.code`, unique, case-insensitive) — the same one shown in Settings → Company info → Company code.

## Why it was disabled

As of August 2026 the join flow is **commented out** because every company in the system is self-created by its own owner; there is no multi-member/team use case yet. Keeping only **Create Company** simplifies the sign-in experience and removes a path that was never exercised in production.

## What was commented out

- `src/app/auth/account-choice/page.tsx`
  - "Join Company" toggle button on the action switch (the switch now defaults to Create Company)
  - Join form branch (Company Code input)
  - Join payload spread in the submit body
  - "Join Company" submit button label
- `src/app/api/auth/account-choice/route.ts`
  - `action === 'join'` branch (company-code validation + lookup via `validateCompanyCode`)
  - Join-specific `company` field in the success response
- `src/app/api/account-choice/route.ts` (duplicate/unused route, kept in sync)
  - Same `action === 'join'` branch and response `company` field commented out

## How to re-enable

1. In `src/app/auth/account-choice/page.tsx`: uncomment the "Join Company" button, the join form branch, and the join payload spread; restore the join submit label if desired.
2. In `src/app/api/auth/account-choice/route.ts` (and the duplicate `src/app/api/account-choice/route.ts`): uncomment the `action === 'join'` branch and the response `company` field.
3. Verify with a second OAuth account: sign in → choose Join Company → enter the target company code → confirm you land in that company's workspace.

## Related notes

- `validateCompanyCode()` (in `src/lib/oauth.ts`) returns `{ id, code, userCount }`; when the company has 0 users it is considered an orphan and safe to associate with a new user.
- The NextAuth OAuth path in `src/auth.ts` still auto-generates/derives a company code on sign-in and **never** offers a join option — join only ever existed in the account-choice page.
- `src/app/api/account-choice/route.ts` is a duplicate of the auth route that no page calls; it was commented out in sync so both copies stay identical if the flow is re-enabled.
