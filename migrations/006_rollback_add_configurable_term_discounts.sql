-- Migration: 006_rollback_add_configurable_term_discounts.sql
-- Description: Rollback configurable term discount rates from payment_settings
-- Version: 1.0
-- Author: Concetto WC Development Team

BEGIN;

-- Remove configurable term discount rates from payment_settings
ALTER TABLE payment_settings DROP COLUMN IF EXISTS quarterly_discount_percent;
ALTER TABLE payment_settings DROP COLUMN IF EXISTS annual_discount_percent;

COMMIT;