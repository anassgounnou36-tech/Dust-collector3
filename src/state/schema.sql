-- Create tables for the Cross-Protocol Dust Collector Bot

-- Wallets discovered and tracked
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_claim_at DATETIME,
  total_claimed_usd REAL DEFAULT 0,
  UNIQUE(address, chain)
);

-- Pending rewards discovered but not yet claimed
CREATE TABLE IF NOT EXISTS pending_rewards (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  wallet_chain TEXT NOT NULL,
  protocol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_chain TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  claim_to_address TEXT NOT NULL,
  claim_to_chain TEXT NOT NULL,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_claim_at DATETIME,
  is_stale BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (wallet_address, wallet_chain) REFERENCES wallets(address, chain)
);

-- Execution history of claim bundles
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  protocol TEXT NOT NULL,
  claim_to_address TEXT NOT NULL,
  claim_to_chain TEXT NOT NULL,
  total_usd REAL NOT NULL,
  est_gas_usd REAL NOT NULL,
  net_usd REAL NOT NULL,
  item_count INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  tx_hash TEXT,
  error_message TEXT,
  gas_used TEXT,
  actual_gas_usd REAL,
  actual_claimed_usd REAL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain);
CREATE INDEX IF NOT EXISTS idx_wallets_last_claim ON wallets(last_claim_at);
CREATE INDEX IF NOT EXISTS idx_pending_protocol ON pending_rewards(protocol);
CREATE INDEX IF NOT EXISTS idx_pending_discovered ON pending_rewards(discovered_at);
CREATE INDEX IF NOT EXISTS idx_pending_stale ON pending_rewards(is_stale);
CREATE INDEX IF NOT EXISTS idx_executions_protocol ON executions(protocol);
CREATE INDEX IF NOT EXISTS idx_executions_executed ON executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_executions_success ON executions(success);