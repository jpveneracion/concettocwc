-- Comprehensive permissions grant for concetto_boms role
-- This ensures concetto_boms can access all necessary tables and functions

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA public TO concetto_boms;

-- Grant permissions on ALL tables (current and future)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO concetto_boms;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO concetto_boms;
GRANT UPDATE ON ALL TABLES IN SCHEMA public TO concetto_boms;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO concetto_boms;

-- Alter default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO concetto_boms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO concetto_boms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO concetto_boms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO concetto_boms;

-- Grant sequence usage
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO concetto_boms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO concetto_boms;

-- Grant execute on ALL functions (RLS foundation + test functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO concetto_boms;

-- Verify permissions on key tables
SELECT
    grantee,
    table_name,
    string_agg(privilege_type, ', ') as privileges
FROM
    information_schema.role_table_grants
WHERE
    grantee = 'concetto_boms'
    AND table_name IN ('quote_items', 'quotes', 'companies', 'users')
GROUP BY
    grantee, table_name
ORDER BY
    table_name;