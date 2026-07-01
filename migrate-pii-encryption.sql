-- Migration: Add encrypted PII columns (data encrypted via app, not SQL)
-- Run this in Neon's SQL Editor to add columns

-- Add encrypted columns to quotes table
ALTER TABLE quotes
ADD COLUMN customer_name_encrypted bytea,
ADD COLUMN customer_address_encrypted bytea;

-- Add encrypted column to users table (only email, no name column exists)
ALTER TABLE users
ADD COLUMN email_encrypted bytea;

-- Note: Data encryption happens via Node.js app (crypto.ts helpers)
-- Run the app after migration to populate these columns
-- See Task 16 for data encryption script

-- Migration complete
