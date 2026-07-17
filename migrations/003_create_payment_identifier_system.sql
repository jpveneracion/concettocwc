-- migrations/003_create_payment_identifier_system.sql

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
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate webhooks
  CONSTRAINT uniq_transaction_number UNIQUE (transaction_number)
);

CREATE INDEX idx_gcash_webhook_transaction_lookup ON gcash_webhook_data(cleaned_transaction_number) WHERE cleaned_transaction_number IS NOT NULL;
CREATE INDEX idx_gcash_webhook_processing ON gcash_webhook_data(processed, received_at);

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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gateway_heartbeat_status ON gateway_device_heartbeat(status, last_ping);

-- Step 3: Create payment_settings table for QR code configuration
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method VARCHAR(20) NOT NULL,
  qr_code_url TEXT NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_payment_settings_method ON payment_settings(payment_method);

-- Step 4: Enhance payment_verifications table
ALTER TABLE payment_verifications
ADD COLUMN automatic_verification_attempted BOOLEAN DEFAULT FALSE,
ADD COLUMN automatic_verification_status VARCHAR(50),
ADD COLUMN webhook_data_id UUID REFERENCES gcash_webhook_data(id),
ADD COLUMN verification_method VARCHAR(20) DEFAULT 'manual',
ADD COLUMN cleaned_reference_number VARCHAR(50)
GENERATED ALWAYS AS (
  NULLIF(REGEXP_REPLACE(UPPER(reference_number), '[^A-Z0-9]', '', ''), '')
) STORED;

CREATE INDEX idx_payment_verifications_reference_lookup ON payment_verifications(cleaned_reference_number) WHERE cleaned_reference_number IS NOT NULL;

COMMIT;