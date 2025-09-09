/**
 * Transaction Sender for Phase 4
 *
 * Placeholder transaction sender that logs intended actions when DRY_RUN_ONLY=false.
 * Provides a safe interface for transaction execution with comprehensive logging
 * and dry-run capabilities.
 *
 * Features:
 * - Dry-run mode by default (DRY_RUN_ONLY=true)
 * - Structured logging of intended actions
 * - Transaction preparation and validation
 * - Gas estimation and safety checks
 * - Error handling and recovery
 */
import type { Quote } from '../routers/types.js';
/**
 * Transaction execution modes
 */
export declare enum ExecutionMode {
    DRY_RUN = "dry_run",
    LIVE = "live"
}
/**
 * Transaction execution result
 */
export interface TransactionResult {
    success: boolean;
    mode: ExecutionMode;
    txHash?: string;
    gasUsed?: string;
    gasUsd?: number;
    error?: string;
    timestamp: string;
    dryRunOnly: boolean;
}
/**
 * Transaction parameters for sending
 */
export interface TransactionParams {
    quote: Quote;
    slippageTolerance: number;
    deadlineMinutes: number;
    maxGasPrice?: bigint;
    maxGasUsd?: number;
}
/**
 * Transaction sender configuration
 */
interface TransactionSenderConfig {
    dryRunOnly: boolean;
    maxGasUsd: number;
    defaultSlippage: number;
    defaultDeadlineMinutes: number;
    logLevel: string;
}
/**
 * Phase 4 Transaction Sender
 */
export declare class TransactionSender {
    private config;
    constructor(config?: Partial<TransactionSenderConfig>);
    /**
     * Execute a transaction (or simulate in dry-run mode)
     */
    executeTransaction(params: TransactionParams): Promise<TransactionResult>;
    /**
     * Batch execute multiple transactions
     */
    executeBatch(transactions: TransactionParams[]): Promise<TransactionResult[]>;
    /**
     * Validate transaction parameters
     */
    private validateTransactionParams;
    /**
     * Perform safety checks before execution
     */
    private performSafetyChecks;
    /**
     * Simulate transaction execution in dry-run mode
     */
    private simulateTransaction;
    /**
     * Execute live transaction (placeholder implementation)
     */
    private executeLiveTransaction;
    /**
     * Log intended action with structured data
     */
    private logIntendedAction;
    /**
     * Sanitize parameters for logging (remove sensitive data)
     */
    private sanitizeParams;
    /**
     * Structured JSON logging
     */
    private logStructured;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<TransactionSenderConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): TransactionSenderConfig;
}
/**
 * Factory function to create transaction sender
 */
export declare function createTransactionSender(config?: Partial<TransactionSenderConfig>): TransactionSender;
/**
 * Quick execution function for single transactions
 */
export declare function quickExecute(params: TransactionParams): Promise<TransactionResult>;
/**
 * Default export
 */
export default TransactionSender;
//# sourceMappingURL=transactionSender.d.ts.map