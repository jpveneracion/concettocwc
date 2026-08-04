#!/bin/bash
# Apply fixed role context validation migrations

echo "🔧 Applying Fixed Role Context Validation Migrations"
echo "============================================================"

# Apply the fixed migrations in order
echo "Applying Migration 050 (fixed)..."
psql $DATABASE_URL -f migrations/050_fix_authentication_functions_security.sql

echo "Applying Migration 051 (fixed)..."
psql $DATABASE_URL -f migrations/051_fix_company_data_functions_security.sql

echo "Applying Migration 053 (fixed)..."
psql $DATABASE_URL -f migrations/053_fix_remaining_functions_security.sql

echo ""
echo "✅ All fixed migrations applied"
echo "============================================================"
echo "Next: Run end-to-end security tests to verify fixes"