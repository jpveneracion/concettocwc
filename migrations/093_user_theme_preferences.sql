-- Migration 093: Add user theme preferences
-- Stores per-user theme selection and custom color overrides.
--
-- RLS NOTE: No new policies are created. The existing users_self_isolation policy
-- (015_enable_rls_users_oauth.sql) already scopes ALL row access on users to the
-- current user (id = get_current_user_id(), with admin/superadmin exceptions),
-- which covers the new theme_preference column. Adding permissive OR-policies
-- here would dilute that isolation.

-- Add theme_preference column to users table
ALTER TABLE users
ADD COLUMN theme_preference JSONB NULL DEFAULT NULL;

-- Add CHECK constraint for valid JSON
ALTER TABLE users
ADD CONSTRAINT theme_preference_valid_json
CHECK (theme_preference IS NULL OR jsonb_typeof(theme_preference) = 'object');

-- Add comment for documentation
COMMENT ON COLUMN users.theme_preference IS
'User theme preference: { themeId: string, mode: "light"|"dark"|"system", customTokens?: Partial<ThemeTokens> }';
