-- Migration: 003_create_payment_identifier_system.sql
-- Description: Create payment identifier system with webhook data handling and automatic verification
-- Version: 1.0
-- Author: Concetto WC Development Team

BEGIN;

-- Step 1: Create gcash_webhook_data table
CREATE TABLE gcash_webhook_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  cleaned_transaction_number VARCHAR(50) GENERATED ALWAYS AS (
    NULLIF(REGEXP_REPLACE(UPPER(transaction_number), '[^A-Z0-9]', '', ''), '')
  ) STORED,
  amount DECIMAL(10,2) NOT NULL,
  sender_name VARCHAR(255),
  sender_account VARCHAR(50),
  receiver_name VARCHAR(255),
  receiver_account VARCHAR(50),
  transaction_time TIMESTAMPTZ NOT NULL,
  notification_text TEXT,
  raw_webhook_payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE gcash_webhook_data IS 'Stores incoming GCash webhook data for payment verification and automatic matching';
COMMENT ON COLUMN gcash_webhook_data.transaction_number IS 'Original transaction number from webhook (VARCHAR(50) for transaction IDs)';
COMMENT ON COLUMN gcash_webhook_data.sender_name IS 'Sender name (VARCHAR(255) for longer names)';
COMMENT ON COLUMN gcash_webhook_data.sender_account IS 'Sender account number (VARCHAR(50) for account IDs)';
COMMENT ON COLUMN gcash_webhook_data.cleaned_transaction_number IS 'Generated column with cleaned, uppercase transaction number for matching';

CREATE INDEX idx_gcash_webhook_transaction_lookup ON gcash_webhook_data(cleaned_transaction_number) WHERE cleaned_transaction_number IS NOT NULL;
CREATE INDEX idx_gcash_webhook_processing ON gcash_webhook_data(processed, received_at);
CREATE INDEX idx_gcash_webhook_time ON gcash_webhook_data(transaction_time DESC);

-- Step 2: Create gateway_device_heartbeat table
CREATE TABLE gateway_device_heartbeat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(50) NOT NULL,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'online',
  ip_address INET,
  battery_level INTEGER,
  macrodroid_version VARCHAR(20),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure valid status values
  CONSTRAINT valid_gateway_status CHECK (status IN ('online', 'offline', 'degraded'))
);

CREATE INDEX idx_gateway_heartbeat_status ON gateway_device_heartbeat(status, last_ping);

COMMENT ON TABLE gateway_device_heartbeat IS 'Tracks device heartbeat status for payment gateway monitoring';
COMMENT ON COLUMN gateway_device_heartbeat.status IS 'Device status: online, offline, or degraded (CHECK constraint enforced)';
COMMENT ON COLUMN gateway_device_heartbeat.device_id IS 'Device identifier (VARCHAR(50) for device IDs)';

-- Step 3: Create payment_settings table for QR code configuration
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method VARCHAR(20) NOT NULL,
  qr_code_url TEXT NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure valid payment method values
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('gcash', 'gotyme', 'usdc'))
);

CREATE UNIQUE INDEX idx_payment_settings_method ON payment_settings(payment_method);

COMMENT ON TABLE payment_settings IS 'Stores payment method configuration including QR codes and account details';
COMMENT ON COLUMN payment_settings.payment_method IS 'Payment method: gcash, gotyme, or usdc (CHECK constraint enforced)';
COMMENT ON COLUMN payment_settings.account_name IS 'Account holder name (VARCHAR(255) for longer names)';
COMMENT ON COLUMN payment_settings.account_number IS 'Account number (VARCHAR(50) for account IDs)';

-- Step 4: Enhance payment_verifications table
ALTER TABLE payment_verifications
ADD COLUMN automatic_verification_attempted BOOLEAN DEFAULT FALSE,
ADD COLUMN automatic_verification_status VARCHAR(50),
ADD COLUMN webhook_data_id UUID REFERENCES gcash_webhook_data(id),
ADD COLUMN verification_method VARCHAR(20) DEFAULT 'manual',
ADD COLUMN cleaned_reference_number VARCHAR(50)
GENERATED ALWAYS AS (
  NULLIF(REGEXP_REPLACE(UPPER(reference_number), '[^A-Z0-9]', '', ''), '')
) STORED,
ADD CONSTRAINT valid_auto_status CHECK (automatic_verification_status IN ('matched', 'no_webhook_data', 'amount_mismatch', 'time_mismatch', 'other_mismatch'));

CREATE INDEX idx_payment_verifications_reference_lookup ON payment_verifications(cleaned_reference_number) WHERE cleaned_reference_number IS NOT NULL;

COMMENT ON TABLE payment_verifications IS 'Payment verification records with manual and automatic verification support';
COMMENT ON COLUMN payment_verifications.automatic_verification_status IS 'Automatic verification result: matched, no_webhook_data, amount_mismatch, time_mismatch, or other_mismatch (CHECK constraint enforced)';
COMMENT ON COLUMN payment_verifications.cleaned_reference_number IS 'Generated column with cleaned, uppercase reference number for matching (VARCHAR(50) for reference codes)';

COMMIT;