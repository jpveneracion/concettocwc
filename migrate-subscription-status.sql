-- Add subscription_status column to companies table
ALTER TABLE companies
ADD COLUMN subscription_status VARCHAR(20)
DEFAULT 'demo'
CHECK (subscription_status IN ('demo', 'trial', 'active', 'past_due'));

-- Update existing companies to have 'demo' status
UPDATE companies SET subscription_status = 'demo' WHERE subscription_status IS NULL;

-- Create index for faster subscription status queries
CREATE INDEX idx_companies_subscription_status ON companies(subscription_status);
