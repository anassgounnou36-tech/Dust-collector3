"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDb = resetDb;
exports.initDb = initDb;
exports.initSchema = initSchema;
exports.getDb = getDb;
exports.getDiagnostics = getDiagnostics;
exports.upsertWallet = upsertWallet;
exports.recordPending = recordPending;
exports.recordExecution = recordExecution;
exports.markClaimed = markClaimed;
exports.getWalletLastClaim = getWalletLastClaim;
exports.getRecentExecutions = getRecentExecutions;
const fs_1 = require("fs");
const path_1 = require("path");
const memoryDb_js_1 = require("./memoryDb.js");
// Import better-sqlite3 dynamically to handle load failures
let Database = null;
let sqliteAvailable = false;
try {
    Database = require('better-sqlite3');
    sqliteAvailable = true;
}
catch (error) {
    console.warn('⚠️  better-sqlite3 failed to load:', error.message);
    console.warn('⚠️  Falling back to in-memory database. Data will not persist between restarts.');
    sqliteAvailable = false;
}
let dbInstance = null;
let dbDiagnostics = {
    type: sqliteAvailable ? 'sqlite' : 'memory',
    available: sqliteAvailable
};
// Reset function for testing
function resetDb() {
    dbInstance = null;
    dbDiagnostics = {
        type: sqliteAvailable ? 'sqlite' : 'memory',
        available: sqliteAvailable
    };
}
function initDb(dbPath) {
    if (dbInstance) {
        return dbInstance;
    }
    // Check if user is forcing memory database
    const forceMemory = process.env.FORCE_MEMORY_DB === 'true';
    if (forceMemory) {
        console.warn('🔧 FORCE_MEMORY_DB=true: Using in-memory database by user request');
        dbInstance = new memoryDb_js_1.MemoryDatabase();
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
        }
        catch (error) {
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
    dbInstance = new memoryDb_js_1.MemoryDatabase();
    console.warn('📝 Using in-memory database. Data will not persist between restarts.');
    return dbInstance;
}
function initSchema(db) {
    const schemaPath = (0, path_1.join)(__dirname, 'schema.sql');
    try {
        const schema = (0, fs_1.readFileSync)(schemaPath, 'utf-8');
        db.exec(schema);
    }
    catch (error) {
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
function getDb() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return dbInstance;
}
function getDiagnostics() {
    return { ...dbDiagnostics };
}
function upsertWallet(db, wallet) {
    const stmt = db.prepare(`
    INSERT INTO wallets (address, chain) 
    VALUES (?, ?)
    ON CONFLICT(address, chain) DO NOTHING
  `);
    stmt.run(wallet.value, wallet.chain);
}
function recordPending(db, reward) {
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO pending_rewards (
      id, wallet_address, wallet_chain, protocol, token_address, token_chain,
      amount_wei, amount_usd, claim_to_address, claim_to_chain, discovered_at, last_claim_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(reward.id, reward.wallet.value, reward.wallet.chain, reward.protocol, reward.token.value, reward.token.chain, reward.amountWei, reward.amountUsd, reward.claimTo.value, reward.claimTo.chain, reward.discoveredAt.toISOString(), reward.lastClaimAt?.toISOString() || null);
}
function recordExecution(db, bundle, result) {
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
    let gasUsed = result.gasUsed ?? null;
    if (gasUsed && typeof gasUsed !== 'bigint' && typeof gasUsed !== 'number' && typeof gasUsed !== 'string') {
        gasUsed = gasUsed.toString();
    }
    const gasUsd = result.gasUsd != null ? Number(result.gasUsd) : null;
    const claimedUsd = result.claimedUsd != null ? Number(result.claimedUsd) : null;
    stmt.run(bundle.id, bundle.id, // bundle_id
    bundle.chain, bundle.protocol, bundle.claimTo.value, bundle.claimTo.chain, totalUsd, estGasUsd, netUsd, itemCount, successInt, txHash, errorMsg, gasUsed, gasUsd, claimedUsd);
}
function markClaimed(db, rewardIds, claimedAt = new Date()) {
    const stmt = db.prepare(`
    UPDATE pending_rewards 
    SET is_stale = TRUE, last_claim_at = ?
    WHERE id = ?
  `);
    const transaction = db.transaction((ids) => {
        for (const id of ids) {
            stmt.run(claimedAt.toISOString(), id);
        }
    });
    transaction(rewardIds);
}
function getWalletLastClaim(db, wallet) {
    const stmt = db.prepare(`
    SELECT last_claim_at FROM wallets 
    WHERE address = ? AND chain = ?
  `);
    const result = stmt.get(wallet.value, wallet.chain);
    return result?.last_claim_at ? new Date(result.last_claim_at) : null;
}
function getRecentExecutions(db, hoursBack = 24) {
    const stmt = db.prepare(`
    SELECT * FROM executions 
    WHERE executed_at > datetime('now', '-${hoursBack} hours')
    ORDER BY executed_at DESC
  `);
    return stmt.all();
}
//# sourceMappingURL=db.js.map