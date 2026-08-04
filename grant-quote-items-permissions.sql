-- Grant permissions for concetto_boms role on quote_items table
-- This is necessary for the RLS policies to work properly with the correct role

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA public TO concetto_boms;

-- Grant table permissions
GRANT SELECT ON quote_items TO concetto_boms;
GRANT INSERT ON quote_items TO concetto_boms;
GRANT UPDATE ON quote_items TO concetto_boms;
GRANT DELETE ON quote_items TO concetto_boms;

-- Grant sequence usage (for the gen_random_uuid() default)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO concetto_boms;

-- Grant execute permissions on RLS functions
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID, TEXT) TO concetto_boms;
GRANT EXECUTE ON FUNCTION get_current_company_id() TO concetto_boms;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO concetto_boms;
GRANT EXECUTE ON FUNCTION reset_tenant_context() TO concetto_boms;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO concetto_boms;
GRANT EXECUTE ON FUNCTION is_current_user_superadmin() TO concetto_boms;
GRANT EXECUTE ON FUNCTION test_quote_items_rls() TO concetto_boms;
GRANT EXECUTE ON FUNCTION audit_quote_items_security() TO concetto_boms;

-- Verify permissions
SELECT
    grantee,
    table_name,
    privilege_type
FROM
    information_schema.role_table_grants
WHERE
    table_name = 'quote_items'
    AND grantee = 'concetto_boms';