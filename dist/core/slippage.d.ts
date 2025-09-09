/**
 * Slippage protection and calculation utilities for Phase 4
 */
import type { SlippageConfig } from '../routers/types.js';
/**
 * Default slippage configurations for different scenarios
 */
export declare const DEFAULT_SLIPPAGE: {
    readonly CONSERVATIVE: 0.001;
    readonly NORMAL: 0.005;
    readonly AGGRESSIVE: 0.01;
    readonly EMERGENCY: 0.03;
};
/**
 * Time-to-live configurations for transactions
 */
export declare const DEFAULT_TTL: {
    readonly FAST: 2;
    readonly NORMAL: 10;
    readonly SLOW: 30;
    readonly BATCH: 60;
};
/**
 * Calculates the minimum output amount after applying slippage
 */
export declare function calculateMinOutput(expectedOutput: bigint, slippageTolerance: number): bigint;
/**
 * Calculates the maximum input amount before applying slippage
 */
export declare function calculateMaxInput(expectedInput: bigint, slippageTolerance: number): bigint;
/**
 * Calculates transaction deadline based on current time and TTL
 */
export declare function calculateDeadline(ttlMinutes: number): number;
/**
 * Validates slippage configuration
 */
export declare function validateSlippageConfig(config: SlippageConfig): void;
/**
 * Calculates actual slippage from expected vs actual amounts
 */
export declare function calculateActualSlippage(expectedAmount: bigint, actualAmount: bigint, isOutput?: boolean): number;
/**
 * Price impact calculation
 */
export declare function calculatePriceImpact(inputAmount: bigint, outputAmount: bigint, marketPrice: number, inputDecimals: number, outputDecimals: number): number;
/**
 * Determines appropriate slippage for given conditions
 */
export declare function getRecommendedSlippage(volumeUsd: number, priceImpact: number, urgency?: 'low' | 'normal' | 'high'): number;
/**
 * Slippage protection result
 */
export interface SlippageResult {
    readonly originalAmount: bigint;
    readonly protectedAmount: bigint;
    readonly slippageTolerance: number;
    readonly deadline: number;
    readonly priceImpact: number;
    readonly recommended: boolean;
    readonly warnings: string[];
}
/**
 * Comprehensive slippage protection for a trade
 */
export declare function protectTrade(amount: bigint, slippageConfig: SlippageConfig, priceImpact: number, volumeUsd: number, isOutput?: boolean): SlippageResult;
/**
 * Utility to format slippage percentage for display
 */
export declare function formatSlippage(slippage: number): string;
/**
 * Utility to format deadline for display
 */
export declare function formatDeadline(deadline: number): string;
//# sourceMappingURL=slippage.d.ts.map