# Concetto Window Blinds — Invoicing App

A Next.js 14 app for managing window blinds quotes and supplier purchase orders.  
Stack: **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Neon (PostgreSQL) · Vercel**

---

## Features

- **Product database** — store blind codes, collections, supplier cost, and retail price per sq.ft.
- **Quote builder** — add windows by location, look up product codes instantly, enter measurements in inches or cm, toggle fixed vs. non-fixed (auto-adds 6in / 15cm overlap)
- **Auto-calculations** — final size, area in sq.ft., retail amount per panel, totals
- **Two print outputs** (8.5 × 11 inch, letter):
  - **Customer Quotation** — final size + retail pricing
  - **Supplier Purchase Order** — measured size + final size + supplier cost
- **Settings** — editable company info, terms, DEL note, closing note
- **UUID primary keys** throughout — safe for distributed use and future API expansion

---

## Local development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd concetto-blinds
npm install
```

### 2. Create a Neon database

1. Go to [https://neon.tech](https://neon.tech) and sign up (free tier is enough)
2. Create a new project — e.g. **concetto-blinds**
3. Copy the **Connection string** (looks like `postgres://user:pass@host/dbname?sslmode=require`)

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

### 4. Run database migrations

```bash
npm run db:migrate
```

This creates all tables (`settings`, `products`, `quotes`, `quote_items`) with UUID primary keys and seeds default settings.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/concetto-blinds.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [https://vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** — it will fail on first deploy because the env var isn't set yet, that's OK

### 3. Add environment variable in Vercel

1. Go to your project → **Settings → Environment Variables**
2. Add:
   - **Name:** `DATABASE_URL`
   - **Value:** your Neon connection string
   - **Environments:** Production, Preview, Development
3. Click **Save**

### 4. Redeploy

Go to **Deployments** → click the three dots on the latest deployment → **Redeploy**

### 5. Run migrations on the production database

You only need to do this once. From your local machine (with `.env.local` pointing to the same Neon DB):

```bash
npm run db:migrate
```

Or run it directly with the production URL:

```bash
DATABASE_URL="postgres://..." node src/lib/migrate.js
```

---

## Database schema

All tables use `gen_random_uuid()` (via the `pgcrypto` extension) for primary keys.

| Table | Description |
|---|---|
| `settings` | Single-row company info and document text |
| `products` | Blind product codes with supplier cost and retail price |
| `quotes` | Quote header — customer, date, totals, status |
| `quote_items` | Each window panel in a quote, with measured + final sizes, areas, amounts |

### Key relationships

```
quotes (id UUID PK)
  └── quote_items (quote_id UUID FK → quotes.id ON DELETE CASCADE)
        └── product_id UUID FK → products.id ON DELETE SET NULL
```

`ON DELETE CASCADE` on `quote_items` means deleting a quote also deletes all its items.  
`ON DELETE SET NULL` on `product_id` means deleting a product doesn't delete historical quote items — the product code and description are stored directly on the item row for this reason.

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── products/
│   │   │   ├── route.ts          # GET all, POST create/update
│   │   │   ├── [id]/route.ts     # GET one, DELETE (soft)
│   │   │   └── lookup/route.ts   # GET by code (for quote form)
│   │   ├── quotes/
│   │   │   ├── route.ts          # GET all, POST create
│   │   │   └── [id]/route.ts     # GET with items, PUT update, DELETE
│   │   └── settings/route.ts     # GET, PUT
│   ├── quotes/
│   │   ├── page.tsx              # Quotes list
│   │   ├── new/page.tsx          # New quote form
│   │   └── [id]/page.tsx         # Edit quote + print preview
│   ├── products/page.tsx         # Product management
│   ├── settings/page.tsx         # Settings
│   ├── layout.tsx
│   ├── page.tsx                  # Redirects to /quotes
│   └── globals.css
├── components/
│   ├── AppLayout.tsx             # Sidebar navigation shell
│   ├── QuoteForm.tsx             # Shared new/edit quote form
│   └── PrintDoc.tsx              # Printable quotation / PO layout
├── lib/
│   ├── db.ts                     # Neon SQL client
│   ├── calc.ts                   # Shared calculation helpers
│   └── migrate.js                # One-time DB migration script
└── types/
    └── index.ts                  # Shared TypeScript types
```

---

## Calculation logic

| Scenario | Width | Drop |
|---|---|---|
| Fixed = Yes | as entered | as entered |
| Fixed = No (inches) | + 6 in | + 6 in |
| Fixed = No (cm) | + 15 cm | + 15 cm |

Area (sq.ft.) = `(final_width_in × final_drop_in) / 144`

All measurements entered in cm are converted to inches before the area calculation.

---

## Printing

Navigate to `/quotes/[id]?print=quotation` or `/quotes/[id]?print=po` to open the print preview page, then use the browser's print dialog (Ctrl+P / Cmd+P). The layout is set to **letter (8.5 × 11 in)** via `@page` CSS.

---

## Adding new blind types in the future

Currently the app is built for **roller blinds**. The `products` table is generic enough to support other types. When ready, add a `type` column to `products`:

```sql
ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'roller';
```

Then filter by type in the quote form as needed.
