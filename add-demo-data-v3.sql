-- Add Demo Data for Demo Account (Complete Version with All Required Fields)
-- Run this in Neon's SQL Editor
-- This includes all required fields including encrypted PII

-- Insert sample quotes for DEMO company with all required fields

-- Quote 1: Approved - ABC Corporation
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-001',
  'ABC Corporation',
  '123 Business Ave, Suite 100, Metro City, MC 12345',
  encrypt('ABC Corporation', gen_salt('bf')),
  encrypt('123 Business Ave, Suite 100, Metro City, MC 12345', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '15 days',
  'approved',
  'REF-001',
  500.00,
  200.00,
  3800.00,
  4500.00,
  120.5,
  8,
  CURRENT_DATE - INTERVAL '15 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 2: Approved - Smith Residence
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-002',
  'Smith Residence',
  '456 Oak Street, Suburbia, SB 67890',
  encrypt('Smith Residence', gen_salt('bf')),
  encrypt('456 Oak Street, Suburbia, SB 67890', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '30 days',
  'approved',
  'REF-002',
  300.00,
  150.00,
  2350.00,
  2800.00,
  85.0,
  5,
  CURRENT_DATE - INTERVAL '30 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 3: Sent - Metro Hotel
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-003',
  'Metro Hotel',
  '789 Hotel Boulevard, Downtown, DT 11111',
  encrypt('Metro Hotel', gen_salt('bf')),
  encrypt('789 Hotel Boulevard, Downtown, DT 11111', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '5 days',
  'sent',
  'REF-003',
  800.00,
  400.00,
  5000.00,
  6200.00,
  250.0,
  15,
  CURRENT_DATE - INTERVAL '5 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 4: Approved - Dr. Johnson Clinic
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-004',
  'Dr. Johnson Clinic',
  '321 Medical Center Dr, Health City, HC 22222',
  encrypt('Dr. Johnson Clinic', gen_salt('bf')),
  encrypt('321 Medical Center Dr, Health City, HC 22222', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '45 days',
  'approved',
  'REF-004',
  200.00,
  100.00,
  1550.00,
  1850.00,
  55.0,
  4,
  CURRENT_DATE - INTERVAL '45 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 5: Pending - Garcia Family
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-005',
  'Garcia Family',
  '555 Family Lane, Residential Area, RA 33333',
  encrypt('Garcia Family', gen_salt('bf')),
  encrypt('555 Family Lane, Residential Area, RA 33333', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '2 days',
  'pending',
  'REF-005',
  350.00,
  150.00,
  2700.00,
  3200.00,
  95.0,
  6,
  CURRENT_DATE - INTERVAL '2 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 6: Approved - Luxury Apartments Inc (2 months ago)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-006',
  'Luxury Apartments Inc',
  '999 Luxury Way, High End District, HD 44444',
  encrypt('Luxury Apartments Inc', gen_salt('bf')),
  encrypt('999 Luxury Way, High End District, HD 44444', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '60 days',
  'approved',
  'REF-006',
  1000.00,
  500.00,
  7400.00,
  8900.00,
  320.0,
  20,
  CURRENT_DATE - INTERVAL '60 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 7: Approved - City Center Mall (3 months ago)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-007',
  'City Center Mall',
  '100 Mall Road, Shopping District, SD 55555',
  encrypt('City Center Mall', gen_salt('bf')),
  encrypt('100 Mall Road, Shopping District, SD 55555', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '90 days',
  'approved',
  'REF-007',
  1500.00,
  1000.00,
  10000.00,
  12500.00,
  450.0,
  25,
  CURRENT_DATE - INTERVAL '90 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 8: Sent - Wilson Restaurant (4 months ago)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-008',
  'Wilson Restaurant',
  '222 Food Street, Restaurant Row, RR 66666',
  encrypt('Wilson Restaurant', gen_salt('bf')),
  encrypt('222 Food Street, Restaurant Row, RR 66666', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '120 days',
  'sent',
  'REF-008',
  250.00,
  150.00,
  1700.00,
  2100.00,
  65.0,
  5,
  CURRENT_DATE - INTERVAL '120 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 9: Approved - Brown & Associates Law (4 months ago)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-009',
  'Brown & Associates Law',
  '888 Legal Ave, Law District, LD 77777',
  encrypt('Brown & Associates Law', gen_salt('bf')),
  encrypt('888 Legal Ave, Law District, LD 77777', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '120 days',
  'approved',
  'REF-009',
  600.00,
  400.00,
  4400.00,
  5400.00,
  180.0,
  12,
  CURRENT_DATE - INTERVAL '120 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 10: Approved - Riverside Hotel (5 months ago)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-010',
  'Riverside Hotel',
  '777 River Road, Waterfront, WF 88888',
  encrypt('Riverside Hotel', gen_salt('bf')),
  encrypt('777 River Road, Waterfront, WF 88888', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '150 days',
  'approved',
  'REF-010',
  900.00,
  500.00,
  6400.00,
  7800.00,
  280.0,
  16,
  CURRENT_DATE - INTERVAL '150 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 11: Cancelled - StartUp Tech Co
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-011',
  'StartUp Tech Co',
  '111 Innovation Drive, Tech Park, TP 99999',
  encrypt('StartUp Tech Co', gen_salt('bf')),
  encrypt('111 Innovation Drive, Tech Park, TP 99999', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '20 days',
  'cancelled',
  'REF-011',
  200.00,
  100.00,
  1200.00,
  1500.00,
  45.0,
  3,
  CURRENT_DATE - INTERVAL '20 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 12: Approved - Patterson Residence (5 months ago)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-012',
  'Patterson Residence',
  '444 Home Street, Subdivision, SD 10101',
  encrypt('Patterson Residence', gen_salt('bf')),
  encrypt('444 Home Street, Subdivision, SD 10101', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '150 days',
  'approved',
  'REF-012',
  400.00,
  200.00,
  2800.00,
  3400.00,
  110.0,
  7,
  CURRENT_DATE - INTERVAL '150 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 13: Sent - Green Valley Resort
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-013',
  'Green Valley Resort',
  '333 Resort Avenue, Vacation Land, VL 20202',
  encrypt('Green Valley Resort', gen_salt('bf')),
  encrypt('333 Resort Avenue, Vacation Land, VL 20202', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '10 days',
  'sent',
  'REF-013',
  2000.00,
  1000.00,
  12000.00,
  15000.00,
  550.0,
  30,
  CURRENT_DATE - INTERVAL '10 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 14: Pending - Oceanview Restaurant
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-014',
  'Oceanview Restaurant',
  '666 Beach Road, Coastal Area, CA 30303',
  encrypt('Oceanview Restaurant', gen_salt('bf')),
  encrypt('666 Beach Road, Coastal Area, CA 30303', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '7 days',
  'pending',
  'REF-014',
  700.00,
  300.00,
  3200.00,
  4200.00,
  140.0,
  8,
  CURRENT_DATE - INTERVAL '7 days'
FROM companies c WHERE c.code = 'DEMO';

-- Quote 15: Approved - Lee Dental Clinic (current month)
INSERT INTO quotes (
  id, company_id, quote_number, customer_name, customer_address,
  customer_name_encrypted, customer_address_encrypted,
  quote_date, status, our_ref,
  installation_fee, delivery_fee, subtotal, total, total_area, panel_count,
  created_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'QTM-2024-015',
  'Lee Dental Clinic',
  '555 Dental Plaza, Medical District, MD 40404',
  encrypt('Lee Dental Clinic', gen_salt('bf')),
  encrypt('555 Dental Plaza, Medical District, MD 40404', gen_salt('bf')),
  CURRENT_DATE - INTERVAL '3 days',
  'approved',
  'REF-015',
  150.00,
  100.00,
  1400.00,
  1650.00,
  50.0,
  4,
  CURRENT_DATE - INTERVAL '3 days'
FROM companies c WHERE c.code = 'DEMO';

-- Now add quote_items for each quote
-- These use actual product IDs from the database

-- Add items for Quote 1 (ABC Corporation - 8 items)
WITH demo_product AS (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quote_items (
  id, quote_id, sort_order, location,
  product_id, product_code, product_collection,
  unit, is_fixed,
  measured_width, measured_drop, final_width, final_drop,
  area_sqft, retail_price_sqft, supplier_cost_sqft,
  retail_amount, supplier_amount
)
SELECT
  gen_random_uuid(),
  q.id,
  0,
  'Living Room',
  p.id,
  p.code,
  p.collection,
  'sqft',
  false,
  120,
  150,
  120,
  150,
  (120 * 150) / 144.0,
  30.00,
  10.00,
  475.00,
  158.33
FROM quotes q
CROSS JOIN demo_product p
WHERE q.quote_number = 'QTM-2024-001'
LIMIT 1;

WITH demo_product AS (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1)
INSERT INTO quote_items (
  id, quote_id, sort_order, location,
  product_id, product_code, product_collection,
  unit, is_fixed,
  measured_width, measured_drop, final_width, final_drop,
  area_sqft, retail_price_sqft, supplier_cost_sqft,
  retail_amount, supplier_amount
)
SELECT
  gen_random_uuid(),
  q.id,
  1,
  'Master Bedroom',
  p.id,
  p.code,
  p.collection,
  'sqft',
  false,
  180,
  150,
  180,
  150,
  (180 * 150) / 144.0,
  35.00,
  12.00,
  656.25,
  225.00
FROM quotes q
CROSS JOIN demo_product p
WHERE q.quote_number = 'QTM-2024-001'
LIMIT 1;

-- Add simplified items for remaining quotes (1-2 items each for profit calculations)
-- Quote 2: Smith Residence (5 items total)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Window 1', p.id, p.code, p.collection, 'sqft', false, 100, 120, 100, 120, (100*120)/144.0, 28.00, 9.50, 233.33, 79.17
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-002';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Window 2', p.id, p.code, p.collection, 'sqft', false, 140, 160, 140, 160, (140*160)/144.0, 32.00, 11.00, 311.11, 106.67
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-002';

-- Quote 3: Metro Hotel (add 3 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Room 101', p.id, p.code, p.collection, 'sqft', false, 200, 180, 200, 180, (200*180)/144.0, 40.00, 15.00, 1000.00, 375.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-003';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Room 102', p.id, p.code, p.collection, 'sqft', false, 150, 160, 150, 160, (150*160)/144.0, 38.00, 14.00, 633.33, 233.33
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-003';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 2, 'Lobby', p.id, p.code, p.collection, 'sqft', false, 250, 200, 250, 200, (250*200)/144.0, 45.00, 18.00, 1562.50, 625.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-003';

-- Quote 4: Dr. Johnson Clinic (4 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Exam Room 1', p.id, p.code, p.collection, 'sqft', false, 90, 120, 90, 120, (90*120)/144.0, 26.00, 8.50, 195.00, 63.75
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-004';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Exam Room 2', p.id, p.code, p.collection, 'sqft', false, 120, 140, 120, 140, (120*140)/144.0, 28.00, 9.50, 326.67, 110.83
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-004';

-- Continue adding items for remaining approved/sent quotes for profit calculations
-- Quote 6: Luxury Apartments Inc
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Unit 101', p.id, p.code, p.collection, 'sqft', false, 180, 180, 180, 180, (180*180)/144.0, 42.00, 16.00, 945.00, 360.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-006';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Unit 102', p.id, p.code, p.collection, 'sqft', false, 150, 160, 150, 160, (150*160)/144.0, 38.00, 14.00, 633.33, 233.33
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-006';

-- Quote 7: City Center Mall (3 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Store 1', p.id, p.code, p.collection, 'sqft', false, 250, 200, 250, 200, (250*200)/144.0, 50.00, 20.00, 1736.11, 694.44
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-007';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Store 2', p.id, p.code, p.collection, 'sqft', false, 200, 180, 200, 180, (200*180)/144.0, 45.00, 18.00, 1125.00, 450.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-007';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 2, 'Food Court', p.id, p.code, p.collection, 'sqft', false, 300, 250, 300, 250, (300*250)/144.0, 55.00, 22.00, 2864.58, 1145.83
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-007';

-- Quote 9: Brown & Associates Law
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Office 1', p.id, p.code, p.collection, 'sqft', false, 200, 180, 200, 180, (200*180)/144.0, 48.00, 19.00, 1200.00, 475.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-009';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Conference Room', p.id, p.code, p.collection, 'sqft', false, 250, 200, 250, 200, (250*200)/144.0, 52.00, 21.00, 1805.56, 729.17
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-009';

-- Quote 10: Riverside Hotel (2 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Room 201', p.id, p.code, p.collection, 'sqft', false, 220, 200, 220, 200, (220*200)/144.0, 50.00, 20.00, 1527.78, 611.11
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-010';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Room 202', p.id, p.code, p.collection, 'sqft', false, 180, 180, 180, 180, (180*180)/144.0, 46.00, 18.50, 1035.00, 416.25
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-010';

-- Quote 12: Patterson Residence (3 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Living Room', p.id, p.code, p.collection, 'sqft', false, 160, 180, 160, 180, (160*180)/144.0, 40.00, 15.00, 800.00, 300.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-012';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Bedroom', p.id, p.code, p.collection, 'sqft', false, 140, 160, 140, 160, (140*160)/144.0, 36.00, 13.50, 560.00, 210.00
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-012';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 2, 'Kitchen', p.id, p.code, p.collection, 'sqft', false, 120, 140, 120, 140, (120*140)/144.0, 34.00, 12.50, 393.33, 144.58
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-012';

-- Quote 13: Green Valley Resort (4 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Cottage 1', p.id, p.code, p.collection, 'sqft', false, 300, 250, 300, 250, (300*250)/144.0, 60.00, 25.00, 3125.00, 1302.08
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-013';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Cottage 2', p.id, p.code, p.collection, 'sqft', false, 250, 220, 250, 220, (250*220)/144.0, 55.00, 22.50, 2097.22, 856.25
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-013';

-- Quote 15: Lee Dental Clinic (4 items)
INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 0, 'Treatment Room 1', p.id, p.code, p.collection, 'sqft', false, 100, 120, 100, 120, (100*120)/144.0, 30.00, 10.00, 250.00, 83.33
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-015';

INSERT INTO quote_items (id, quote_id, sort_order, location, product_id, product_code, product_collection, unit, is_fixed, measured_width, measured_drop, final_width, final_drop, area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount)
SELECT gen_random_uuid(), q.id, 1, 'Treatment Room 2', p.id, p.code, p.collection, 'sqft', false, 110, 130, 110, 130, (110*130)/144.0, 32.00, 11.00, 318.06, 109.31
FROM quotes q, (SELECT id, code, collection FROM products WHERE collection IS NOT NULL LIMIT 1) p
WHERE q.quote_number = 'QTM-2024-015';

-- Demo data insertion complete!
-- Summary:
-- - 15 quotes created (9 approved, 3 sent, 2 pending, 1 cancelled)
-- - Quote items added for profit/margin calculations
-- - Data spans 6 months for trend analysis
-- - Multiple customers for top customers list
-- - All using Picasso Premum Blackout collection
