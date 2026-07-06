-- Add email_hash column for searchable authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT;

-- Create index for fast login queries
CREATE INDEX IF NOT EXISTS users_email_hash_idx ON users(email_hash);

-- Populate email_hash for existing users from encrypted emails
-- This requires Node.js to decrypt first, so run the fix script after this migration