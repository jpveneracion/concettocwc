-- migrations/001_create_payment_verifications_table.sql

-- Create payment_verifications table
CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id VARCHAR(255) NOT NULL,
  screenshot_url TEXT NOT NULL,
  reference_number VARCHAR(255),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  admin_id UUID,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,

  -- Check constraint for status values
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_verifications_user_id ON payment_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_plan_id ON payment_verifications(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_status ON payment_verifications(status);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_submitted_at ON payment_verifications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_reference_number ON payment_verifications(reference_number);

-- Create composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_payment_verifications_admin_dashboard
ON payment_verifications(status, submitted_at DESC)
WHERE status = 'pending';

-- Add comments for documentation
COMMENT ON TABLE payment_verifications IS 'Stores payment verification submissions and their approval status';
COMMENT ON COLUMN payment_verifications.screenshot_url IS 'IPFS CID or gateway URL for payment proof screenshot';
COMMENT ON COLUMN payment_verifications.reference_number IS 'Optional transaction reference from payment provider';
COMMENT ON COLUMN payment_verifications.notes IS 'Optional notes from subscriber';
COMMENT ON COLUMN payment_verifications.admin_notes IS 'Notes from admin when approving/rejecting';
COMMENT ON COLUMN payment_verifications.status IS 'pending, approved, rejected, or expired';