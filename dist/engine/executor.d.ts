import type { ClaimBundle, ChainClient, TxResult } from '../types/common.js';
import { type PricingService } from './verifyPayout.js';
/**
 * Inject pricing service for payout verification and gas calculations
 */
export declare function injectPricingService(service: PricingService): void;
export declare function execute(bundle: ClaimBundle, clients: Map<string, ChainClient>, mockMode?: boolean): Promise<TxResult>;
export declare function executeSequential(bundles: ClaimBundle[], clients: Map<string, ChainClient>, mockMode?: boolean): Promise<TxResult[]>;
export declare function executeBatch(bundles: ClaimBundle[], clients: Map<string, ChainClient>, batchSize?: number, mockMode?: boolean): Promise<TxResult[]>;
export declare function aggregateExecutionResults(results: TxResult[]): {
    successCount: number;
    failureCount: number;
    totalClaimedUsd: number;
    totalGasUsd: number;
    netUsd: number;
    successRate: number;
    verifiedPayoutCount: number;
};
//# sourceMappingURL=executor.d.ts.map