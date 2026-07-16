// Run with: node src/lib/migrate-payment-verifications-fix.js
// Migration: Fix payment_verifications.plan_id data type mismatch
// Changes plan_id from VARCHAR(255) to UUID to match subscription_plans.id

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running migration: Fix payment_verifications.plan_id data type...');

  try {
    // Step 1: Add a temporary UUID column to safely convert existing data
    console.log('Step 1: Adding temporary UUID column...');
    await sql`
      ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS plan_id_new UUID
    `;

    // Step 2: Migrate existing data from VARCHAR to UUID
    console.log('Step 2: Migrating existing data from VARCHAR to UUID...');
    await sql`
      UPDATE payment_verifications
      SET plan_id_new = plan_id::UUID
      WHERE plan_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `;

    // Step 3: Drop the old VARCHAR column
    console.log('Step 3: Dropping old VARCHAR column...');
    await sql`
      ALTER TABLE payment_verifications DROP COLUMN plan_id
    `;

    // Step 4: Rename the new UUID column to plan_id
    console.log('Step 4: Renaming new UUID column to plan_id...');
    await sql`
      ALTER TABLE payment_verifications RENAME COLUMN plan_id_new TO plan_id
    `;

    // Step 5: Set NOT NULL constraint on the new plan_id column
    console.log('Step 5: Setting NOT NULL constraint...');
    await sql`
      ALTER TABLE payment_verifications ALTER COLUMN plan_id SET NOT NULL
    `;

    // Step 6: Re-create the index on plan_id for efficient queries
    console.log('Step 6: Re-creating index on plan_id...');
    await sql`
      DROP INDEX IF EXISTS idx_payment_verifications_plan_id
    `;
    await sql`
      CREATE INDEX idx_payment_verifications_plan_id ON payment_verifications(plan_id)
    `;

    // Step 7: Add foreign key constraint to subscription_plans table
    console.log('Step 7: Adding foreign key constraint to subscription_plans...');
    await sql`
      ALTER TABLE payment_verifications
      ADD CONSTRAINT fk_payment_verifications_plan_id
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
    `;

    // Add comment for documentation
    await sql`
      COMMENT ON COLUMN payment_verifications.plan_id IS 'UUID reference to subscription_plans table'
    `;

    console.log('✅ Migration complete: payment_verifications.plan_id is now UUID type');
    console.log('✅ JOIN operations between payment_verifications and subscription_plans should now work properly');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();