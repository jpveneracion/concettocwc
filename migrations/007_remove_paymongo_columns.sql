-- migrations/remove-paymongo-columns.sql
-- Migration: Remove PayMongo payment gateway columns
-- Date: 2026-07-24
-- Description: Remove unused PayMongo columns from subscription system tables

BEGIN;

-- Remove PayMongo plan reference from subscription_plans table
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS paymongo_plan_id;

-- Remove PayMongo subscription reference from subscriptions table
ALTER TABLE subscriptions DROP COLUMN IF EXISTS paymongo_subscription_id;

-- Remove PayMongo invoice reference from invoices table
ALTER TABLE invoices DROP COLUMN IF EXISTS paymongo_invoice_id;

-- Remove PayMongo payment method reference from payment_methods table
ALTER TABLE payment_methods DROP COLUMN IF EXISTS paymongo_payment_method_id;

-- Remove PayMongo event reference from webhook_events table
ALTER TABLE webhook_events DROP COLUMN IF EXISTS paymongo_event_id;

-- Remove unused index for PayMongo subscription lookups
DROP INDEX IF EXISTS idx_subscriptions_paymongo_id;

COMMIT;

-- Rollback script (save as separate file if needed):
-- BEGIN;
-- ALTER TABLE subscription_plans ADD COLUMN paymongo_plan_id TEXT UNIQUE;
-- ALTER TABLE subscriptions ADD COLUMN paymongo_subscription_id TEXT UNIQUE;
-- ALTER TABLE invoices ADD COLUMN paymongo_invoice_id TEXT UNIQUE;
-- ALTER TABLE payment_methods ADD COLUMN paymongo_payment_method_id TEXT NOT NULL UNIQUE;
-- ALTER TABLE webhook_events ADD COLUMN paymongo_event_id TEXT NOT NULL UNIQUE;
-- CREATE INDEX idx_subscriptions_paymongo_id ON subscriptions(paymongo_subscription_id);
-- COMMIT;