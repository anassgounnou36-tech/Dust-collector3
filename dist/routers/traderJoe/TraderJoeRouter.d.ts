/**
 * Trader Joe Router Implementation for Phase 4
 * Provides single-hop routing with dry-run capabilities
 */
import type { Router, Token, Pair, Quote, TradeParams, SlippageConfig } from '../types.js';
/**
 * Trader Joe specific router implementation
 */
export declare class TraderJoeRouter implements Router {
    readonly name = "TraderJoe";
    readonly chainId = 43114;
    private provider;
    private routerContract;
    private factoryContract;
    private routerAddress;
    private factoryAddress;
    constructor(rpcUrl: string, routerAddress?: string, factoryAddress?: string);
    /**
     * Get best quote for a single-hop trade
     */
    getQuote(tokenIn: Token, tokenOut: Token, amountIn: bigint, slippage: SlippageConfig): Promise<Quote | null>;
    /**
     * Get multiple quotes for different amounts
     */
    getQuotes(tokenIn: Token, tokenOut: Token, amounts: bigint[], slippage: SlippageConfig): Promise<Quote[]>;
    /**
     * Build transaction data for a trade (dry-run only)
     */
    buildTrade(params: TradeParams): Promise<{
        to: string;
        data: string;
        value: string;
        gasLimit: bigint;
    }>;
    /**
     * Get all available pairs for a token
     */
    getPairsForToken(token: Token): Promise<Pair[]>;
    /**
     * Check if a pair exists
     */
    pairExists(tokenA: Token, tokenB: Token): Promise<boolean>;
    /**
     * Find pairs for two tokens
     */
    private findPairsForTokens;
    /**
     * Load pair data from contract
     */
    private loadPairData;
    /**
     * Get quote for a specific pair
     */
    private getQuoteForPair;
    /**
     * Calculate price impact for a trade
     */
    private calculatePriceImpact;
    /**
     * Get bin steps for a pair
     */
    private getBinStepsForPair;
    /**
     * Estimate gas for a trade
     */
    private estimateGasForTrade;
    /**
     * Estimate gas for a pair operation
     */
    private estimateGasForPair;
    /**
     * Estimate gas cost in USD
     */
    private estimateGasUsd;
    /**
     * Estimate USD value of token amount (simplified)
     */
    private estimateUsdValue;
}
/**
 * Factory function to create TraderJoe router
 */
export declare function createTraderJoeRouter(rpcUrl?: string): TraderJoeRouter;
/**
 * Common token definitions for Avalanche
 */
export declare const AVALANCHE_TOKENS: {
    readonly WAVAX: {
        readonly address: string;
        readonly decimals: 18;
        readonly symbol: "WAVAX";
        readonly name: "Wrapped AVAX";
        readonly chainId: 43114;
    };
    readonly USDC: {
        readonly address: string;
        readonly decimals: 6;
        readonly symbol: "USDC";
        readonly name: "USD Coin";
        readonly chainId: 43114;
    };
    readonly JOE: {
        readonly address: string;
        readonly decimals: 18;
        readonly symbol: "JOE";
        readonly name: "JoeToken";
        readonly chainId: 43114;
    };
};
//# sourceMappingURL=TraderJoeRouter.d.ts.map