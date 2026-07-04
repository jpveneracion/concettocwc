# Quote Status Management - Design Spec

**Date:** 2026-07-02
**Status:** Draft

## Overview

Enable quote status management with quick actions on the list page and detailed controls on the quote detail page. Extend existing PUT API to accept status updates.

**Problem:** All quotes are permanently stuck in "draft" status because there's no way to change it. Dashboard conversion metrics are broken as a result.

**Solution:** Add status dropdowns with confirmation dialogs in both the quotes list and quote detail page, backed by extended PUT endpoint.

## Workflow Rules

- Allow any status transition (draft → sent → approved → draft, cancel anytime)
- No constraints - full flexibility for corrections and workflow changes
- Confirmation dialog required before status change

## API Changes

**File:** `src/app/api/quotes/[id]/route.ts`

### Changes to PUT Handler

1. Accept `status` field in request body
2. Validate status is one of: `draft`, `sent`, `approved`, `cancelled`
3. Return 400 if invalid status provided
4. Include `status = ${status}` in UPDATE statement

**No new endpoints** - extend existing PUT endpoint.

### Request Example

```json
PUT /api/quotes/[id]
{
  "customer_name": "John Doe",
  "customer_address": "123 Main St",
  "quote_date": "2026-07-02",
  "status": "sent",
  "items": [...]
}
```

## UI Changes

### List Page (`src/app/quotes/page.tsx`)

**Location:** Actions column in the quotes table

**Implementation:**
1. Add status dropdown `<select>` in Actions column
2. Options: draft, sent, approved, cancelled
3. `onChange` handler:
   - Shows confirmation: "Change status from [current] to [new]?"
   - Calls `PUT /api/quotes/[id]` with new status
   - Refreshes quote list on success
4. Keep existing Edit, Print, PO, Delete buttons

**UX:** Quick status changes without opening the quote.

### Quote Detail Page (`src/app/quotes/[id]/page.tsx`)

**Location:** In the form, near other quote header fields

**Implementation:**
1. Add status dropdown to form
2. Display current status with color badge (same as list page)
3. On form submit, include selected status in PUT request
4. Add confirmation when status changes to "approved" or "cancelled"

**UX:** Full control when viewing/editing quote details.

## Type Definitions

**File:** `src/types/index.ts`

Add `status` to `QuotePayload`:

```typescript
export type QuotePayload = {
  customer_name: string;
  customer_address: string | null;
  quote_date: string;
  our_ref: string | null;
  installation_fee: number;
  delivery_fee: number;
  items: QuoteItemPayload[];
  status?: string; // NEW
};
```

## Data Flow

1. User selects new status in dropdown
2. Confirmation dialog appears: "Change status from [current] to [new]?"
3. User confirms → PUT request to `/api/quotes/[id]` with `{status: "new-status"}`
4. API validates status → updates database → returns 200
5. UI refreshes quote data → shows updated status with new color

## Status Color Coding

Current styling (already in `quotes/page.tsx`):
- draft: `bg-gray-100 text-gray-600`
- sent: `bg-blue-100 text-blue-700`
- approved: `bg-green-100 text-green-700`
- cancelled: `bg-red-100 text-red-600`

## Error Handling

- **Invalid status:** Return 400 with error message
- **Network failure:** Show error toast/message
- **Confirmation cancelled:** Do nothing, stay on current status

## Files to Modify

1. `src/types/index.ts` - Add status to QuotePayload
2. `src/app/api/quotes/[id]/route.ts` - Accept and update status in PUT handler
3. `src/app/quotes/page.tsx` - Add status dropdown with confirmation
4. `src/app/quotes/[id]/page.tsx` - Add status dropdown to form

## Testing

- Change status from list page dropdown
- Change status from quote detail page
- Verify confirmation dialogs appear
- Verify status colors update correctly
- Verify invalid status returns 400
- Verify status persists after page refresh

## Future Enhancements (Out of Scope)

- Status change history/audit trail
- Email notifications on status change
- Role-based permissions for status changes
- Automatic status changes based on actions (e.g., printing quote)
