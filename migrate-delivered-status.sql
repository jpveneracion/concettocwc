-- Migration: Update status constraint to replace 'approved' with 'delivered'
-- Run this in Neon's SQL Editor
-- Purpose: Change order status workflow from 'approved' to 'delivered'

-- Step 1: Update any existing 'approved' records to 'delivered' FIRST
UPDATE quotes SET status = 'delivered' WHERE status = 'approved';

-- Step 2: Drop the old check constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

-- Step 3: Add the new check constraint with 'delivered' instead of 'approved'
ALTER TABLE quotes
ADD CONSTRAINT quotes_status_check
CHECK (status IN ('draft', 'sent', 'delivered', 'cancelled'));

-- Migration complete
