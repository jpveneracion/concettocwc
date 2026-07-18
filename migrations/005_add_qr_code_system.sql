-- Add plan-specific QR codes to payment_settings
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS gcash_basic_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gcash_pro_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gcash_premium_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_basic_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_pro_qr_url TEXT,
ADD COLUMN IF NOT EXISTS gotyme_premium_qr_url TEXT;

-- Check if activation_codes table exists (our promo codes table)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activation_codes') THEN
        -- Add QR code columns to existing activation_codes table
        ALTER TABLE activation_codes
        ADD COLUMN IF NOT EXISTS gcash_qr_url TEXT,
        ADD COLUMN IF NOT EXISTS gotyme_qr_url TEXT;

        -- Add validation columns if not exist
        ALTER TABLE activation_codes
        ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS current_usage INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

        RAISE NOTICE 'Updated existing activation_codes table';
    ELSE
        -- Create promo_codes table if activation_codes doesn't exist
        CREATE TABLE promo_codes (
            id TEXT PRIMARY KEY DEFAULT generate_id(),
            code TEXT UNIQUE NOT NULL,
            discount_percent DECIMAL(5,2) NOT NULL,
            discount_amount DECIMAL(10,2),
            usage_limit INTEGER DEFAULT 1,
            current_usage INTEGER DEFAULT 0,
            expires_at TIMESTAMP,
            gcash_qr_url TEXT,
            gotyme_qr_url TEXT,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT REFERENCES users(id)
        );

        RAISE NOTICE 'Created new promo_codes table';
    END IF;
END $$;

-- Create function to validate promo codes
CREATE OR REPLACE FUNCTION validate_promo_code(promo_code TEXT)
RETURNS TABLE (
    valid BOOLEAN,
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    gcash_qr_url TEXT,
    gotyme_qr_url TEXT,
    error_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM activation_codes WHERE code = promo_code)
            THEN false
            WHEN (SELECT expires_at FROM activation_codes WHERE code = promo_code) < CURRENT_TIMESTAMP
            THEN false
            WHEN (SELECT current_usage FROM activation_codes WHERE code = promo_code) >= (SELECT usage_limit FROM activation_codes WHERE code = promo_code)
            THEN false
            WHEN NOT (SELECT active FROM activation_codes WHERE code = promo_code)
            THEN false
            ELSE true
        END as valid,
        (SELECT discount_percent FROM activation_codes WHERE code = promo_code),
        (SELECT discount_amount FROM activation_codes WHERE code = promo_code),
        (SELECT gcash_qr_url FROM activation_codes WHERE code = promo_code),
        (SELECT gotyme_qr_url FROM activation_codes WHERE code = promo_code),
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM activation_codes WHERE code = promo_code)
            THEN 'Promo code not found'
            WHEN (SELECT expires_at FROM activation_codes WHERE code = promo_code) < CURRENT_TIMESTAMP
            THEN 'Promo code has expired'
            WHEN (SELECT current_usage FROM activation_codes WHERE code = promo_code) >= (SELECT usage_limit FROM activation_codes WHERE code = promo_code)
            THEN 'Promo code has reached maximum usage'
            WHEN NOT (SELECT active FROM activation_codes WHERE code = promo_code)
            THEN 'Promo code is inactive'
            ELSE NULL
        END as error_message;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment promo usage
CREATE OR REPLACE FUNCTION increment_promo_usage(promo_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE activation_codes
    SET current_usage = current_usage + 1
    WHERE code = promo_code;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;