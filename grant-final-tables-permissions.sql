-- Grant Permissions for Final Tables RLS Implementation
-- This script grants necessary permissions to concetto_boms role
-- for the remaining tables that need RLS implementation
-- Run this as a superuser (e.g., neondb_owner)

-- Grant permissions on password_reset_tokens
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE password_reset_tokens TO concetto_boms;

-- Grant permissions on payment_settings
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payment_settings TO concetto_boms;

-- Grant permissions on pricing_config
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pricing_config TO concetto_boms;

-- Grant permissions on pricing_history
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pricing_history TO concetto_boms;

-- Grant permissions on webhook_events
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE webhook_events TO concetto_boms;

-- Grant usage on sequences for these tables (if they have sequences)
-- (password_reset_tokens, payment_settings, pricing_config, pricing_history, webhook_events use UUIDs, so no sequences needed)

-- Verify permissions were granted
SELECT
    table_name,
    privilege_type,
    'GRANTED' as status
FROM
    information_schema.role_table_grants
WHERE
    grantee = 'concetto_boms'
    AND table_name IN ('password_reset_tokens', 'payment_settings', 'pricing_config', 'pricing_history', 'webhook_events')
ORDER BY
    table_name,
    privilege_type;