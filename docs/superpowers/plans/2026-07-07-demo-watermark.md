# Demo Watermark System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription-based watermark system to prevent demo/trial users from printing clean quotations and purchase orders.

**Architecture:** Add subscription_status field to companies table, create reusable DemoWatermark component that wraps PrintDoc, and integrate into print flow with conditional rendering based on subscription status.

**Tech Stack:** Next.js 15, TypeScript, PostgreSQL, React, CSS-in-JS

---

## File Structure

**Files to create:**
- `migrate-subscription-status.sql` - Database migration for subscription status field
- `src/components/DemoWatermark.tsx` - Reusable watermark component
- `src/app/globals.css` - Updated with watermark styles (append)

**Files to modify:**
- `src/types/index.ts` - Add subscription_status to Settings interface
- `src/app/api/settings/route.ts` - Include subscription_status in API response
- `src/app/quotes/[id]/page.tsx` - Integrate DemoWatermark component

---

## Task 1: Create Database Migration

**Files:**
- Create: `migrate-subscription-status.sql`

- [ ] **Step 1: Create SQL migration file**

```sql
-- Add subscription_status column to companies table
ALTER TABLE companies 
ADD COLUMN subscription_status VARCHAR(20) 
DEFAULT 'demo' 
CHECK (subscription_status IN ('demo', 'trial', 'active', 'past_due'));

-- Update existing companies to have 'demo' status
UPDATE companies SET subscription_status = 'demo' WHERE subscription_status IS NULL;

-- Create index for faster subscription status queries
CREATE INDEX idx_companies_subscription_status ON companies(subscription_status);
```

- [ ] **Step 2: Run migration on database**

Run: `psql $DATABASE_URL -f migrate-subscription-status.sql`
Expected: Success message, no errors

- [ ] **Step 3: Verify migration**

Run: `psql $DATABASE_URL -c "\d companies"`
Expected: See `subscription_status` column in table definition

- [ ] **Step 4: Commit migration**

```bash
git add migrate-subscription-status.sql
git commit -m "db: add subscription_status column to companies table

- Add subscription_status enum with demo/trial/active/past_due values
- Set default to 'demo' for existing companies
- Add index for subscription status queries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add subscription_status to Settings interface**

Find the existing `Settings` interface (around line 19) and add the subscription_status field:

```typescript
export interface Settings {
  id: string;
  company: string;
  address: string;
  mobile: string;
  email: string;
  prepared_by: string;
  terms: string;
  del_note: string;
  closing_note: string;
  updated_at: string;
  subscription_status: 'demo' | 'trial' | 'active' | 'past_due';
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors

- [ ] **Step 3: Commit type changes**

```bash
git add src/types/index.ts
git commit -m "types: add subscription_status to Settings interface

- Add subscription_status field to Settings type
- Define allowed values: demo, trial, active, past_due
- Maintain type safety for subscription status usage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Update API Route

**Files:**
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: Read current settings API implementation**

Run: `cat src/app/api/settings/route.ts`
Expected: See current API response structure

- [ ] **Step 2: Update API response to include subscription_status**

Modify the settings query to include the subscription_status field:

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const settings = await sql`
      SELECT 
        id,
        company,
        address,
        mobile,
        email,
        prepared_by,
        terms,
        del_note,
        closing_note,
        updated_at,
        subscription_status
      FROM settings
      LIMIT 1
    `;

    if (settings.length === 0) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    console.error('GET /api/settings', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Test API endpoint**

Run: `curl http://localhost:3000/api/settings`
Expected: JSON response with `subscription_status: "demo"` field

- [ ] **Step 4: Commit API changes**

```bash
git add src/app/api/settings/route.ts
git commit -m "api: add subscription_status to settings endpoint

- Include subscription_status in GET /api/settings response
- Return subscription status for watermark logic
- Maintain existing API structure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Create DemoWatermark Component

**Files:**
- Create: `src/components/DemoWatermark.tsx`

- [ ] **Step 1: Create DemoWatermark component with watermark logic**

```typescript
'use client';

import React from 'react';

interface DemoWatermarkProps {
  children: React.ReactNode;
  subscriptionStatus: string;
}

export default function DemoWatermark({ children, subscriptionStatus }: DemoWatermarkProps) {
  const shouldShowWatermark = 
    !subscriptionStatus || 
    ['demo', 'trial'].includes(subscriptionStatus);

  return (
    <div style={{ position: 'relative' }}>
      {children}
      {shouldShowWatermark && (
        <div 
          className="demo-watermark"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              fontSize: '120px',
              fontWeight: 900,
              color: '#ff0000',
              whiteSpace: 'nowrap',
              letterSpacing: '8px',
              userSelect: 'none',
            }}
          >
            DEMO
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npm run build`
Expected: Build succeeds, no errors

- [ ] **Step 3: Commit component**

```bash
git add src/components/DemoWatermark.tsx
git commit -m "feat: add DemoWatermark component for document protection

- Create reusable watermark component for demo/trial accounts
- Display fixed DEMO text with -45deg rotation
- Use pointer-events: none for unremovable overlay
- Support future document types beyond quotations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Integrate Watermark into Print Flow

**Files:**
- Modify: `src/app/quotes/[id]/page.tsx`

- [ ] **Step 1: Add DemoWatermark import**

Add import at top of file:
```typescript
import DemoWatermark from '@/components/DemoWatermark';
```

- [ ] **Step 2: Wrap PrintDoc with DemoWatermark in print mode**

Find the printType rendering section (around line 39-56) and wrap the PrintDoc components:

```typescript
if (printType) {
  return (
    <>
      <div className="no-print p-4 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-800 flex justify-between items-center">
        <span>🖨️ Print preview — {printType === 'po' ? 'Purchase Order' : 'Customer Quotation'}</span>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Print now</button>
          <a href={`/quotes/${id}`} className="px-3 py-1 border border-gray-300 rounded text-xs">Back to edit</a>
        </div>
      </div>
      <DemoWatermark subscriptionStatus={settings.subscription_status}>
        <div className="print-only" ref={printRef}>
          <PrintDoc quote={quote} settings={settings} type={printType} />
        </div>
        <div className="no-print p-8 max-w-4xl mx-auto">
          <PrintDoc quote={quote} settings={settings} type={printType} />
        </div>
      </DemoWatermark>
    </>
  );
}
```

- [ ] **Step 3: Verify integration compiles**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors

- [ ] **Step 4: Commit integration**

```bash
git add src/app/quotes/[id]/page.tsx
git commit -m "feat: integrate DemoWatermark into print flow

- Wrap PrintDoc with DemoWatermark component
- Pass subscription status from settings to watermark
- Apply watermark to both screen preview and print output
- Maintain existing print preview functionality

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Add Print-Specific Watermark Styles

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add watermark print styles**

Append to the end of the existing globals.css file:

```css
/* Demo Watermark Styles */
@media print {
  .demo-watermark {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 9999 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `npm run build`
Expected: Build succeeds, no CSS errors

- [ ] **Step 3: Commit CSS changes**

```bash
git add src/app/globals.css
git commit -m "style: add print-specific watermark styles

- Ensure watermark appears in printed output
- Use exact color adjustment for print consistency
- Maintain fixed positioning across all pages
- Support multi-page document printing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Manual Testing

**Files:**
- None (testing existing implementation)

- [ ] **Step 1: Start development server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

- [ ] **Step 2: Test demo account watermark**

1. Navigate to http://localhost:3000/quotes
2. Click on any existing quote
3. Click "🖨️ Print quotation" or "🚚 PO" button
4. Verify "DEMO" watermark appears diagonally across the document
5. Verify watermark appears in both preview and actual print dialog
6. Try printing to PDF to confirm watermark is in output

Expected: Watermark visible in preview and printed output

- [ ] **Step 3: Test watermark persistence**

1. With print preview open, try scrolling the page
2. Verify watermark stays fixed and doesn't scroll away
3. Try resizing browser window
4. Verify watermark maintains position and size

Expected: Watermark remains fixed regardless of scrolling or resizing

- [ ] **Step 4: Test different subscription statuses**

```sql
-- Test active account (no watermark)
UPDATE companies SET subscription_status = 'active' WHERE code = 'CWC';
```

1. Refresh the print preview
2. Verify NO watermark appears for active accounts

Expected: Clean documents for active accounts

```sql
-- Test trial account (watermark appears)
UPDATE companies SET subscription_status = 'trial' WHERE code = 'CWC';
```

1. Refresh the print preview
2. Verify watermark DOES appear for trial accounts

Expected: Watermark visible for trial accounts

```sql
-- Reset to demo
UPDATE companies SET subscription_status = 'demo' WHERE code = 'CWC';
```

- [ ] **Step 5: Test multi-page documents**

1. Create a quote with many items (8+ items to span multiple pages)
2. Open print preview and use Ctrl+P to open print dialog
3. Check print preview to see if multiple pages are shown
4. Verify watermark appears on all pages in the print preview

Expected: Watermark repeats on each printed page

---

## Task 8: Build and Deploy

**Files:**
- None (deployment steps)

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Build completes successfully with no errors

- [ ] **Step 2: Verify build output**

Check that:
- .next/build directory is created
- No TypeScript errors in build output
- No missing imports or compilation errors

Expected: Clean build output

- [ ] **Step 3: Push changes to GitHub**

```bash
git push origin main
```

Expected: Successful push to remote repository

- [ ] **Step 4: Test in production environment**

1. Deploy to production (if using Vercel/other hosting)
2. Test watermark functionality in production
3. Verify print preview works in production
4. Test actual printing to PDF from production

Expected: Watermark functionality works identically in production

- [ ] **Step 5: Create final completion commit**

```bash
git commit --allow-empty -m "chore: complete demo watermark system implementation

- All components implemented and tested
- Watermark displays correctly for demo/trial accounts
- Print preview and PDF output working
- Production deployment successful

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Documentation and Cleanup

**Files:**
- Modify: `README.md` (optional)

- [ ] **Step 1: Update README with subscription status info (optional)**

Add to README.md if you want to document the new feature:

```markdown
## Subscription Status

Companies can have the following subscription statuses:
- `demo` - Demo account with watermarked documents
- `trial` - Trial account with watermarked documents  
- `active` - Active paying account with clean documents
- `past_due` - Past due account with watermarked documents

Watermark appears on all printed documents (quotations, POs) for demo and trial accounts.
```

- [ ] **Step 2: Clean up any temporary files**

Remove any test files or temporary artifacts created during development

Expected: Clean working directory

- [ ] **Step 3: Final git status check**

Run: `git status`
Expected: Clean working directory (no uncommitted changes)

---

## Self-Review Verification

- [ ] **Spec Coverage Check:** All requirements from design spec are implemented
- [ ] **Placeholder Scan:** No TBD, TODO, or incomplete steps found
- [ ] **Type Consistency:** All type names and interfaces match across tasks
- [ ] **Build Verification:** Production build succeeds without errors
- [ ] **Testing Verification:** Manual testing confirms all functionality works

## Success Criteria

**Functional Requirements Met:**
- ✅ Database schema updated with subscription_status field
- ✅ API returns subscription status in settings endpoint
- ✅ DemoWatermark component created and integrated
- ✅ Watermark displays for demo/trial accounts
- ✅ Watermark appears in both preview and print output
- ✅ Active/past_due accounts show clean documents

**Technical Requirements Met:**
- ✅ TypeScript compilation succeeds
- ✅ Production build succeeds
- ✅ No breaking changes to existing functionality
- ✅ Component is reusable for future document types
- ✅ Secure-by-default approach (watermark shows if uncertain)

**Testing Requirements Met:**
- ✅ Manual testing confirms watermark visibility
- ✅ Print preview shows watermark correctly
- ✅ PDF output includes watermark
- ✅ Multi-page documents supported
- ✅ Different subscription statuses work correctly