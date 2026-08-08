-- migrations/097_create_pi_payments_table.sql

-- Pi Network payment tracking table
-- Mirrors the payment_verifications pattern (company-scoped, app-managed RLS context)
CREATE TABLE IF NOT EXISTS pi_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  amount_pi NUMERIC(20,6) NOT NULL,
  amount_php NUMERIC(20,2) NOT NULL,
  memo TEXT,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  txid TEXT,
  subscription_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_pi_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_payment_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_payment_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
  CONSTRAINT valid_pi_payment_status CHECK (status IN ('created', 'approved', 'completed', 'cancelled', 'error'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pi_payments_user_id ON pi_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_payments_company_id ON pi_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_pi_payments_plan_id ON pi_payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_pi_payments_status ON pi_payments(status);
CREATE INDEX IF NOT EXISTS idx_pi_payments_created_at ON pi_payments(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE pi_payments IS 'Tracks Pi Network SDK payments (create/approve/complete lifecycle)';
COMMENT ON COLUMN pi_payments.payment_id IS 'Pi platform payment ID from the SDK payment object';
COMMENT ON COLUMN pi_payments.amount_pi IS 'Amount charged in Pi (USD-denominated, 1 Pi = 1 USD equivalent)';
COMMENT ON COLUMN pi_payments.amount_php IS 'Equivalent PHP amount at time of purchase';
COMMENT ON COLUMN pi_payments.metadata IS 'SDK metadata (plan_id, promo_code) relayed from the payment object';
COMMENT ON COLUMN pi_payments.status IS 'created, approved, completed, cancelled, or error';
COMMENT ON COLUMN pi_payments.txid IS 'Pi transaction hash returned on completion';
COMMENT ON COLUMN pi_payments.subscription_id IS 'Subscription row created when the payment completes';
