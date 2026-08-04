-- Fix permissions for concetto_boms role
-- This grants comprehensive permissions to enable proper RLS testing

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO concetto_boms;

-- Grant permissions on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO concetto_boms;

-- Grant permissions on all existing sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO concetto_boms;

-- Grant execute on all functions (including RLS functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO concetto_boms;

-- Ensure new tables created in future also get permissions (optional)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO concetto_boms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO concetto_boms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO concetto_boms;

-- Verify permissions
SELECT
    tablename,
    privilege_type
FROM
    information_schema.table_privileges
WHERE
    grantee = 'concetto_boms'
    AND table_schema = 'public'
ORDER BY
    tablename, privilege_type;