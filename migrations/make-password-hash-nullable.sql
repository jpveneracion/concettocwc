-- Make password_hash nullable to support OAuth-only users
-- OAuth users authenticate via OAuth providers and don't need passwords

-- First, update existing OAuth users to have a dummy password (temporary)
UPDATE users
SET password_hash = crypt('OAUTH_USER_NO_PASSWORD', gen_salt('bf'))
WHERE password_hash IS NULL;

-- Then make the column nullable
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add a column to track if user is OAuth-only
ALTER TABLE users ADD COLUMN is_oauth_user BOOLEAN DEFAULT FALSE;

-- Update users with OAuth accounts to be marked as OAuth users
UPDATE users
SET is_oauth_user = TRUE
WHERE id IN (SELECT DISTINCT user_id FROM oauth_accounts);