-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- OAuth accounts table
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'pi')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  wallet_address TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- Indexes for performance
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);
CREATE INDEX idx_oauth_accounts_email ON oauth_accounts(email) WHERE email IS NOT NULL;

-- Constraint to prevent abandonment state (enable after migration)
ALTER TABLE users ADD CONSTRAINT users_company_id_required
  CHECK (company_id IS NOT NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_oauth_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER oauth_accounts_updated_at
  BEFORE UPDATE ON oauth_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_accounts_updated_at();

-- ================================================================
-- SECURITY: Token Encryption with pgcrypto
-- ================================================================
-- OAuth access and refresh tokens are encrypted at rest using pgcrypto
-- Encryption key should be stored in ENCRYPTION_KEY environment variable
-- Key requirement: 32+ characters for AES-256 encryption

-- Function to encrypt sensitive data (tokens, emails)
CREATE OR REPLACE FUNCTION encrypt_token(plaintext TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF plaintext IS NULL OR key IS NULL THEN
    RETURN NULL;
  END IF;

  -- Validate key strength (minimum 32 characters for AES-256)
  IF length(key) < 32 THEN
    RAISE EXCEPTION 'Encryption key must be at least 32 characters for AES-256 security';
  END IF;

  RETURN encode(pgp_sym_encrypt(plaintext, key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt sensitive data (tokens, emails)
CREATE OR REPLACE FUNCTION decrypt_token(ciphertext TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL OR key IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(ciphertext, 'base64'), key);
  EXCEPTION WHEN OTHERS THEN
    -- Log decryption failure but don't expose details
    RAISE WARNING 'Token decryption failed for account at %', NOW();
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if encryption is working
CREATE OR REPLACE FUNCTION test_encryption()
RETURNS TABLE(status TEXT, result TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'encryption_test' as status,
    decrypt_token(encrypt_token('test_value', 'test_key'), 'test_key') as result;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECURITY DOCUMENTATION
-- ================================================================
--
-- CRITICAL SECURITY CONSIDERATIONS:
--
-- 1. ENCRYPTION KEY MANAGEMENT:
--    - Store ENCRYPTION_KEY in secure environment variable (32+ chars)
--    - Never commit encryption keys to version control
--    - Rotate encryption keys periodically (recommended: quarterly)
--    - Use different encryption keys for dev/staging/production
--
-- 2. TOKEN STORAGE:
--    - access_token and refresh_token are stored encrypted
--    - Encryption happens at application layer before database insert
--    - Decryption happens when tokens are needed for API calls
--    - Never log decrypted tokens
--
-- 3. ACCESS CONTROL:
--    - Functions are SECURITY DEFINER (run with function owner permissions)
--    - Consider Row-Level Security (RLS) for multi-tenant isolation
--    - Database access should use minimum required privileges
--
-- 4. COMPLIANCE:
--    - Encrypted storage helps with PII compliance (GDPR, CCPA)
--    - Email addresses can be encrypted if required by regulations
--    - Audit logs should track who accesses encrypted data
--
-- 5. MIGRATION NOTES:
--    - Test encryption functions: SELECT * FROM test_encryption();
--    - Enable after verifying pgcrypto extension is available
--    - No downtime required for adding these functions
--    - Existing plain text tokens remain until re-authenticated
--
-- 6. ROLLBACK PROCEDURE:
--    - Functions can be dropped without affecting existing data
--    - DROP FUNCTION IF EXISTS encrypt_token, decrypt_token, test_encryption;
--
-- USAGE EXAMPLES:
--
-- -- Encrypt token before saving (application layer)
-- SELECT encrypt_token('my_access_token', $ENCRYPTION_KEY);
--
-- -- Decrypt token when needed (application layer)
-- SELECT decrypt_token(access_token, $ENCRYPTION_KEY) FROM oauth_accounts WHERE id = '...';
--
-- -- Test encryption is working
-- SELECT * FROM test_encryption();

-- ================================================================
-- TOKEN MIGRATION STRATEGY
-- ================================================================
--
-- For existing OAuth accounts with plain text tokens:
--
-- 1. Application layer re-encryption:
--    - Query accounts with plain text tokens
--    - Re-encrypt with new encryption functions
--    - Update records with encrypted tokens
--
-- 2. Gradual migration approach:
--    - Phase 1: Deploy encryption functions (non-breaking)
--    - Phase 2: Re-authenticate users to get fresh tokens
--    - Phase 3: New tokens automatically encrypted
--    - Phase 4: Plain text tokens naturally expire
--
-- 3. Migration query example:
--    SELECT
--      id, provider,
--      encrypt_token(access_token, $ENCRYPTION_KEY) as new_token,
--      encrypt_token(refresh_token, $ENCRYPTION_KEY) as new_refresh
--    FROM oauth_accounts
--    WHERE access_token IS NOT NULL;
--
-- ================================================================

-- ================================================================
-- DATABASE ACCESS CONTROL RECOMMENDATIONS
-- ================================================================
--
-- REVOKE EXECUTE ON ENCRYPTION FUNCTIONS FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION encrypt_token TO application_user;
-- GRANT EXECUTE ON FUNCTION decrypt_token TO application_user;
--
-- Consider Row-Level Security (RLS) for multi-tenant isolation:
-- ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY oauth_accounts_user_isolation ON oauth_accounts
--   FOR ALL USING (user_id = current_user_id());
--
-- ================================================================