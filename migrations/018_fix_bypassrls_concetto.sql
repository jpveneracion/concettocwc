-- migrations/018_fix_bypassrls_concetto.sql
-- Fix: Remove BYPASSRLS from concetto role to enable RLS policies
-- 
-- The concetto database user was granted BYPASSRLS which allows it to 
-- bypass ALL row-level security policies. This must be removed for 
-- multi-tenant RLS isolation to work correctly.
-- 
-- NOTE: This migration MUST be run as a superuser (e.g., neondb_owner)
-- The application user (concetto) cannot ALTER ROLE itself.
-- 
-- Run this in the Neon SQL Editor or via psql as superuser:
-- ALTER ROLE concetto NOBYPASSRLS;

-- Verify BYPASSRLS status:
-- SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'concetto';

-- After fix, verify RLS works:
-- 1. SET ROLE concetto;
-- 2. SELECT set_tenant_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user');
-- 3. SELECT * FROM company_product_definitions; -- Should only show company A's products

-- This file documents the required fix. The actual ALTER ROLE command
-- must be executed by a superuser outside of the normal migration process.

SELECT 'BYPASSRLS fix required - run ALTER ROLE concetto NOBYPASSRLS as superuser' AS notice;