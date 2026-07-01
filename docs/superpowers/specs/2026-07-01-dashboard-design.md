# Dashboard Design Spec

**Date:** 2026-07-01
**Status:** Approved
**Author:** AI + User Collaborative Design

## Overview

Create a business dashboard as the default landing page for authenticated users. Dashboard displays key business metrics with flexible date range filtering, configurable cost tracking per company, and immediate PII encryption for GDPR compliance.

**Goals:**
- Replace `/quotes` as default post-login redirect
- Show real-time business metrics at a glance
- Support flexible date range reporting (current month, current year, custom)
- Enable configurable cost categories per tenant for multi-tenant SaaS flexibility
- Scale efficiently with real-time on-demand calculations
- Encrypt all PII data immediately for privacy compliance

**Privacy & Security:**
- Customer names, addresses encrypted at rest (AES-256-GCM)
- User emails encrypted at rest
- GDPR, UK GDPR, US state privacy law compliance
- Dual-write strategy with plaintext backup during verification

---

## Architecture

### Approach
**Real-time calculation + Simple JSON settings** (Approach 1 from alternatives)

Metrics calculated on-demand from raw `quotes` and `quote_items` data. Cost categories stored as JSON in `company` table. Single-page dashboard with all metrics visible.

**Rationale:**
- Fastest to build, cleanest architecture
- Always shows real-time data (critical for business decisions)
- Easy to add new metrics iteratively
- No maintenance burden for summary tables
- Scales adequately to <10K quotes per company
- Migration path to cached summaries available when needed

### Tech Stack
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Charts:** Recharts (lightweight, React-native charting)
- **Backend:** Next.js API routes (server-side queries)
- **Database:** PostgreSQL (Neon)

---

## Database Schema Changes

### 1. PII Encryption (Active)

**Add encrypted columns alongside existing PII fields:**

```sql
-- Quotes table - customer PII
ALTER TABLE quotes
ADD COLUMN customer_name_encrypted bytea,
ADD COLUMN customer_address_encrypted bytea;

-- Users table - user PII
ALTER TABLE users
ADD COLUMN email_encrypted bytea,
ADD COLUMN name_encrypted bytea;

-- Encrypt existing data immediately
UPDATE quotes
SET customer_name_encrypted = pgp_sym_encrypt(customer_name, $encryption_key),
    customer_address_encrypted = pgp_sym_encrypt(customer_address, $encryption_key)
WHERE customer_name_encrypted IS NULL;

UPDATE users
SET email_encrypted = pgp_sym_encrypt(email, $encryption_key),
    name_encrypted = pgp_sym_encrypt(name, $encryption_key)
WHERE email_encrypted IS NULL;
```

**Purpose:**
- GDPR, UK GDPR, US state privacy law compliance
- Protect customer PII at rest
- Data breach protection

**Implementation:**
- App writes to BOTH encrypted and plaintext columns (dual-write for safety)
- App reads from encrypted columns (decrypts on read)
- Plaintext columns kept as backup during verification period (1-2 weeks)
- After verification, plaintext columns can be dropped

### 2. Extend `company` table
```sql
ALTER TABLE company
ADD COLUMN cost_categories JSONB DEFAULT '["materials", "labor", "overhead", "shipping"]';
```

**Purpose:** Each company defines their own cost breakdown categories.

**Example values:**
- Installer: `["materials", "labor", "transport", "overhead"]`
- Supplier: `["manufacturing", "shipping", "insurance"]`
- Simple: `["cost"]`

### 3. Extend `quote_items` table
```sql
ALTER TABLE quote_items
ADD COLUMN cost_breakdown JSONB DEFAULT '{}';
```

**Purpose:** Store flexible cost breakdown per line item.

**Example:**
```json
{
  "materials": 150.00,
  "labor": 75.00,
  "overhead": 25.00
}
```

### Migration Files
Create `migrate-pii-encryption.sql` and `migrate-dashboard-costs.sql` with the statements above.

---

## PII Encryption Implementation

### Active Encryption Strategy

**Goal:** Encrypt all PII data immediately upon deployment.

**Strategy:** Dual-write + encrypted-read pattern with plaintext backup during verification.

### Encryption Helper Functions

Create `src/lib/crypto.ts`:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encrypt sensitive PII data
 * @param plaintext - Data to encrypt
 * @param keyHex - Encryption key from environment (64 hex chars)
 * @returns Encrypted data as Buffer (salt + iv + tag + ciphertext)
 */
export function encryptPII(plaintext: string, keyHex?: string): Buffer {
  const key = keyHex || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not configured');

  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const keyBuffer = Buffer.from(key, 'hex');

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, ciphertext]);
}

/**
 * Decrypt sensitive PII data
 * @param encrypted - Buffer containing salt + iv + tag + ciphertext
 * @param keyHex - Encryption key from environment
 * @returns Decrypted plaintext
 */
export function decryptPII(encrypted: Buffer, keyHex?: string): string {
  const key = keyHex || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not configured');

  const keyBuffer = Buffer.from(key, 'hex');

  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = encrypted.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const ciphertext = encrypted.subarray(ENCRYPTED_POSITION);

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### Environment Variables

Add to `.env` (generate once, never rotate):

```bash
# Generate with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-character-hex-string>
```

**Never commit this key to git.** Add to `.gitignore` and provide to operations team.

### Deployment Strategy (One-Shot)

**Step 1: Deploy with encryption active**

**Database migration runs:**
1. Add encrypted columns
2. Encrypt all existing PII data (UPDATE statements run immediately)
3. All data now encrypted

**App deployment:**
- API reads decrypt PII on all responses
- API writes encrypt PII on all creates/updates
- Dual-write to plaintext columns (backup during verification)

**Example API read:**
```typescript
// GET /api/quotes
return quotes.map(q => ({
  ...q,
  customer_name: decryptPII(q.customer_name_encrypted),
  customer_address: decryptPII(q.customer_address_encrypted),
  // Plaintext columns ignored
}));
```

**Example API write:**
```typescript
// POST /api/quotes
await db.quotes.create({
  customer_name_encrypted: encryptPII(data.customer_name),
  customer_address_encrypted: encryptPII(data.customer_address),
  // Also write to plaintext as backup
  customer_name: data.customer_name,
  customer_address: data.customer_address,
  // ... rest of quote data
});
```

### Verification Phase (1-2 Weeks Post-Deployment)

**Monitor:**
- [ ] No decryption errors in logs
- [ ] All customer data displays correctly
- [ ] Performance impact <100ms per request
- [ ] No data corruption

**Manual verification:**
- [ ] Open existing quotes - customer names visible
- [ ] Create new quote - customer names saved and visible
- [ ] Edit quote - customer names update correctly
- [ ] User login - email works correctly

### Optional: Remove Plaintext Backup (After Verification)

**After 1-2 weeks of stable operation:**

```sql
-- Drop plaintext columns
ALTER TABLE quotes DROP COLUMN customer_name;
ALTER TABLE quotes DROP COLUMN customer_address;
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users DROP COLUMN name;

-- Remove dual-write code from API
```

**This is optional** - keeping plaintext backup is fine if you prefer safety over minimal storage overhead.

---

## Encryption Key Management

### Key Generation

**Generate once, never rotate (unless doing full data re-encryption):**

```bash
# Node.js one-liner to generate key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:** `a1b2c3d4e5f6...64-char-hex-string`

### Environment Configuration

**Add to `.env` (NEVER commit to git):**
```bash
ENCRYPTION_KEY=<your-64-char-hex-key>
```

**Add to `.gitignore`:**
```
.env
.env.local
.env.production
```

### Key Backup Procedures

**CRITICAL:** If encryption key is lost, encrypted data is permanently unrecoverable.

**Backup process:**
1. Store key in secure password manager (1Password, LastPass, etc.)
2. Store key in secure cloud storage with access controls (AWS Secrets Manager, Azure Key Vault)
3. Document key location in ops wiki (access restricted)
4. Never share key via email, Slack, or plain text

**Key rotation (future):**
- Generate new key
- Re-encrypt all data with new key
- Update environment
- Keep old key until re-encryption verified complete

### Security Considerations

**Threat model:** Protects against database breach, not application compromise.

**What encryption protects:**
- ✅ Database backup theft
- ✅ Database access via SQL injection
- ✅ Unauthorized database admin access
- ✅ Physical server theft (database files)

**What encryption does NOT protect:**
- ❌ Application-level attacks (if attacker can read process memory)
- ❌ Logs that capture decrypted PII (ensure logs filter PII)
- ❌ HTTPS man-in-the-middle (use TLS, separate concern)

**Defense in depth:**
1. Encryption at rest (this implementation)
2. HTTPS in transit (already configured)
3. Session-based authentication (already implemented)
4. Company-id isolation (already implemented)
5. Input validation (already implemented)

---

## Dashboard Layout

### Page Structure
```
┌─────────────────────────────────────────────────────────┐
│  📊 Concetto                                [🔒][🚪]    │
│  ─────────────────────────────────────────────────────  │
│  📊 Dashboard  |  📄 Quotes  |  ➕ New  |  🏷️ Products │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [◉ Current Month  ○ Current Year  ○ Custom Range]     │
│  [Jan 2025 - Jun 2025]                                │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │$12.5K│ │$45.2K│ │ 32%  │ │ $8.3K│                  │
│  │Sales │ │Sales │ │Conv. │ │Profit│                  │
│  └──────┘ └──────┘ └──────┘ └──────┘                  │
│                                                          │
│  ┌───────────────────────┐ ┌───────────────────────┐  │
│  │   Revenue Trends      │ │ Popular Collections   │  │
│  │   [Line Chart]        │ │ 1. Zebra (45 quotes)  │  │
│  │                       │ │ 2. Wood blinds (32)   │  │
│  │                       │ │ 3. Aluminum (28)      │  │
│  └───────────────────────┘ └───────────────────────┘  │
│                                                          │
│  ┌───────────────────────┐ ┌───────────────────────┐  │
│  │   Top Customers       │ │  Quote Stats          │  │
│  │  1. ABC Corp - $8.5K  │ │  Total Quotes: 124    │  │
│  │  2. XYZ Ltd - $6.2K   │ │  Approved: 45 (36%)    │  │
│  │  3. Acme Inc - $4.8K  │ │  Pending: 79          │  │
│  └───────────────────────┘ └───────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │   Average Order Value: $562.50                   │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Card Layout (Responsive)
- **Desktop:** 4 columns for top metrics, 2 columns for charts/tables
- **Tablet:** 2 columns
- **Mobile:** 1 column stacked

### Color Scheme
- Sales cards: Blue tones (`bg-blue-500`, `bg-blue-600`)
- Profit/capital: Green tones (`bg-green-500`)
- Conversion rate: Purple tones (`bg-purple-500`)
- Charts: Blue line with gradient fill
- Tables: Standard gray borders with hover states

---

## API Endpoints

### GET `/api/dashboard`

**Query Parameters:**
- `startDate` (optional): ISO date string, defaults to start of current month
- `endDate` (optional): ISO date string, defaults to now
- `period` (optional): `"month"` | `"year"` | `"custom"`, defaults to `"month"`

**Request:**
```http
GET /api/dashboard?period=month
```

**Response:**
```json
{
  "monthlySales": 12500.00,
  "yearlySales": 45200.00,
  "profit": 8300.00,
  "profitMargin": 0.66,
  "conversionRate": 0.32,
  "totalQuotes": 124,
  "approvedQuotes": 45,
  "pendingQuotes": 79,
  "averageOrderValue": 562.50,
  "revenueTrends": [
    { "month": "Jan", "revenue": 8500 },
    { "month": "Feb", "revenue": 9200 },
    { "month": "Mar", "revenue": 10100 },
    { "month": "Apr", "revenue": 7800 },
    { "month": "May", "revenue": 11200 },
    { "month": "Jun", "revenue": 12500 }
  ],
  "popularCollections": [
    { "collection": "Zebra", "count": 45, "revenue": 25000 },
    { "collection": "Wood blinds", "count": 32, "revenue": 18000 },
    { "collection": "Aluminum", "count": 28, "revenue": 12000 }
  ],
  "topCustomers": [
    { "customerName": "ABC Corp", "totalRevenue": 8500.00, "quoteCount": 3 },
    { "customerName": "XYZ Ltd", "totalRevenue": 6200.00, "quoteCount": 2 },
    { "customerName": "Acme Inc", "totalRevenue": 4800.00, "quoteCount": 4 }
  ]
}
```

**Authentication:** Requires valid session cookie with `companyId`

**Error Responses:**
- `401`: No session or invalid session
- `500`: Database error

---

## Metric Calculations

All calculations filter by:
- `company_id` (from session)
- `quote_date` within date range
- Only `status IN ('approved', 'sent')` for sales metrics (exclude draft/cancelled)

### 1. Monthly Sales
```sql
SELECT COALESCE(SUM(total), 0) as monthly_sales
FROM quotes
WHERE company_id = $1
  AND status IN ('approved', 'sent')
  AND quote_date >= date_trunc('month', CURRENT_DATE)
  AND quote_date <= CURRENT_DATE
```

### 2. Yearly Sales
```sql
SELECT COALESCE(SUM(total), 0) as yearly_sales
FROM quotes
WHERE company_id = $1
  AND status IN ('approved', 'sent')
  AND quote_date >= date_trunc('year', CURRENT_DATE)
  AND quote_date <= CURRENT_DATE
```

### 3. Profit vs Capital (Supplier Cost)
```sql
SELECT
  COALESCE(SUM(qi.retail_amount), 0) as revenue,
  COALESCE(SUM(qi.supplier_amount), 0) as cost,
  COALESCE(SUM(qi.retail_amount - qi.supplier_amount), 0) as profit
FROM quote_items qi
JOIN quotes q ON qi.quote_id = q.id
WHERE q.company_id = $1
  AND q.status IN ('approved', 'sent')
  AND q.quote_date >= $2
  AND q.quote_date <= $3
```

### 4. Conversion Rate
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'approved')::FLOAT / NULLIF(COUNT(*), 0) as conversion_rate
FROM quotes
WHERE company_id = $1
  AND quote_date >= $2
  AND quote_date <= $3
```

### 5. Average Order Value
```sql
SELECT AVG(total) as average_order_value
FROM quotes
WHERE company_id = $1
  AND status IN ('approved', 'sent')
  AND quote_date >= $2
  AND quote_date <= $3
```

### 6. Revenue Trends (Last 6 Months)
```sql
SELECT
  TO_CHAR(quote_date, 'Mon') as month,
  EXTRACT(MONTH FROM quote_date) as month_num,
  SUM(total) as revenue
FROM quotes
WHERE company_id = $1
  AND status IN ('approved', 'sent')
  AND quote_date >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
GROUP BY month, month_num
ORDER BY month_num
```

### 7. Popular Collections
```sql
SELECT
  product_collection,
  COUNT(*) as count,
  SUM(qi.retail_amount) as revenue
FROM quote_items qi
JOIN quotes q ON qi.quote_id = q.id
WHERE q.company_id = $1
  AND q.status IN ('approved', 'sent')
  AND q.quote_date >= $2
  AND q.quote_date <= $3
GROUP BY product_collection
ORDER BY count DESC
LIMIT 10
```

### 8. Top Customers
```sql
SELECT
  customer_name,
  SUM(total) as total_revenue,
  COUNT(*) as quote_count
FROM quotes
WHERE company_id = $1
  AND status IN ('approved', 'sent')
  AND quote_date >= $2
  AND quote_date <= $3
GROUP BY customer_name
ORDER BY total_revenue DESC
LIMIT 10
```

---

## Components

### File Structure
```
src/
├── app/
│   ├── dashboard/
│   │   └── page.tsx                    # Main dashboard page
│   ├── api/
│   │   └── dashboard/
│   │       └── route.ts                # Dashboard metrics API
├── components/
│   ├── dashboard/
│   │   ├── MetricCard.tsx             # Reusable metric card
│   │   ├── TrendChart.tsx             # Revenue trend line chart
│   │   ├── TopCustomersTable.tsx      # Top customers list
│   │   └── PopularCollections.tsx     # Popular collections list
│   └── AppLayout.tsx                  # Update: Add Dashboard nav item
├── lib/
│   ├── auth.ts                         # No changes needed
│   └── crypto.ts                       # NEW - PII encryption helpers
└── types/
    └── index.ts                        # Add DashboardMetrics type
```

### Component Descriptions

#### MetricCard.tsx
**Props:**
- `title`: string (e.g., "Monthly Sales")
- `value`: string (formatted currency or number)
- `subtitle`: string (optional context)
- `icon`: string (emoji)
- `color`: "blue" | "green" | "purple" | "orange"

**Behavior:**
- Displays card with icon, value, title
- Hover effect (slight lift, shadow increase)
- Responsive width

#### TrendChart.tsx
**Props:**
- `data`: Array<{month: string, revenue: number}>

**Behavior:**
- Line chart with X-axis: months, Y-axis: revenue
- Blue line with gradient fill under curve
- Responsive to container width
- Tooltip on hover showing exact values

#### TopCustomersTable.tsx
**Props:**
- `customers`: Array<{customerName: string, totalRevenue: number, quoteCount: number}>

**Behavior:**
- Table with 3 columns: Customer, Revenue, Quote Count
- Sorted by revenue descending
- Revenue formatted as currency
- Hover row highlight

#### PopularCollections.tsx
**Props:**
- `collections`: Array<{collection: string, count: number, revenue: number}>

**Behavior:**
- List with collection name, quote count, revenue
- Sorted by count descending
- Revenue formatted as currency

---

## Navigation & Routing Changes

### 1. AppLayout.tsx
```typescript
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },  // NEW - first item
  { href: '/quotes', label: 'Quotes', icon: '📄' },
  // ... rest unchanged
];
```

### 2. login/page.tsx
```typescript
// Line 60: Change redirect
- router.push('/quotes');
+ router.push('/dashboard');
```

### 3. Create `/dashboard` route
New page becomes default authenticated landing view.

---

## Cost Categories Configuration (Future Enhancement)

**Phase 2 Scope:** This design supports configurable cost categories but UI implementation is deferred.

**Data Structure (already in schema):**
- `company.cost_categories`: Array of category names
- `quote_items.cost_breakdown`: Object with category values

**Future UI Needs:**
- Settings page to add/edit/delete cost categories per company
- Quote item form with dynamic cost input fields based on company config
- Validation to ensure cost_breakdown keys match company categories

**For Now:** Use default `["materials", "labor", "overhead", "shipping"]` and manually populated cost_breakdown.

---

## Error Handling

### Frontend
- Loading state while fetching metrics
- Error state if API fails (retry button)
- Empty state if no quotes in date range (friendly message)
- Fallback to 0 for null/undefined metric values

### Backend
- Validate session before processing (401 if invalid)
- Validate date ranges (400 if malformed)
- Wrap SQL queries in try/catch (500 if DB error)
- Use parameterized queries to prevent SQL injection

### User Experience
- Never show raw errors to users
- Show friendly message: "Unable to load dashboard. Please try again."
- Log server-side errors for debugging

---

## Testing Strategy

### Unit Tests (Later)
- Metric calculation logic
- Date range filtering logic
- Cost breakdown validation

### Integration Tests
- API endpoint returns correct data for test company
- Metrics match expected values for known quote data
- Different date ranges return correct filtered results

### Manual Testing Checklist
- [ ] Dashboard loads without errors
- [ ] All cards display with data
- [ ] Date range toggle (month/year/custom) works
- [ ] Charts render correctly
- [ ] Tables populate with data
- [ ] No data state shows friendly message
- [ ] Navigation menu shows Dashboard as first item
- [ ] Login redirects to Dashboard, not Quotes
- [ ] Session isolation works (can't see other companies' data)

### Performance Testing
- Dashboard loads in <500ms with 1000 quotes
- Charts render smoothly
- No memory leaks on date range changes

---

## Implementation Order

1. **PII encryption setup**
   - Generate ENCRYPTION_KEY (64 hex chars), add to environment
   - Create `crypto.ts` helper functions
   - Document key management procedures (backup, rotation)

2. **Database migration** (all-in-one transaction)
   - Add encrypted columns to quotes, users tables
   - Encrypt all existing PII data immediately
   - Add cost_categories, cost_breakdown columns

3. **API updates** (quotes, users, auth endpoints)
   - Update reads to decrypt encrypted columns
   - Update writes to encrypt PII + dual-write to plaintext
   - Test all endpoints return correct data

4. **Dashboard API endpoint** (`/api/dashboard` with all metric queries)

5. **Dashboard page** (layout, date range state)

6. **Metric cards** (4 top metrics)

7. **Chart component** (revenue trends)

8. **Table components** (top customers, popular collections)

9. **Navigation updates** (AppLayout, login redirect)

10. **Styling polish** (responsive, colors, hover states)

11. **Testing** (manual smoke test + PII encryption verification)
   - Verify all customer data decrypts correctly
   - Check performance impact (<100ms overhead)
   - Test create/read/update flows

12. **Monitoring** (1-2 weeks)
   - Watch for decryption errors
   - Verify data integrity
   - (Optional) Remove plaintext columns after verification

---

## Future Considerations

### Scalability
When reaching 10K+ quotes per company, consider:
- Materialized views for pre-calculated metrics
- Redis caching for dashboard data (5-minute TTL)
- Separate analytics database (read replica)

### Additional Metrics (Easy to Add)
- Installations scheduled vs completed
- Pending follow-ups (quotes sent but not approved)
- Top products (not just collections)
- Sales by installer/employee

### Cost Category Management UI
- Settings page to manage cost categories
- Validation UI on quote item forms
- Import/export cost category templates

### Export & Sharing
- Export dashboard as PDF
- Share dashboard link (read-only, time-limited)
- Email weekly summary reports

---

## Success Criteria

**Dashboard:**
- [ ] Dashboard accessible at `/dashboard`
- [ ] All 9 metrics display correctly
- [ ] Date range filtering works (month/year/custom)
- [ ] Charts render with last 6 months data
- [ ] Tables show top 10 customers and collections
- [ ] Login redirects to dashboard by default
- [ ] Data isolated by company (multi-tenant security)
- [ ] Page loads in <1 second
- [ ] Works on mobile, tablet, desktop

**PII Encryption (Active):**
- [ ] ENCRYPTION_KEY generated and secured (never committed to git)
- [ ] `crypto.ts` helper functions created and tested
- [ ] Encrypted columns added to database
- [ ] All existing PII data encrypted during migration
- [ ] API reads decrypt PII correctly (customer names, addresses, emails visible)
- [ ] API writes encrypt PII correctly (new data encrypted)
- [ ] Dual-write to plaintext columns working (backup during verification)
- [ ] No data loss or corruption
- [ ] Decryption performance <100ms overhead
- [ ] Documentation complete (key management, backup procedures)

---

**End of Design Spec**
