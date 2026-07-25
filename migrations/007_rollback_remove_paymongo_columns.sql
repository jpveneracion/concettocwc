-- Migration: 007_rollback_remove_paymongo_columns.sql
-- Description: Rollback PayMongo payment gateway columns removal
-- Version: 1.0
-- Author: Concetto WC Development Team
-- Date: 2026-07-24

BEGIN;

-- Restore PayMongo plan reference to subscription_plans table
ALTER TABLE subscription_plans ADD COLUMN paymongo_plan_id TEXT UNIQUE;

-- Restore PayMongo subscription reference to subscriptions table
ALTER TABLE subscriptions ADD COLUMN paymongo_subscription_id TEXT UNIQUE;

-- Restore PayMongo invoice reference to invoices table
ALTER TABLE invoices ADD COLUMN paymongo_invoice_id TEXT UNIQUE;

-- Restore PayMongo payment method reference to payment_methods table
ALTER TABLE payment_methods ADD COLUMN paymongo_payment_method_id TEXT NOT NULL UNIQUE;

-- Restore PayMongo event reference to webhook_events table
ALTER TABLE webhook_events ADD COLUMN paymongo_event_id TEXT NOT NULL UNIQUE;

-- Restore index for PayMongo subscription lookups
CREATE INDEX idx_subscriptions_paymongo_id ON subscriptions(paymongo_subscription_id);

COMMIT;