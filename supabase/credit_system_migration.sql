-- Credit System Migration
-- Adds transaction history table and tracking columns to profiles

-- Create credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,  -- Positive for earnings, negative for spending
    type VARCHAR(50) NOT NULL,       -- spend_standard, spend_hd, spend_batch, earn_daily_login, earn_share, earn_community, purchase, bonus
    balance_after DECIMAL(10, 2),
    metadata JSONB,                  -- Additional data like generation_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_transaction_type CHECK (type IN (
        'spend_standard', 'spend_hd', 'spend_batch',
        'earn_daily_login', 'earn_share', 'earn_community',
        'purchase', 'bonus'
    ))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);

-- Add tracking columns to profiles
ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS last_daily_login TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS credits DECIMAL(10, 2) DEFAULT 0;

-- Update existing profiles to have 10 credits if they have 0 or null
UPDATE profiles 
SET credits = 10 
WHERE credits IS NULL OR credits = 0;

-- Enable RLS on credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own transactions
CREATE POLICY credit_transactions_select_policy ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy for system to insert transactions (via service role)
CREATE POLICY credit_transactions_insert_policy ON credit_transactions
    FOR INSERT WITH CHECK (true);  -- Service role will handle validation

-- Grant permissions
GRANT SELECT, INSERT ON credit_transactions TO authenticated;
GRANT SELECT, INSERT ON credit_transactions TO service_role;

-- Update Comments
COMMENT ON TABLE credit_transactions IS 'Tracks all credit transactions (spending and earning)';
COMMENT ON COLUMN credit_transactions.amount IS 'Positive for earnings, negative for spending';
COMMENT ON COLUMN credit_transactions.type IS 'Type of transaction: spend_*, earn_*, purchase, bonus';
