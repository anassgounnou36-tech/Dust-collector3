import Database from 'better-sqlite3';
import type { ClaimBundle, TxResult } from '../types/common.js';
export declare function recordExecutionResult(db: Database.Database, bundle: ClaimBundle, result: TxResult): void;
export declare function updateWalletStats(db: Database.Database, walletAddress: string, walletChain: string, claimedUsd: number): void;
export declare function getExecutionSummary(db: Database.Database, hoursBack?: number): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalClaimedUsd: number;
    totalGasUsd: number;
    netUsd: number;
    successRate: number;
    protocolBreakdown: Array<{
        protocol: string;
        executions: number;
        claimedUsd: number;
        gasUsd: number;
        netUsd: number;
    }>;
};
export declare function updateBundleGasActuals(db: Database.Database, bundleId: string, actualGasUsd: number, actualClaimedUsd: number): void;
//# sourceMappingURL=ledger.d.ts.map