// Run Trial System Migration
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log('🔄 Running trial system migration...');

  try {
    // Check if activation_codes table already exists
    const existingTable = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'activation_codes';
    `;

    if (existingTable.length > 0) {
      console.log('⚠️  activation_codes table already exists, skipping...');
    } else {
      console.log('Creating activation_codes table...');

      // Create activation_codes table
      await sql`
        CREATE TABLE activation_codes (
          id SERIAL PRIMARY KEY,
          code VARCHAR(255) UNIQUE NOT NULL,
          discount_percent DECIMAL(5,2) NOT NULL,
          applicable_plans JSONB NOT NULL DEFAULT '["monthly","quarterly","annual"]',

          -- Payment tracking
          payment_amount DECIMAL(10,2),
          payment_currency VARCHAR(10) DEFAULT 'PHP',
          payment_amount_usd DECIMAL(10,2),
          payment_method VARCHAR(50),
          exchange_rate DECIMAL(10,4),
          payment_reference VARCHAR(255),
          payment_date TIMESTAMP,
          wallet_address VARCHAR(255),
          bank_reference VARCHAR(255),

          -- Lifecycle tracking
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          used_by UUID REFERENCES users(id),
          used_at TIMESTAMP,
          used_ip_address VARCHAR(45),
          is_active BOOLEAN DEFAULT true,

          -- Campaign tracking
          campaign_name VARCHAR(255),
          notes TEXT,
          status_history JSONB DEFAULT '[]'
        );
      `;
      console.log('✅ activation_codes table created');
    }

    // Create indexes for performance
    console.log('Creating indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);',
      'CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(is_active, used_by);',
      'CREATE INDEX IF NOT EXISTS idx_activation_codes_created_at ON activation_codes(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_activation_codes_used_by ON activation_codes(used_by);',
      'CREATE INDEX IF NOT EXISTS idx_users_trial_expires ON users(trial_expires_at);',
      'CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_activated, trial_expires_at);'
    ];

    for (const indexSQL of indexes) {
      try {
        await sql.query(indexSQL);
        console.log(`✅ Created index: ${indexSQL.substring(0, 50)}...`);
      } catch (error) {
        console.log(`⚠️  Index already exists or error: ${error.message}`);
      }
    }

    // Set existing users to active (grandfather clause)
    console.log('Setting existing users to active...');
    await sql`
      UPDATE users
      SET subscription_activated = true
      WHERE created_at < NOW() AND subscription_activated IS NULL;
    `;
    console.log('✅ Existing users set to active');

    // Add comments for documentation
    console.log('Adding table comments...');

    const comments = [
      "COMMENT ON COLUMN users.trial_expires_at IS 'Timestamp when 3-day trial expires';",
      "COMMENT ON COLUMN users.subscription_activated IS 'Whether user has activated subscription with code';",
      "COMMENT ON COLUMN users.activation_code IS 'Activation code used to activate subscription';",
      "COMMENT ON COLUMN users.discount_percent IS 'Discount percentage for subscription (15, 25, 35, etc.)';",
      "COMMENT ON COLUMN users.subscription_plan IS 'Plan type: monthly, quarterly, or annual';",
      "COMMENT ON COLUMN activation_codes.code IS 'Unique activation code for subscription';",
      "COMMENT ON COLUMN activation_codes.discount_percent IS 'Discount percentage applied to subscription (15, 25, 35, etc.)';",
      "COMMENT ON COLUMN activation_codes.applicable_plans IS 'JSON array of subscription plans this code can be applied to';",
      "COMMENT ON COLUMN activation_codes.payment_amount IS 'Payment amount in original currency';",
      "COMMENT ON COLUMN activation_codes.payment_currency IS 'Currency code for payment amount (e.g., PHP, USD)';",
      "COMMENT ON COLUMN activation_codes.payment_amount_usd IS 'Payment amount converted to USD';",
      "COMMENT ON COLUMN activation_codes.payment_method IS 'Payment method: gcash, crypto, usd_bank, other';",
      "COMMENT ON COLUMN activation_codes.exchange_rate IS 'Exchange rate used to convert to USD';",
      "COMMENT ON COLUMN activation_codes.payment_reference IS 'Reference number from payment provider';",
      "COMMENT ON COLUMN activation_codes.payment_date IS 'Timestamp when payment was completed';",
      "COMMENT ON COLUMN activation_codes.wallet_address IS 'Crypto wallet address for crypto payments';",
      "COMMENT ON COLUMN activation_codes.bank_reference IS 'Bank transaction reference for bank payments';",
      "COMMENT ON COLUMN activation_codes.status_history IS 'Audit trail of status changes';"
    ];

    for (const commentSQL of comments) {
      try {
        await sql.query(commentSQL);
        console.log(`✅ Added comment: ${commentSQL.substring(0, 50)}...`);
      } catch (error) {
        console.log(`⚠️  Comment already exists or error: ${error.message}`);
      }
    }

    console.log('✅ Trial system migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();