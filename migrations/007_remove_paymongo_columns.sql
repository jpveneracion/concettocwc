-- Migration: 007_remove_paymongo_columns.sql
-- Description: Remove PayMongo payment gateway columns
-- Version: 1.0
-- Author: Concetto WC Development Team
-- Date: 2026-07-24

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