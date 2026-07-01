# Dashboard Implementation Documentation

## Overview
Enterprise dashboard with 9 key metrics for Concetto Window Blinds SaaS platform.

## Features Implemented

### 1. Top Metrics (4 cards)
- **Monthly/Yearly Sales** - Toggleable revenue display
- **Profit** - With profit margin percentage
- **Conversion Rate** - Quotes approved vs total
- **Average Order Value** - Mean transaction size

### 2. Visualizations
- **TrendChart** - 6-month revenue trend using Recharts
- **PopularCollections** - Top 10 collections by revenue
- **TopCustomersTable** - Top 10 customers by revenue

### 3. Security Features
- **PII Encryption** - Customer names/addresses encrypted at rest
- **Per-company vaults** - UUID-based isolation
- **Session-based auth** - Lightweight token transfer

### 4. UX Features
- **Month/Year toggle** - Date range filtering
- **EncryptionModal** - Loading state during data fetch
- **Error states** - Graceful failure handling
- **Empty states** - No data messaging

## Architecture

### Components
```
src/app/dashboard/page.tsx          # Main dashboard page
src/components/dashboard/
  ├── MetricCard.tsx                # Individual metric cards
  ├── TrendChart.tsx                # Revenue trend visualization
  ├── TopCustomersTable.tsx         # Customer rankings
  └── PopularCollections.tsx        # Collection rankings
src/components/EncryptionModal.tsx  # Loading overlay
```

### API Endpoint
```
src/app/api/dashboard/route.ts      # Metrics aggregation
```

### Database Migrations
```
migrate-pii-encryption.sql          # Add encrypted PII columns
migrate-dashboard-costs.sql          # Add cost breakdown fields
```

## Data Flow

1. **User visits /dashboard**
2. **Dashboard page checks session**
3. **Fetches /api/dashboard?period=month|year**
4. **API validates company vault access**
5. **Aggregates metrics per company**
6. **Decrypts PII for display**
7. **Renders 9 metrics across 7 components**

## Metrics Calculation

### Sales Metrics
- `monthlySales` - SUM(quote_totals) WHERE month = current
- `yearlySales` - SUM(quote_totals) WHERE year = current

### Profit Metrics
- `profit` - (retail_price - supplier_cost) across all items
- `profitMargin` - profit / revenue ratio

### Conversion Metrics
- `conversionRate` - approved_quotes / total_quotes
- `totalQuotes` - COUNT(quotes)
- `approvedQuotes` - COUNT(quotes WHERE status = 'approved')

### Order Metrics
- `averageOrderValue` - revenue / COUNT(quotes)

### Trend Data
- `revenueTrends` - Last 6 months revenue grouped by month

### Rankings
- `popularCollections` - GROUP BY collection, ORDER BY revenue DESC LIMIT 10
- `topCustomers` - GROUP BY customer, ORDER BY revenue DESC LIMIT 10

## Security Considerations

### PII Encryption
- Customer names encrypted in `customer_name_encrypted` (bytea)
- Customer addresses encrypted in `customer_address_encrypted` (bytea)
- Encryption key stored in env var: `ENCRYPTION_KEY`
- Decryption only happens in-memory for display

### Per-Company Isolation
- All queries scoped to `company_id` from session
- UUID-based company identifiers prevent enumeration
- CASCADE deletes maintain referential integrity

## Performance Optimizations

### Database
- Indexed on: `company_id`, `created_at`, `collection`, `customer_name`
- Materialized aggregations for trends
- LIMIT 10 on rankings to prevent large result sets

### Frontend
- Recharts lazy-loads visualization data
- Metric cards use `useMemo` for formatting
- EncryptionModal prevents redundant clicks during fetch

## Testing Manual Checklist

### Authentication
- [ ] Redirects to /login when not authenticated
- [ ] Redirects to /dashboard after login
- [ ] Shows other company's data? (should fail)

### Metrics
- [ ] All 4 top cards display values
- [ ] Month toggle changes sales value
- [ ] Year toggle changes sales value
- [ ] Profit margin shows as percentage
- [ ] Conversion rate shows as percentage
- [ ] Avg order value formatted as currency

### Visualizations
- [ ] Trend chart shows 6 data points
- [ ] Collections table shows 10 rows max
- [ ] Customers table shows 10 rows max
- [ ] Trend chart has labels (months)
- [ ] Tables have currency formatting

### Error States
- [ ] Loading state shows EncryptionModal
- [ ] API error shows red message
- [ ] Empty data shows gray message

### Responsive
- [ ] 4-column grid on desktop (1280px+)
- [ ] 2-column grid on tablet (768px-1279px)
- [ ] 1-column grid on mobile (<768px)

## Configuration

### Environment Variables
```bash
ENCRYPTION_KEY=<32-byte hex string>  # For PII encryption
DATABASE_URL=<Neon connection string>
SESSION_SECRET=<random secret>
```

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment Notes

1. Run database migrations in Neon SQL Editor:
   - `migrate-pii-encryption.sql`
   - `migrate-dashboard-costs.sql`

2. Set environment variables in production

3. Restart Next.js server

4. Test with real quote data to verify aggregations

## Troubleshooting

### Dashboard shows "No data available"
- Check if quotes exist for the company
- Verify session has valid company_id
- Check API logs for aggregation errors

### Trend chart shows no lines
- Ensure quotes span 6+ months
- Check created_at indexing
- Verify date filtering logic

### Tables show fewer than 10 rows
- Normal if fewer than 10 customers/collections
- Check for duplicate customer names
- Verify NULL handling in aggregations

### PII shows as encrypted bytes
- Verify ENCRYPTION_KEY matches migration time
- Check decryption functions in crypto.ts
- Ensure bytea columns populated

## Future Enhancements

- [ ] Real-time updates via WebSocket
- [ ] Export metrics as CSV/PDF
- [ ] Custom date range picker
- [ ] Metric comparison (period-over-period)
- [ ] Drill-down to quote details from tables
- [ ] Caching layer for aggregations
- [ ] A/B testing for quote pricing

## Credits
Implemented: 2026-07-01
Tech Stack: Next.js 15, TypeScript, Recharts, Neon PostgreSQL, pgcrypto
