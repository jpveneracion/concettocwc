-- Migration: Add Admin Role Support
-- Date: 2026-07-12
-- Description: Add role-based access control for admin functionality

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Add constraints for valid roles (skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_role'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_role CHECK (role IN ('user', 'admin', 'superadmin'));
  END IF;
END $$;

-- Set first user as superadmin (for initial setup)
-- This finds the earliest created user and sets them as superadmin
UPDATE users
SET role = 'superadmin', is_admin = true
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
AND role = 'user';

-- Add comments for documentation
COMMENT ON COLUMN users.role IS 'User role: user, admin, or superadmin';
COMMENT ON COLUMN users.is_admin IS 'Quick check for admin permissions (indexed for performance)';
COMMENT ON TABLE users IS 'User accounts with role-based access control and subscription management';