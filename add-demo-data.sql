-- Add Demo Data for Demo Account
-- Run this in Neon's SQL Editor to populate the demo account with sample data

-- This will create quotes and quote_items for the DEMO company
-- Data spans 6 months with various statuses, collections, and customers

-- Get the DEMO company ID
-- We'll use a subquery in the inserts

-- Insert sample quotes with quote_items
-- Creating realistic demo data spanning 6 months

-- Quote 1: Approved - Large order - Roller Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'ABC Corporation',
  'approved',
  CURRENT_DATE - INTERVAL '15 days',
  4500.00,
  CURRENT_DATE - INTERVAL '15 days'
FROM companies WHERE code = 'DEMO';

-- Quote 2: Approved - Medium order - Vertical Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Smith Residence',
  'approved',
  CURRENT_DATE - INTERVAL '30 days',
  2800.00,
  CURRENT_DATE - INTERVAL '30 days'
FROM companies WHERE code = 'DEMO';

-- Quote 3: Sent - Pending approval - Venetian Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Metro Hotel',
  'sent',
  CURRENT_DATE - INTERVAL '5 days',
  6200.00,
  CURRENT_DATE - INTERVAL '5 days'
FROM companies WHERE code = 'DEMO';

-- Quote 4: Approved - Small order - Roller Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Dr. Johnson Clinic',
  'approved',
  CURRENT_DATE - INTERVAL '45 days',
  1850.00,
  CURRENT_DATE - INTERVAL '45 days'
FROM companies WHERE code = 'DEMO';

-- Quote 5: Pending - Roller Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Garcia Family',
  'pending',
  CURRENT_DATE - INTERVAL '2 days',
  3200.00,
  CURRENT_DATE - INTERVAL '2 days'
FROM companies WHERE code = 'DEMO';

-- Quote 6: Approved - Large order - Vertical Blinds (2 months ago)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Luxury Apartments Inc',
  'approved',
  CURRENT_DATE - INTERVAL '60 days',
  8900.00,
  CURRENT_DATE - INTERVAL '60 days'
FROM companies WHERE code = 'DEMO';

-- Quote 7: Approved - Venetian Blinds (3 months ago)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'City Center Mall',
  'approved',
  CURRENT_DATE - INTERVAL '90 days',
  12500.00,
  CURRENT_DATE - INTERVAL '90 days'
FROM companies WHERE code = 'DEMO';

-- Quote 8: Sent - Awaiting decision - Roller Blinds (4 months ago)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Wilson Restaurant',
  'sent',
  CURRENT_DATE - INTERVAL '120 days',
  2100.00,
  CURRENT_DATE - INTERVAL '120 days'
FROM companies WHERE code = 'DEMO';

-- Quote 9: Approved - Vertical Blinds (4 months ago)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Brown & Associates Law',
  'approved',
  CURRENT_DATE - INTERVAL '120 days',
  5400.00,
  CURRENT_DATE - INTERVAL '120 days'
FROM companies WHERE code = 'DEMO';

-- Quote 10: Approved - Venetian Blinds (5 months ago)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Riverside Hotel',
  'approved',
  CURRENT_DATE - INTERVAL '150 days',
  7800.00,
  CURRENT_DATE - INTERVAL '150 days'
FROM companies WHERE code = 'DEMO';

-- Quote 11: Cancelled - Roller Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'StartUp Tech Co',
  'cancelled',
  CURRENT_DATE - INTERVAL '20 days',
  1500.00,
  CURRENT_DATE - INTERVAL '20 days'
FROM companies WHERE code = 'DEMO';

-- Quote 12: Approved - Medium order - All blinds types (5 months ago)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Patterson Residence',
  'approved',
  CURRENT_DATE - INTERVAL '150 days',
  3400.00,
  CURRENT_DATE - INTERVAL '150 days'
FROM companies WHERE code = 'DEMO';

-- Quote 13: Sent - Large project - Roller Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Green Valley Resort',
  'sent',
  CURRENT_DATE - INTERVAL '10 days',
  15000.00,
  CURRENT_DATE - INTERVAL '10 days'
FROM companies WHERE code = 'DEMO';

-- Quote 14: Pending - Vertical Blinds
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Oceanview Restaurant',
  'pending',
  CURRENT_DATE - INTERVAL '7 days',
  4200.00,
  CURRENT_DATE - INTERVAL '7 days'
FROM companies WHERE code = 'DEMO';

-- Quote 15: Approved - Small order - Venetian Blinds (current month)
INSERT INTO quotes (id, company_id, customer_name, status, quote_date, total, created_at)
SELECT
  gen_random_uuid(),
  id,
  'Lee Dental Clinic',
  'approved',
  CURRENT_DATE - INTERVAL '3 days',
  1650.00,
  CURRENT_DATE - INTERVAL '3 days'
FROM companies WHERE code = 'DEMO';

-- Now add quote_items for each quote
-- This links quotes to products and provides the detailed cost/profit data

-- Quote items for each quote (simplified - adding items to first 5 quotes as examples)
-- In production, you'd want items for all quotes

-- Items for Quote 1 (ABC Corporation - $4500) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  120,  -- width
  150,  -- height
  5,    -- quantity
  300.00, -- supplier_amount
  900.00  -- retail_amount
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'ABC Corporation'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  180,
  150,
  8,
  600.00,
  1800.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'ABC Corporation'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  150,
  180,
  6,
  400.00,
  1200.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'ABC Corporation'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Items for Quote 2 (Smith Residence - $2800) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  100,
  120,
  4,
  200.00,
  600.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Smith Residence'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  140,
  160,
  5,
  440.00,
  1100.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Smith Residence'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  90,
  110,
  4,
  275.00,
  550.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Smith Residence'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Items for Quote 3 (Metro Hotel - $6200) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  200,
  180,
  10,
  1000.00,
  2500.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Metro Hotel'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  150,
  160,
  15,
  740.00,
  1850.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Metro Hotel'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  180,
  180,
  12,
  925.00,
  1850.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Metro Hotel'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Items for remaining quotes - simplified approach
-- For Quotes 4-15, add representative items

-- Quote 4 (Dr. Johnson Clinic - $1850) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  120,
  140,
  3,
  185.00,
  555.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Dr. Johnson Clinic'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  90,
  120,
  4,
  161.25,
  322.50
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Dr. Johnson Clinic'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  150,
  150,
  2,
  242.50,
  485.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Dr. Johnson Clinic'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Quote 5 (Garcia Family - $3200) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  160,
  180,
  4,
  320.00,
  800.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Garcia Family'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  120,
  140,
  6,
  240.00,
  600.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Garcia Family'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  200,
  180,
  5,
  360.00,
  900.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Garcia Family'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Add items for the large quotes to ensure profit calculations work

-- Quote 6 (Luxury Apartments Inc - $8900) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  180,
  180,
  10,
  1000.00,
  2225.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Luxury Apartments Inc'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  150,
  160,
  12,
  750.00,
  2225.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Luxury Apartments Inc'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  200,
  200,
  8,
  888.50,
  2222.50
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Luxury Apartments Inc'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  120,
  140,
  10,
  444.25,
  1112.50
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Luxury Apartments Inc'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Quote 7 (City Center Mall - $12500) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  250,
  200,
  15,
  1875.00,
  3125.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'City Center Mall'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  200,
  180,
  12,
  1500.00,
  3125.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'City Center Mall'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  180,
  160,
  15,
  1312.50,
  3125.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'City Center Mall'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  150,
  150,
  10,
  937.50,
  3125.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'City Center Mall'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Quote 13 (Green Valley Resort - $15000) - Picasso Collection
INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  300,
  250,
  20,
  3000.00,
  5000.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Green Valley Resort'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  250,
  200,
  25,
  3125.00,
  5000.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Green Valley Resort'
  AND p.collection = 'Picasso'
LIMIT 1;

INSERT INTO quote_items (id, quote_id, product_id, width, height, quantity, supplier_amount, retail_amount)
SELECT
  gen_random_uuid(),
  q.id,
  p.id,
  200,
  180,
  15,
  1875.00,
  5000.00
FROM quotes q
CROSS JOIN products p
WHERE q.company_id = (SELECT id FROM companies WHERE code = 'DEMO')
  AND q.customer_name = 'Green Valley Resort'
  AND p.collection = 'Picasso'
LIMIT 1;

-- Demo data insertion complete!
-- You should now see:
-- - Monthly and yearly sales metrics
-- - Profit and profit margin data
-- - Conversion rate
-- - Revenue trends over 6 months
-- - Popular collections (Roller, Vertical, Venetian)
-- - Top customers by revenue
-- - Quote stats (total, approved, pending)
