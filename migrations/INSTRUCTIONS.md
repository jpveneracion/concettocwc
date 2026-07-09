# Subscription System Migration Instructions

## Database Migration via Neon SQL Editor

Since the application database user doesn't have DDL permissions, you'll need to run the migration through the Neon SQL Editor:

### Steps:

1. **Open Neon Console**
   - Go to https://console.neon.tech/
   - Select your project
   - Navigate to "SQL Editor"

2. **Run the Migration**
   - Copy the contents of `migrations/subscription-system.sql`
   - Paste it into the SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify Tables Created**
   - Run this query to verify all tables were created:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('subscriptions', 'subscription_plans', 'invoices', 'webhook_events', 'subscription_items', 'payment_methods')
   ORDER BY table_name;
   ```

4. **Check Default Data**
   - Verify the default subscription plans were inserted:
   ```sql
   SELECT * FROM subscription_plans;
   ```

### Expected Results:

You should see these 6 tables:
- `subscription_plans` (with 2 rows: Basic and Pro plans)
- `subscriptions`
- `subscription_items`
- `invoices`
- `payment_methods`
- `webhook_events`

### Troubleshooting:

If you encounter any errors:
- Make sure pgcrypto extension is enabled: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
- Check that the `companies` table exists before running the migration
- Verify you have the necessary permissions to create tables and alter the `companies` table

### After Migration:

Once the migration is complete, the application will be able to:
- Manage subscription plans
- Create and track subscriptions
- Generate invoices
- Store payment methods
- Process PayMongo webhook events

The application user can then perform normal CRUD operations on these tables.