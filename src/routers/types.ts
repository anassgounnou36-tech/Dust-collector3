import type { Address } from '../types/common.js';

/**
 * Represents a token for DEX routing
 */
export interface Token {
  readonly address: string;
  readonly decimals: number;
  readonly symbol: string;
  readonly name?: string;
  readonly chainId: number;
}

/**
 * Represents a trading pair
 */
export interface Pair {
  readonly token0: Token;
  readonly token1: Token;
  readonly reserve0: bigint;
  readonly reserve1: bigint;
  readonly address: string;
  readonly fee?: number; // Fee in basis points (e.g., 30 = 0.3%)
}

/**
 * Route for a swap operation
 */
export interface Route {
  readonly pairs: Pair[];
  readonly path: Token[];
  readonly input: Token;
  readonly output: Token;
}

/**
 * Quote result from a router
 */
export interface Quote {
  readonly route: Route;
  readonly inputAmount: bigint;
  readonly outputAmount: bigint;
  readonly priceImpact: number; // Percentage (0-100)
  readonly gasEstimate: bigint;
  readonly gasUsd: number;
  readonly executionPrice: number; // Output per input unit
}

/**
 * Trade parameters for execution
 */
export interface TradeParams {
  readonly route: Route;
  readonly inputAmount: bigint;
  readonly outputAmountMin: bigint; // After slippage
  readonly recipient: string;
  readonly deadline: number; // Unix timestamp
}

/**
 * Slippage configuration
 */
export interface SlippageConfig {
  readonly tolerance: number; // Percentage (0-1, e.g., 0.005 = 0.5%)
  readonly deadlineMinutes: number;
}

/**
 * Router interface for DEX interactions
 */
export interface Router {
  readonly name: string;
  readonly chainId: number;
  
  /**
   * Get best quote for a trade
   */
  getQuote(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    slippage: SlippageConfig
  ): Promise<Quote | null>;

  /**
   * Get multiple quotes for different amounts
   */
  getQuotes(
    tokenIn: Token,
    tokenOut: Token,
    amounts: bigint[],
    slippage: SlippageConfig
  ): Promise<Quote[]>;

  /**
   * Build transaction data for a trade (dry-run only in Phase 4)
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
}

/**
 * Router factory interface
 */
export interface RouterFactory {
  createRouter(rpcUrl: string, routerAddress: string): Router;
  getSupportedChains(): number[];
}

/**
 * Price oracle interface for external price feeds
 */
export interface PriceOracle {
  /**
   * Get USD price for a token
   */
  getTokenUsd(token: Token): Promise<number | null>;

  /**
   * Get price ratio between two tokens
   */
  getTokenRatio(tokenA: Token, tokenB: Token): Promise<number | null>;

  /**
   * Batch get USD prices for multiple tokens
   */
  getTokensUsd(tokens: Token[]): Promise<Map<string, number>>;
}

/**
 * Route optimization parameters
 */
export interface RouteOptimization {
  readonly maxHops: number;
  readonly maxSplits: number; // For multi-path routing (future)
  readonly gasOptimized: boolean;
  readonly priceOptimized: boolean;
}

/**
 * Router evaluation result
 */
export interface RouterEvaluation {
  readonly quote: Quote | null;
  readonly profitable: boolean;
  readonly profitUsd: number;
  readonly gasUsd: number;
  readonly netUsd: number;
  readonly priceImpact: number;
  readonly executionScore: number; // 0-100 rating
  readonly warnings: string[];
  readonly errors: string[];
}

/**
 * Multi-router comparison result
 */
export interface RouterComparison {
  readonly best: RouterEvaluation | null;
  readonly evaluations: Map<string, RouterEvaluation>;
  readonly recommendedAction: 'execute' | 'wait' | 'skip';
  readonly reason: string;
}