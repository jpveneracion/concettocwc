-- Grant Permissions for concetto_boms Role
-- This script grants necessary permissions to the concetto_boms role
-- Run this as a superuser (e.g., neondb_owner)

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO concetto_boms;

-- Grant permissions on core tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE company_product_definitions TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE quotes TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE companies TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE company_collections TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE company_products TO concetto_boms;

-- Grant permissions on additional tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE activation_codes TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gcash_webhook_data TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE invoices TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE oauth_accounts TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE onboarding_progress TO concetto_boms;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gateway_device_heartbeat TO concetto_boms;

-- Grant usage on sequences (for ID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO concetto_boms;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO concetto_boms;

-- Verify permissions
SELECT
    table_name,
    privilege_type
FROM
    information_schema.role_table_grants
WHERE
    grantee = 'concetto_boms'
ORDER BY
    table_name,
    privilege_type;