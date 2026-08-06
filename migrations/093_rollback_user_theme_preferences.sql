-- Rollback 093: Remove user theme preferences
-- No RLS policies to drop (existing users_self_isolation covers this column).

ALTER TABLE users DROP COLUMN IF EXISTS theme_preference;
