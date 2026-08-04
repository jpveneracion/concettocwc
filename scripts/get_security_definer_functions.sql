-- Get current SECURITY DEFINER functions from the database
SELECT
    routine_name,
    routine_type,
    data_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND security_type = 'DEFINER'
ORDER BY routine_name;