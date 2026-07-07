# Demo Watermark System Design

## Overview
Add subscription-based watermark system to prevent demo/trial users from printing clean quotations and purchase orders. Watermark appears on both print preview and actual print output to prevent screenshot workarounds.

## Requirements

### Functional Requirements
1. Add `subscription_status` field to companies table ('demo', 'trial', 'active', 'past_due')
2. Create reusable `DemoWatermark` component for document protection
3. Display "DEMO" watermark on all printed documents for demo/trial accounts
4. Watermark must appear in both screen preview and printed output
5. Watermark must be difficult to remove via DevTools (but not impossible)

### Non-Functional Requirements
1. Watermark styling: diagonal ~-45deg, large, semi-transparent, readable underneath
2. Fixed position to survive pagination and scrolling
3. Reusable for future document types (invoices, reports, etc.)
4. Safe default behavior (show watermark if status uncertain)

## Architecture

### Database Layer
```sql
ALTER TABLE companies 
ADD COLUMN subscription_status VARCHAR(20) 
DEFAULT 'demo' 
CHECK (subscription_status IN ('demo', 'trial', 'active', 'past_due'));
```

### API Layer
Update `GET /api/settings` response:
```typescript
{
  id: string,
  company: string,
  address: string,
  mobile: string,
  email: string,
  prepared_by: string,
  terms: string,
  del_note: string,
  closing_note: string,
  updated_at: string,
  subscription_status: 'demo' | 'trial' | 'active' | 'past_due'
}
```

### UI Layer
**Component Hierarchy:**
```
QuoteDetailPage
├── AppLayout (normal edit mode)
└── DemoWatermark (print mode, conditional)
    └── PrintDoc
```

**Data Flow:**
```
User loads quote page → Fetch quote + settings + company subscription status → 
If status is 'demo'/'trial' → Render PrintDoc with DemoWatermark wrapper →
Show watermarked preview + apply same watermark to print output
```

## Components

### DemoWatermark Component
**File:** `src/components/DemoWatermark.tsx`

**Props:**
```typescript
interface DemoWatermarkProps {
  children: React.ReactNode;
  subscriptionStatus: string;
}
```

**Implementation Strategy:**
- Conditionally render watermark based on `subscriptionStatus === 'demo' || 'trial'`
- Wrap children with positioned watermark layers
- Use `pointer-events: none` for unremovable but viewable watermark
- Multiple redundant layers with high `z-index: 9999`

**WatermarkLayer CSS Approach:**
- `position: fixed; top: 0; left: 0; right: 0; bottom: 0`
- Diagonal `-45deg` rotated "DEMO" text  
- `opacity: 0.15` for semi-transparency
- Repeating pattern covering entire viewport
- Works in both screen and `@media print`

### QuoteDetailPage Integration
**File:** `src/app/quotes/[id]/page.tsx`

**Changes:**
```typescript
// Wrap PrintDoc with DemoWatermark in print mode
{printType && (
  <DemoWatermark subscriptionStatus={settings.subscription_status}>
    <PrintDoc quote={quote} settings={settings} type={printType} />
  </DemoWatermark>
)}
```

### TypeScript Type Updates
**File:** `src/types/index.ts`

**Changes:**
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

## Security Considerations

### Limitations
- Client-side watermarking is deterrent, not prevention
- Determined users can bypass via DevTools, browser extensions, screenshots
- Think of it as a "Please don't photocopy" sign on documents

### Appropriate Use Case
- Perfect for demo/trial users evaluating the system
- They're not trying to bypass security, just testing functionality
- Sufficient for casual users, not technical attackers

### Future Enhancements
- If true security needed: server-side PDF generation with baked-in watermarks
- Current approach balances security with user experience

## Implementation Plan

### Phase 1: Database & API (5 minutes)
1. Create SQL migration for `subscription_status` column
2. Update API responses to include subscription status
3. Run migration on database

### Phase 2: Component Development (15 minutes)
1. Create `DemoWatermark.tsx` component
2. Add watermark CSS styles
3. Test component locally

### Phase 3: Integration (10 minutes)
1. Update `QuoteDetailPage` to use watermark wrapper
2. Update TypeScript types for Settings
3. Test end-to-end flow

### Phase 4: Build & Deploy (5 minutes)
1. `npm run build` to verify no errors
2. Push to GitHub
3. Test in production environment

**Total Estimated Time: 35 minutes**

## Testing Strategy

### Manual Testing Checklist
- [ ] Create demo/trial account, verify watermark appears
- [ ] Test print preview in browser (screenshot-proof)
- [ ] Test actual print/PDF output
- [ ] Test multi-page documents (watermark repeats)
- [ ] Test active/past_due accounts (no watermark)
- [ ] Test watermark cannot be scrolled away
- [ ] Test watermark survives pagination

### Edge Cases
- Missing `subscription_status` defaults to 'demo' (safe default)
- API failures fall back to showing watermark (secure by default)
- Print dialog cancellation doesn't break watermark state

### Browser Compatibility
- Test in Chrome, Firefox, Safari, Edge
- Modern browser print APIs
- Fallback for older browsers using `@media print`

## Error Handling

### Safe Defaults
```typescript
const shouldShowWatermark = 
  !subscriptionStatus || 
  ['demo', 'trial'].includes(subscriptionStatus);
```

- If subscription status is missing, show watermark (secure default)
- If API fails, assume demo mode (secure by default)

### API Failure Handling
- Gracefully degrade to showing watermark
- Log errors for debugging
- Don't break entire print flow if subscription status unavailable

## Future Enhancements

### Potential Additions
- Admin interface to manage subscription statuses
- Watermark customization per company branding
- Subscription expiry dates with automatic status changes
- Advanced DevTools detection and disabling
- Server-side PDF generation for true security

### Extensibility
- DemoWatermark component is reusable for any document type
- Can be extended to invoices, reports, certificates, etc.
- Centralized watermark logic for consistent styling

## Migration Strategy

### Database Migration
1. Run SQL migration to add `subscription_status` column
2. Existing companies default to 'demo' status
3. New signup flow defaults to 'demo' status
4. Admin can manually update via SQL until admin interface built

### Zero Downtime
- Migration uses DEFAULT value, no breaking changes
- API changes are additive (new field in response)
- Component changes are additive (new wrapper)
- Backward compatible with existing functionality

## Success Criteria

### Functional Success
- [ ] Watermark appears for demo/trial accounts on all documents
- [ ] Watermark appears in both preview and print output
- [ ] Active/past_due accounts see clean documents
- [ ] Watermark cannot be easily removed
- [ ] Multi-page documents show watermark on each page

### Technical Success
- [ ] Build passes without errors
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Manual testing confirms functionality
- [ ] Production deployment successful

## Conclusion

This design provides a practical solution for demo/trial document watermarking with:
- **Security-first defaults** (watermark shows if uncertain)
- **Reusable architecture** (works for any document type)
- **User experience focus** (unobtrusive but effective)
- **Future flexibility** (extensible for advanced features)

The approach balances security with usability, providing sufficient protection for demo users while maintaining clean documents for paying customers.