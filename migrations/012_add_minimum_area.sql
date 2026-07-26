-- 012: Per-company minimum billable area + per-item minimum-applied flag.
-- Companies get a default of 15 sq.ft.; existing rows back-filled automatically.
BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS minimum_area_sqft numeric NOT NULL DEFAULT 15;

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS minimum_applied boolean NOT NULL DEFAULT false;

COMMIT;
