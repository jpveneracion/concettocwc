-- Migration 094: RLS-free activation code lookup by code string
--
-- Problem: activation_codes_tenant_isolation filters reads to codes created
-- by (or used by) users of the acting company. But the business rule is:
-- only the superadmin creates codes and OTHER companies redeem them.
-- The self-serve redemption lookup therefore never sees the code and fails
-- with "Promo code not found".
--
-- Fix: companion to increment_promo_usage (migration 092) - a SECURITY
-- DEFINER function owned by neondb_owner that reads the code row outside
-- RLS. Case-insensitive so user-typed case never matters. The canonical
-- stored code is then passed to increment_promo_usage for the usage bump.
--
-- Run in the Neon SQL console (owner role) exactly like migration 092/093.

BEGIN;

CREATE OR REPLACE FUNCTION get_activation_code_by_code(p_code text)
RETURNS SETOF activation_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM activation_codes WHERE LOWER(code) = LOWER(p_code) LIMIT 1;
$$;

COMMENT ON FUNCTION get_activation_code_by_code(text) IS 'SECURITY DEFINER function to look up an activation code by string, bypassing RLS tenant isolation so codes created by the superadmin company can be redeemed by any other company.';

GRANT EXECUTE ON FUNCTION get_activation_code_by_code(text) TO PUBLIC;

COMMIT;
