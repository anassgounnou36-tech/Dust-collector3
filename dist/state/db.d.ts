import type { Address, PendingReward, ClaimBundle, TxResult } from '../types/common.js';
type DatabaseInstance = any;
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
export declare function resetDb(): void;
export declare function initDb(dbPath: string): DatabaseInstance;
export declare function initSchema(db: DatabaseInstance): void;
export declare function getDb(): DatabaseInstance;
export declare function getDiagnostics(): DbDiagnostics;
export declare function upsertWallet(db: DatabaseInstance, wallet: Address): void;
export declare function recordPending(db: DatabaseInstance, reward: PendingReward): void;
export declare function recordExecution(db: DatabaseInstance, bundle: ClaimBundle, result: TxResult): void;
export declare function markClaimed(db: DatabaseInstance, rewardIds: string[], claimedAt?: Date): void;
export declare function getWalletLastClaim(db: DatabaseInstance, wallet: Address): Date | null;
export declare function getRecentExecutions(db: DatabaseInstance, hoursBack?: number): ExecutionRecord[];
export {};
//# sourceMappingURL=db.d.ts.map