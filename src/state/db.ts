import { readFileSync } from 'fs';
import { join } from 'path';
import type { Address, PendingReward, ClaimBundle, TxResult } from '../types/common.js';
import { MemoryDatabase } from './memoryDb.js';

// Import better-sqlite3 dynamically to handle load failures
let Database: any = null;
let sqliteAvailable = false;

try {
  Database = require('better-sqlite3');
  sqliteAvailable = true;
} catch (error: any) {
  console.warn('⚠️  better-sqlite3 failed to load:', error.message);
  console.warn('⚠️  Falling back to in-memory database. Data will not persist between restarts.');
  sqliteAvailable = false;
}

// Database type that can be either SQLite or Memory
type DatabaseInstance = any; // This will be either Database.Database or MemoryDatabase

export interface DbDiagnostics {
  type: 'sqlite' | 'memory';
  available: boolean;
  path?: string;
  error?: string;
}

export interface WalletRecord {
  id: number;
  address: string;
  chain: string;
  first_seen_at: string;
  last_claim_at?: string;
  total_claimed_usd: number;
}

export interface PendingRewardRecord {
  id: string;
  wallet_address: string;
  wallet_chain: string;
  protocol: string;
  token_address: string;
  token_chain: string;
  amount_wei: string;
  amount_usd: number;
  claim_to_address: string;
  claim_to_chain: string;
  discovered_at: string;
  last_claim_at?: string;
  is_stale: boolean;
}

export interface ExecutionRecord {
  id: string;
  bundle_id: string;
  chain: string;
  protocol: string;
  claim_to_address: string;
  claim_to_chain: string;
  total_usd: number;
  est_gas_usd: number;
  net_usd: number;
  item_count: number;
  success: boolean;
  tx_hash?: string;
  error_message?: string;
  gas_used?: string;
  actual_gas_usd?: number;
  actual_claimed_usd?: number;
  executed_at: string;
}

let dbInstance: DatabaseInstance | null = null;
let dbDiagnostics: DbDiagnostics = {
  type: sqliteAvailable ? 'sqlite' : 'memory',
  available: sqliteAvailable
};

// Reset function for testing
export function resetDb(): void {
  dbInstance = null;
  dbDiagnostics = {
    type: sqliteAvailable ? 'sqlite' : 'memory',
    available: sqliteAvailable
  };
}

export function initDb(dbPath: string): DatabaseInstance {
  if (dbInstance) {
    return dbInstance;
  }

  // Check if user is forcing memory database
  const forceMemory = process.env.FORCE_MEMORY_DB === 'true';
  
  if (forceMemory) {
    console.warn('🔧 FORCE_MEMORY_DB=true: Using in-memory database by user request');
    dbInstance = new MemoryDatabase();
    dbDiagnostics = {
      type: 'memory',
      available: true,
      path: ':memory:'
    };
    return dbInstance;
  }

  // Try SQLite first, fallback to memory
  if (sqliteAvailable) {
    try {
      dbInstance = new Database(dbPath);
      dbInstance.pragma('journal_mode = WAL');
      dbInstance.pragma('synchronous = NORMAL');
      
      dbDiagnostics = {
        type: 'sqlite',
        available: true,
        path: dbPath
      };
      
      console.log('✅ Using SQLite database:', dbPath);
      return dbInstance;
    } catch (error: any) {
      console.error('❌ Failed to initialize SQLite database:', error.message);
      console.warn('⚠️  Falling back to in-memory database');
      
      dbDiagnostics = {
        type: 'memory',
        available: true,
        path: ':memory:',
        error: error.message
      };
    }
  }

  // Fallback to memory database
  dbInstance = new MemoryDatabase();
  console.warn('📝 Using in-memory database. Data will not persist between restarts.');
  
  return dbInstance;
}

export function initSchema(db: DatabaseInstance): void {
  const schemaPath = join(__dirname, 'schema.sql');
  try {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  } catch (error) {
    // If we can't find the schema file, create tables manually
    db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        chain TEXT NOT NULL,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_claim_at DATETIME,
        total_claimed_usd REAL DEFAULT 0,
        UNIQUE(address, chain)
      );

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
        is_stale BOOLEAN DEFAULT FALSE
      );

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
    `);
  }
}

export function getDb(): DatabaseInstance {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

export function getDiagnostics(): DbDiagnostics {
  return { ...dbDiagnostics };
}

export function upsertWallet(db: DatabaseInstance, wallet: Address): void {
  const stmt = db.prepare(`
    INSERT INTO wallets (address, chain) 
    VALUES (?, ?)
    ON CONFLICT(address, chain) DO NOTHING
  `);
  stmt.run(wallet.value, wallet.chain);
}

export function recordPending(db: DatabaseInstance, reward: PendingReward): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO pending_rewards (
      id, wallet_address, wallet_chain, protocol, token_address, token_chain,
      amount_wei, amount_usd, claim_to_address, claim_to_chain, discovered_at, last_claim_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    reward.id,
    reward.wallet.value,
    reward.wallet.chain,
    reward.protocol,
    reward.token.value,
    reward.token.chain,
    reward.amountWei,
    reward.amountUsd,
    reward.claimTo.value,
    reward.claimTo.chain,
    reward.discoveredAt.toISOString(),
    reward.lastClaimAt?.toISOString() || null
  );
}

export function recordExecution(
  db: DatabaseInstance,
  bundle: ClaimBundle,
  result: TxResult
): void {
  const stmt = db.prepare(`
    INSERT INTO executions (
      id, bundle_id, chain, protocol, claim_to_address, claim_to_chain,
      total_usd, est_gas_usd, net_usd, item_count, success, tx_hash,
      error_message, gas_used, actual_gas_usd, actual_claimed_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Coerce / sanitize values for SQLite binding
  const successInt = result.success ? 1 : 0;
  const totalUsd = Number(bundle.totalUsd) || 0;
  const estGasUsd = bundle.estGasUsd != null ? Number(bundle.estGasUsd) : null;
  const netUsd = Number(bundle.netUsd) || 0;
  const itemCount = bundle.items.length;
  const txHash = result.txHash ?? null;
  const errorMsg = result.error ?? null;
  // Allow bigint or number; if something else arrives (e.g. a BN-like object), convert to string
  let gasUsed: any = result.gasUsed ?? null;
  if (gasUsed && typeof gasUsed !== 'bigint' && typeof gasUsed !== 'number' && typeof gasUsed !== 'string') {
    gasUsed = gasUsed.toString();
  }
  const gasUsd = result.gasUsd != null ? Number(result.gasUsd) : null;
  const claimedUsd = result.claimedUsd != null ? Number(result.claimedUsd) : null;

  stmt.run(
    bundle.id,
    bundle.id,                 // bundle_id
    bundle.chain,
    bundle.protocol,
    bundle.claimTo.value,
    bundle.claimTo.chain,
    totalUsd,
    estGasUsd,
    netUsd,
    itemCount,
    successInt,
    txHash,
    errorMsg,
    gasUsed,
    gasUsd,
    claimedUsd
  );
}

export function markClaimed(
  db: DatabaseInstance, 
  rewardIds: string[], 
  claimedAt: Date = new Date()
): void {
  const stmt = db.prepare(`
    UPDATE pending_rewards 
    SET is_stale = TRUE, last_claim_at = ?
    WHERE id = ?
  `);

  const transaction = db.transaction((ids: string[]) => {
    for (const id of ids) {
      stmt.run(claimedAt.toISOString(), id);
    }
  });

  transaction(rewardIds);
}

export function getWalletLastClaim(db: DatabaseInstance, wallet: Address): Date | null {
  const stmt = db.prepare(`
    SELECT last_claim_at FROM wallets 
    WHERE address = ? AND chain = ?
  `);
  
  const result = stmt.get(wallet.value, wallet.chain) as WalletRecord | undefined;
  return result?.last_claim_at ? new Date(result.last_claim_at) : null;
}

export function getRecentExecutions(db: DatabaseInstance, hoursBack: number = 24): ExecutionRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM executions 
    WHERE executed_at > datetime('now', '-${hoursBack} hours')
    ORDER BY executed_at DESC
  `);
  
  return stmt.all() as ExecutionRecord[];
}
