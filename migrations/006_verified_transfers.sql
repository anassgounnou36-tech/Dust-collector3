-- Migration 006: Add verified transfers table and execution enhancements
-- This migration adds support for verified payout tracking and enhanced execution metrics

-- Create table to store verified transfer events from executions
CREATE TABLE IF NOT EXISTS execution_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);

-- Add new columns to executions table for verified payouts and enhanced metrics
ALTER TABLE executions ADD COLUMN verified_payout BOOLEAN DEFAULT FALSE;
ALTER TABLE executions ADD COLUMN total_usd REAL; -- Actual realized value from verified transfers
ALTER TABLE executions ADD COLUMN gas_usd REAL; -- Actual gas cost in USD
ALTER TABLE executions ADD COLUMN net_usd REAL; -- Actual net profit (total_usd - gas_usd)

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_execution_transfers_execution_id ON execution_transfers(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_transfers_tx_hash ON execution_transfers(tx_hash);
CREATE INDEX IF NOT EXISTS idx_executions_verified_payout ON executions(verified_payout);
CREATE INDEX IF NOT EXISTS idx_executions_net_usd ON executions(net_usd);

-- Update existing executions to have default verified_payout = FALSE
-- (ALTER TABLE ADD COLUMN already sets this, but being explicit)
UPDATE executions SET verified_payout = FALSE WHERE verified_payout IS NULL;