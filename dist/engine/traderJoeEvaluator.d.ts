/**
 * Trader Joe Evaluator for Phase 4
 * Evaluates profitability and execution quality of Trader Joe routes
 */
import type { RouterEvaluation, Token, SlippageConfig } from '../routers/types.js';
import { AVALANCHE_TOKENS } from '../routers/traderJoe/TraderJoeRouter.js';
/**
 * Evaluation criteria for router quality
 */
interface EvaluationCriteria {
    readonly minProfitUsd: number;
    readonly maxPriceImpact: number;
    readonly maxGasUsd: number;
    readonly minExecutionScore: number;
}
/**
 * Trader Joe specific evaluator
 */
export declare class TraderJoeEvaluator {
    private router;
    private criteria;
    constructor(rpcUrl?: string, criteria?: Partial<EvaluationCriteria>);
    /**
     * Evaluate a single trade opportunity
     */
    evaluateTrade(tokenIn: Token, tokenOut: Token, amountIn: bigint, slippage?: SlippageConfig): Promise<RouterEvaluation>;
    /**
     * Evaluate multiple amount levels for a trade
     */
    evaluateAmountLevels(tokenIn: Token, tokenOut: Token, amounts: bigint[], slippage?: SlippageConfig): Promise<RouterEvaluation[]>;
    /**
     * Find the best trade size within a range
     */
    findOptimalTradeSize(tokenIn: Token, tokenOut: Token, minAmount: bigint, maxAmount: bigint, steps?: number, slippage?: SlippageConfig): Promise<{
        bestEvaluation: RouterEvaluation | null;
        allEvaluations: RouterEvaluation[];
    }>;
    /**
     * Compare trading different token pairs for arbitrage
     */
    evaluateArbitrageOpportunity(baseToken: Token, targetTokens: Token[], amount: bigint, slippage?: SlippageConfig): Promise<{
        bestTarget: Token | null;
        bestEvaluation: RouterEvaluation | null;
        allEvaluations: Map<string, RouterEvaluation>;
    }>;
    /**
     * Evaluate common trading pairs on Avalanche
     */
    evaluateCommonPairs(amount?: bigint): Promise<{
        evaluations: Map<string, RouterEvaluation>;
        profitable: RouterEvaluation[];
        summary: {
            totalPairs: number;
            profitablePairs: number;
            averageGasUsd: number;
            averagePriceImpact: number;
        };
    }>;
    /**
     * Calculate execution score based on various factors
     */
    private calculateExecutionScore;
    /**
     * Check profitability with debug recording
     */
    private checkProfitability;
    /**
     * Add evaluation warnings based on trade conditions with debug recording
     */
    private addEvaluationWarnings;
    /**
     * Create a failed evaluation result
     */
    private createFailedEvaluation;
    /**
     * Estimate USD value of token amount
     */
    private estimateTokenUsd;
    /**
     * Estimate trade volume in USD
     */
    private estimateTradeVolumeUsd;
}
/**
 * Factory function to create evaluator
 */
export declare function createTraderJoeEvaluator(rpcUrl?: string, criteria?: Partial<EvaluationCriteria>): TraderJoeEvaluator;
/**
 * Quick evaluation for a standard trade
 */
export declare function quickEvaluate(tokenInSymbol: keyof typeof AVALANCHE_TOKENS, tokenOutSymbol: keyof typeof AVALANCHE_TOKENS, amountUsd?: number): Promise<RouterEvaluation>;
export {};
//# sourceMappingURL=traderJoeEvaluator.d.ts.map