-- Production Database Schema Migration
-- Generated from production database inspection on 2025-01-09
-- Database: concetto on Neon.tech PostgreSQL
--
-- This migration recreates the exact production database structure
-- including all tables, columns, constraints, indexes, and foreign keys
--
-- Usage: psql -f migrations/production-complete-schema.sql
--        or: psql -U your_username -d your_database -f migrations/production-complete-schema.sql

-- Start transaction
BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- COMPANIES TABLE
-- ============================================================
CREATE TABLE companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  address text,
  mobile text,
  email text,
  prepared_by text,
  terms text,
  del_note text,
  closing_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cost_categories jsonb DEFAULT '["materials", "labor", "overhead", "shipping"]'::jsonb,
  currency text DEFAULT 'PHP'::text,
  subscription_status character varying(20) DEFAULT 'demo'::character varying,
  trial_end timestamp with time zone,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

ALTER TABLE companies ADD CONSTRAINT companies_code_key UNIQUE (code);
ALTER TABLE companies ADD CONSTRAINT companies_subscription_status_check CHECK (subscription_status IN ('demo', 'trialing', 'active', 'past_due', 'cancelled', 'unpaid'));

CREATE INDEX companies_code_idx ON companies USING btree (code);
CREATE INDEX idx_companies_subscription_status ON companies USING btree (subscription_status);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  email text,
  password_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name_encrypted bytea,
  email_encrypted bytea,
  email_hash text,
  is_oauth_user boolean DEFAULT false,
  trial_expires_at timestamp with time zone,
  subscription_activated boolean DEFAULT false,
  activation_code character varying(255),
  discount_percent numeric,
  subscription_plan character varying(50),
  role character varying(20) DEFAULT 'user'::character varying,
  is_admin boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_company_id_required CHECK (company_id IS NOT NULL);
ALTER TABLE users ADD CONSTRAINT check_role CHECK (role IN ('user', 'admin', 'super_admin'));

CREATE INDEX users_company_idx ON users USING btree (company_id);
CREATE INDEX users_email_idx ON users USING btree (email);
CREATE INDEX users_email_hash_idx ON users USING btree (email_hash);
CREATE INDEX idx_users_role ON users USING btree (role);
CREATE INDEX idx_users_is_admin ON users USING btree (is_admin);
CREATE INDEX idx_users_trial_expires ON users USING btree (trial_expires_at);
CREATE INDEX idx_users_subscription_status ON users USING btree (subscription_activated, trial_expires_at);

-- ============================================================
-- OAUTH_ACCOUNTS TABLE
-- ============================================================
CREATE TABLE oauth_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  email text,
  username text,
  wallet_address text,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT oauth_accounts_pkey PRIMARY KEY (id)
);

ALTER TABLE oauth_accounts ADD CONSTRAINT oauth_accounts_provider_provider_user_id_key UNIQUE (provider, provider_user_id);
ALTER TABLE oauth_accounts ADD CONSTRAINT oauth_accounts_provider_check CHECK (provider IN ('google', 'facebook', 'github'));

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts USING btree (user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts USING btree (provider, provider_user_id);
CREATE INDEX idx_oauth_accounts_email ON oauth_accounts USING btree (email) WHERE email IS NOT NULL;

-- ============================================================
-- PASSWORD_RESET_TOKENS TABLE
-- ============================================================
CREATE TABLE password_reset_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id)
);

CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens USING btree (user_id);
CREATE INDEX password_reset_tokens_token_idx ON password_reset_tokens USING btree (token);
CREATE INDEX password_reset_tokens_expires_idx ON password_reset_tokens USING btree (expires_at);

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  collection text,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'sqft'::text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

ALTER TABLE products ADD CONSTRAINT products_code_key UNIQUE (code);
ALTER TABLE products ADD CONSTRAINT products_unit_check CHECK (unit IN ('sqft', 'sqm', 'linear_ft', 'linear_m', 'each'));

CREATE INDEX products_code_idx ON products USING btree (code);

-- ============================================================
-- COMPANY_PRODUCTS TABLE
-- ============================================================
CREATE TABLE company_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  product_id uuid NOT NULL,
  supplier_cost numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  CONSTRAINT company_products_pkey PRIMARY KEY (id)
);

ALTER TABLE company_products ADD CONSTRAINT company_products_company_id_product_id_key UNIQUE (company_id, product_id);

CREATE INDEX company_products_company_idx ON company_products USING btree (company_id);
CREATE INDEX company_products_product_idx ON company_products USING btree (product_id);

-- ============================================================
-- COMPANY_COLLECTIONS TABLE
-- ============================================================
CREATE TABLE company_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  collection text NOT NULL,
  supplier_cost numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  CONSTRAINT company_collections_pkey PRIMARY KEY (id)
);

ALTER TABLE company_collections ADD CONSTRAINT company_collections_company_id_collection_key UNIQUE (company_id, collection);

CREATE INDEX company_collections_company_idx ON company_collections USING btree (company_id);
CREATE INDEX company_collections_collection_idx ON company_collections USING btree (collection);

-- ============================================================
-- COMPANY_PRODUCT_DEFINITIONS TABLE
-- ============================================================
CREATE TABLE company_product_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code character varying(50) NOT NULL,
  collection character varying(100),
  description text NOT NULL,
  unit character varying(20) DEFAULT 'sqft'::character varying,
  submitted_by uuid NOT NULL,
  is_approved_for_global boolean DEFAULT false,
  global_product_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_product_definitions_pkey PRIMARY KEY (id)
);

ALTER TABLE company_product_definitions ADD CONSTRAINT idx_company_products_company_code_unique UNIQUE (company_id, code);

CREATE INDEX idx_company_products_company_id ON company_product_definitions USING btree (company_id);
CREATE INDEX idx_company_products_code ON company_product_definitions USING btree (code);
CREATE INDEX idx_company_products_submitted_by ON company_product_definitions USING btree (submitted_by);
CREATE INDEX idx_company_products_approval_status ON company_product_definitions USING btree (is_approved_for_global);

-- ============================================================
-- PENDING_PRODUCTS TABLE
-- ============================================================
CREATE TABLE pending_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code character varying(50) NOT NULL,
  collection character varying(100),
  description text NOT NULL,
  unit character varying(20) DEFAULT 'sqft'::character varying,
  status character varying(20) DEFAULT 'pending'::character varying,
  submitted_by uuid,
  reviewed_by uuid,
  review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT pending_products_pkey PRIMARY KEY (id)
);

ALTER TABLE pending_products ADD CONSTRAINT pending_products_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

-- ============================================================
-- QUOTES TABLE
-- ============================================================
CREATE TABLE quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_number text NOT NULL,
  customer_name text,
  customer_address text,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  our_ref text,
  installation_fee numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  total_area numeric NOT NULL DEFAULT 0,
  panel_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  customer_name_encrypted bytea,
  customer_address_encrypted bytea,
  CONSTRAINT quotes_pkey PRIMARY KEY (id)
);

ALTER TABLE quotes ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'delivered'));

CREATE INDEX quotes_quote_number_key ON quotes USING btree (quote_number);

-- ============================================================
-- QUOTE_ITEMS TABLE
-- ============================================================
CREATE TABLE quote_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  location text,
  product_id uuid,
  product_code text,
  product_collection text,
  product_description text,
  unit text NOT NULL DEFAULT 'in'::text,
  is_fixed boolean NOT NULL DEFAULT true,
  measured_width numeric NOT NULL DEFAULT 0,
  measured_drop numeric NOT NULL DEFAULT 0,
  final_width numeric NOT NULL DEFAULT 0,
  final_drop numeric NOT NULL DEFAULT 0,
  area_sqft numeric NOT NULL DEFAULT 0,
  retail_price_sqft numeric NOT NULL DEFAULT 0,
  supplier_cost_sqft numeric NOT NULL DEFAULT 0,
  retail_amount numeric NOT NULL DEFAULT 0,
  supplier_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cost_breakdown jsonb DEFAULT '{}'::jsonb,
  product_source character varying(20) DEFAULT 'approved'::character varying,
  pending_product_id uuid,
  CONSTRAINT quote_items_pkey PRIMARY KEY (id)
);

ALTER TABLE quote_items ADD CONSTRAINT quote_items_unit_check CHECK (unit IN ('in', 'ft', 'cm', 'm'));
ALTER TABLE quote_items ADD CONSTRAINT check_product_source CHECK (product_source IN ('approved', 'pending', 'custom'));

CREATE INDEX quote_items_quote_id_idx ON quote_items USING btree (quote_id);
CREATE INDEX idx_quote_items_product_source ON quote_items USING btree (product_source);
CREATE INDEX idx_quote_items_pending_product ON quote_items USING btree (pending_product_id);

-- ============================================================
-- SUBSCRIPTION_PLANS TABLE
-- ============================================================
CREATE TABLE subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'PHP'::text,
  interval text NOT NULL DEFAULT 'month'::text,
  paymongo_plan_id text,
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);

ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_paymongo_plan_id_key UNIQUE (paymongo_plan_id);

-- ============================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'trialing'::text,
  plan_id uuid NOT NULL,
  trial_end timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  paymongo_subscription_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id)
);

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_company_id_key UNIQUE (company_id);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_paymongo_subscription_id_key UNIQUE (paymongo_subscription_id);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'unpaid'));

CREATE INDEX idx_subscriptions_company_id ON subscriptions USING btree (company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions USING btree (status);
CREATE INDEX idx_subscriptions_paymongo_id ON subscriptions USING btree (paymongo_subscription_id);

-- ============================================================
-- SUBSCRIPTION_ITEMS TABLE
-- ============================================================
CREATE TABLE subscription_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_items_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_subscription_items_subscription_id ON subscription_items USING btree (subscription_id);

-- ============================================================
-- INVOICES TABLE
-- ============================================================
CREATE TABLE invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  company_id uuid NOT NULL,
  number text NOT NULL,
  amount_due numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP'::text,
  status text NOT NULL DEFAULT 'draft'::text,
  paid_at timestamp with time zone,
  attempt_count integer NOT NULL DEFAULT 0,
  paymongo_invoice_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id)
);

ALTER TABLE invoices ADD CONSTRAINT invoices_number_key UNIQUE (number);
ALTER TABLE invoices ADD CONSTRAINT invoices_paymongo_invoice_id_key UNIQUE (paymongo_invoice_id);
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible'));

CREATE INDEX idx_invoices_subscription_id ON invoices USING btree (subscription_id);
CREATE INDEX idx_invoices_company_id ON invoices USING btree (company_id);
CREATE INDEX idx_invoices_status ON invoices USING btree (status);

-- ============================================================
-- PAYMENT_METHODS TABLE
-- ============================================================
CREATE TABLE payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  paymongo_payment_method_id text NOT NULL,
  type text NOT NULL,
  card_last4 text,
  expiry_date text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id)
);

ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_paymongo_payment_method_id_key UNIQUE (paymongo_payment_method_id);
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_type_check CHECK (type IN ('card', 'bank_account', 'wallet', 'qr_payment'));

CREATE INDEX idx_payment_methods_company_id ON payment_methods USING btree (company_id);

-- ============================================================
-- WEBHOOK_EVENTS TABLE
-- ============================================================
CREATE TABLE webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  paymongo_event_id text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_paymongo_event_id_key UNIQUE (paymongo_event_id);

CREATE INDEX idx_webhook_events_event_type ON webhook_events USING btree (event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events USING btree (processed);

-- ============================================================
-- ACTIVATION_CODES TABLE
-- ============================================================
CREATE SEQUENCE activation_codes_id_seq;

CREATE TABLE activation_codes (
  id integer NOT NULL DEFAULT nextval('activation_codes_id_seq'::regclass),
  code character varying(255) NOT NULL,
  discount_percent numeric NOT NULL,
  applicable_plans jsonb NOT NULL DEFAULT '["monthly", "quarterly", "annual"]'::jsonb,
  payment_amount numeric,
  payment_currency character varying(10) DEFAULT 'PHP'::character varying,
  payment_amount_usd numeric,
  payment_method character varying(50),
  exchange_rate numeric,
  payment_reference character varying(255),
  payment_date timestamp without time zone,
  wallet_address character varying(255),
  bank_reference character varying(255),
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  expires_at timestamp without time zone,
  used_by uuid,
  used_at timestamp without time zone,
  used_ip_address character varying(45),
  is_active boolean DEFAULT true,
  campaign_name character varying(255),
  notes text,
  status_history jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT activation_codes_pkey PRIMARY KEY (id)
);

ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_code_key UNIQUE (code);
ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_id_not_null CHECK (id IS NOT NULL);
ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_code_not_null CHECK (code IS NOT NULL);
ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_discount_percent_not_null CHECK (discount_percent IS NOT NULL);
ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_applicable_plans_not_null CHECK (applicable_plans IS NOT NULL);

CREATE INDEX activation_codes_code_key ON activation_codes USING btree (code);
CREATE INDEX idx_activation_codes_code ON activation_codes USING btree (code);
CREATE INDEX idx_activation_codes_created_at ON activation_codes USING btree (created_at);
CREATE INDEX idx_activation_codes_used_by ON activation_codes USING btree (used_by);
CREATE INDEX idx_activation_codes_status ON activation_codes USING btree (is_active, used_by);

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================

-- Users to Companies
ALTER TABLE users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- OAuth Accounts to Users
ALTER TABLE oauth_accounts ADD CONSTRAINT oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Password Reset Tokens to Users
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Company Collections to Companies
ALTER TABLE company_collections ADD CONSTRAINT company_collections_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Company Product Definitions to Companies and Users
ALTER TABLE company_product_definitions ADD CONSTRAINT company_product_definitions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE company_product_definitions ADD CONSTRAINT company_product_definitions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE company_product_definitions ADD CONSTRAINT company_product_definitions_global_product_id_fkey FOREIGN KEY (global_product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Company Products to Companies and Products
ALTER TABLE company_products ADD CONSTRAINT company_products_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE company_products ADD CONSTRAINT company_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Pending Products to Companies and Users
ALTER TABLE pending_products ADD CONSTRAINT pending_products_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE pending_products ADD CONSTRAINT pending_products_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE pending_products ADD CONSTRAINT pending_products_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Quotes to Companies
ALTER TABLE quotes ADD CONSTRAINT quotes_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Quote Items to Quotes and Products
ALTER TABLE quote_items ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE quote_items ADD CONSTRAINT quote_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Subscriptions to Companies and Subscription Plans
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Subscription Items to Subscriptions and Subscription Plans
ALTER TABLE subscription_items ADD CONSTRAINT subscription_items_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE subscription_items ADD CONSTRAINT subscription_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Invoices to Subscriptions and Companies
ALTER TABLE invoices ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Payment Methods to Companies
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Activation Codes to Users
ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE activation_codes ADD CONSTRAINT activation_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Commit transaction
COMMIT;