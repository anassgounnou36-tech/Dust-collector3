/**
 * Trader Joe Router Implementation for Phase 4
 * Provides single-hop routing with dry-run capabilities
 */

import { ethers } from 'ethers';
import type { 
  Router, 
  Token, 
  Pair, 
  Route, 
  Quote, 
  TradeParams, 
  SlippageConfig 
} from '../types.js';
import { 
  TRADER_JOE_ROUTER_ABI, 
  TRADER_JOE_FACTORY_ABI, 
  TRADER_JOE_PAIR_ABI, 
  ERC20_ABI,
  type TraderJoeRouterContract,
  type TraderJoeFactoryContract,
  type TraderJoePairContract,
  type ERC20Contract
} from './abi/Pair.js';
import { calculateMinOutput, calculateDeadline } from '../../core/slippage.js';
import { env } from '../../config/env.js';
import { logger } from '../../engine/logger.js';
import { phase4Metrics } from '../../metrics/phase4.js';

/**
 * Trader Joe specific router implementation
 */
export class TraderJoeRouter implements Router {
  readonly name = 'TraderJoe';
  readonly chainId = 43114; // Avalanche C-Chain

  private provider: ethers.JsonRpcProvider;
  private routerContract: TraderJoeRouterContract;
  private factoryContract: TraderJoeFactoryContract;
  private routerAddress: string;
  private factoryAddress: string;

  constructor(rpcUrl: string, routerAddress?: string, factoryAddress?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.routerAddress = routerAddress || env.traderJoeRouter;
    this.factoryAddress = factoryAddress || env.traderJoeFactory;

    this.routerContract = new ethers.Contract(
      this.routerAddress, 
      TRADER_JOE_ROUTER_ABI, 
      this.provider
    ) as unknown as TraderJoeRouterContract;

    this.factoryContract = new ethers.Contract(
      this.factoryAddress,
      TRADER_JOE_FACTORY_ABI,
      this.provider
    ) as unknown as TraderJoeFactoryContract;
  }

  /**
   * Get best quote for a single-hop trade
   */
  async getQuote(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    slippage: SlippageConfig
  ): Promise<Quote | null> {
    const startTime = Date.now();
    let quote: Quote | null = null;
    let error: Error | undefined;

    try {
      // Find the best pair for this trade
      const pairs = await this.findPairsForTokens(tokenIn, tokenOut);
      if (pairs.length === 0) {
        logger.debug(`No pairs found for ${tokenIn.symbol}/${tokenOut.symbol}`);
        return null;
      }

      let bestQuote: Quote | null = null;
      
      // Evaluate each pair to find the best quote
      for (const pair of pairs) {
        try {
          const pairQuote = await this.getQuoteForPair(pair, tokenIn, tokenOut, amountIn, slippage);
          if (pairQuote && (!bestQuote || pairQuote.outputAmount > bestQuote.outputAmount)) {
            bestQuote = pairQuote;
          }
        } catch (pairError) {
          logger.debug(`Failed to get quote for pair ${pair.address}:`, pairError);
        }
      }

      quote = bestQuote;
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');
      logger.debug(`Quote failed for ${tokenIn.symbol}/${tokenOut.symbol}:`, error);
    } finally {
      // Record metrics
      const responseTime = Date.now() - startTime;
      const amountUsd = this.estimateUsdValue(amountIn, tokenIn);
      phase4Metrics.recordQuote(
        this.name,
        tokenIn.symbol,
        tokenOut.symbol,
        amountUsd,
        responseTime,
        quote,
        error
      );
    }

    return quote;
  }

  /**
   * Get multiple quotes for different amounts
   */
  async getQuotes(
    tokenIn: Token,
    tokenOut: Token,
    amounts: bigint[],
    slippage: SlippageConfig
  ): Promise<Quote[]> {
    const quotes: Quote[] = [];
    
    for (const amount of amounts) {
      const quote = await this.getQuote(tokenIn, tokenOut, amount, slippage);
      if (quote) {
        quotes.push(quote);
      }
    }

    return quotes;
  }

  /**
   * Build transaction data for a trade (dry-run only)
   */
  async buildTrade(params: TradeParams): Promise<{
    to: string;
    data: string;
    value: string;
    gasLimit: bigint;
  }> {
    if (params.route.pairs.length !== 1) {
      throw new Error('Only single-hop routes supported in Phase 4');
    }

    const pair = params.route.pairs[0];
    const tokenPath = [params.route.input.address, params.route.output.address];
    
    // Determine bin steps for Trader Joe V2.1
    const binSteps = await this.getBinStepsForPair(pair);
    
    // Build transaction data
    const routerInterface = new ethers.Interface(TRADER_JOE_ROUTER_ABI);
    const data = routerInterface.encodeFunctionData('swapExactTokensForTokens', [
      params.inputAmount.toString(),
      params.outputAmountMin.toString(),
      binSteps,
      tokenPath,
      params.recipient,
      params.deadline
    ]);

    // Estimate gas
    const gasLimit = await this.estimateGasForTrade(params);

    return {
      to: this.routerAddress,
      data,
      value: '0',
      gasLimit
    };
  }

  /**
   * Get all available pairs for a token
   */
  async getPairsForToken(token: Token): Promise<Pair[]> {
    // For Phase 4, we'll focus on major pairs with WAVAX and USDC
    const majorTokens = [
      { address: env.wavaxToken, symbol: 'WAVAX', decimals: 18, name: 'Wrapped AVAX', chainId: this.chainId },
      { address: env.usdcToken, symbol: 'USDC', decimals: 6, name: 'USD Coin', chainId: this.chainId }
    ];

    const pairs: Pair[] = [];

    for (const majorToken of majorTokens) {
      if (majorToken.address.toLowerCase() !== token.address.toLowerCase()) {
        try {
          const foundPairs = await this.findPairsForTokens(token, majorToken);
          pairs.push(...foundPairs);
        } catch (error) {
          logger.debug(`Failed to find pairs for ${token.symbol}/${majorToken.symbol}:`, error);
        }
      }
    }

    logger.pairDiscovery(token.symbol, 'MAJOR_TOKENS', pairs.length);
    return pairs;
  }

  /**
   * Check if a pair exists
   */
  async pairExists(tokenA: Token, tokenB: Token): Promise<boolean> {
    try {
      const pairs = await this.findPairsForTokens(tokenA, tokenB);
      return pairs.length > 0;
    } catch (error) {
      logger.debug(`Error checking pair existence for ${tokenA.symbol}/${tokenB.symbol}:`, error);
      return false;
    }
  }

  /**
   * Find pairs for two tokens
   */
  private async findPairsForTokens(tokenA: Token, tokenB: Token): Promise<Pair[]> {
    try {
      // Get all available bin steps for this token pair
      const availableBinSteps = await this.factoryContract.getAvailableLBPairBinSteps(
        tokenA.address,
        tokenB.address
      );

      const pairs: Pair[] = [];

      for (const binStep of availableBinSteps) {
        try {
          const [pairAddress, created] = await this.factoryContract.getLBPairInformation(
            tokenA.address,
            tokenB.address,
            Number(binStep)
          );

          if (created && pairAddress !== ethers.ZeroAddress) {
            const pair = await this.loadPairData(pairAddress, tokenA, tokenB, Number(binStep));
            if (pair) {
              pairs.push(pair);
            }
          }
        } catch (error) {
          logger.debug(`Failed to load pair for bin step ${binStep}:`, error);
        }
      }

      return pairs;
    } catch (error) {
      logger.debug(`Failed to find pairs for ${tokenA.symbol}/${tokenB.symbol}:`, error);
      return [];
    }
  }

  /**
   * Load pair data from contract
   */
  private async loadPairData(
    pairAddress: string, 
    tokenA: Token, 
    tokenB: Token, 
    binStep: number
  ): Promise<Pair | null> {
    try {
      const pairContract = new ethers.Contract(
        pairAddress,
        TRADER_JOE_PAIR_ABI,
        this.provider
      ) as unknown as TraderJoePairContract;

      const [reserveX, reserveY] = await pairContract.getReserves();
      
      // Determine token order
      const tokenX = await pairContract.getTokenX();
      const isTokenAFirst = tokenX.toLowerCase() === tokenA.address.toLowerCase();
      
      const [token0, token1] = isTokenAFirst ? [tokenA, tokenB] : [tokenB, tokenA];
      const [reserve0, reserve1] = isTokenAFirst ? [reserveX, reserveY] : [reserveY, reserveX];

      return {
        token0,
        token1,
        reserve0,
        reserve1,
        address: pairAddress,
        fee: binStep // Bin step serves as fee indicator
      };
    } catch (error) {
      logger.debug(`Failed to load pair data for ${pairAddress}:`, error);
      return null;
    }
  }

  /**
   * Get quote for a specific pair
   */
  private async getQuoteForPair(
    pair: Pair,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    slippage: SlippageConfig
  ): Promise<Quote | null> {
    try {
      const pairContract = new ethers.Contract(
        pair.address,
        TRADER_JOE_PAIR_ABI,
        this.provider
      ) as unknown as TraderJoePairContract;

      // Determine if we're swapping for Y token
      const tokenX = await pairContract.getTokenX();
      const swapForY = tokenIn.address.toLowerCase() === tokenX.toLowerCase();

      // Get swap output
      const [, amountOut] = await pairContract.getSwapOut(
        BigInt(amountIn.toString()),
        swapForY
      );

      if (amountOut === 0n) {
        return null;
      }

      // Calculate price impact
      const priceImpact = this.calculatePriceImpact(pair, tokenIn, tokenOut, amountIn, amountOut);
      
      // Estimate gas
      const gasEstimate = await this.estimateGasForPair(pair);
      const gasUsd = await this.estimateGasUsd(gasEstimate);

      // Calculate execution price
      const inputHuman = Number(amountIn) / Math.pow(10, tokenIn.decimals);
      const outputHuman = Number(amountOut) / Math.pow(10, tokenOut.decimals);
      const executionPrice = outputHuman / inputHuman;

      // Create route
      const route: Route = {
        pairs: [pair],
        path: [tokenIn, tokenOut],
        input: tokenIn,
        output: tokenOut
      };

      return {
        route,
        inputAmount: amountIn,
        outputAmount: amountOut,
        priceImpact,
        gasEstimate,
        gasUsd,
        executionPrice
      };
    } catch (error) {
      logger.debug(`Failed to get quote for pair ${pair.address}:`, error);
      return null;
    }
  }

  /**
   * Calculate price impact for a trade
   */
  private calculatePriceImpact(
    pair: Pair,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    amountOut: bigint
  ): number {
    try {
      // Get reserves in correct order
      const isToken0In = tokenIn.address.toLowerCase() === pair.token0.address.toLowerCase();
      const [reserveIn, reserveOut] = isToken0In 
        ? [pair.reserve0, pair.reserve1]
        : [pair.reserve1, pair.reserve0];

      if (reserveIn === 0n || reserveOut === 0n) {
        return 0;
      }

      // Calculate spot price before trade
      const spotPrice = Number(reserveOut) / Number(reserveIn);
      
      // Calculate execution price
      const executionPrice = Number(amountOut) / Number(amountIn);
      
      // Price impact = (spot_price - execution_price) / spot_price
      const priceImpact = Math.abs(spotPrice - executionPrice) / spotPrice;
      
      return Math.min(priceImpact, 1.0); // Cap at 100%
    } catch (error) {
      logger.debug('Failed to calculate price impact:', error);
      return 0;
    }
  }

  /**
   * Get bin steps for a pair
   */
  private async getBinStepsForPair(pair: Pair): Promise<number[]> {
    // In Trader Joe V2.1, bin step is stored as fee
    return [pair.fee || 25]; // Default to 25 basis points if not specified
  }

  /**
   * Estimate gas for a trade
   */
  private async estimateGasForTrade(params: TradeParams): Promise<bigint> {
    // Static gas estimate for single-hop swap
    return BigInt(200000); // Conservative estimate
  }

  /**
   * Estimate gas for a pair operation
   */
  private async estimateGasForPair(pair: Pair): Promise<bigint> {
    return BigInt(150000); // Conservative estimate for pair interaction
  }

  /**
   * Estimate gas cost in USD
   */
  private async estimateGasUsd(gasEstimate: bigint): Promise<number> {
    try {
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(25000000000); // 25 gwei default
      
      // Calculate gas cost in native tokens
      const gasCostWei = gasEstimate * gasPrice;
      const gasCostEth = Number(gasCostWei) / 1e18;
      
      // Get AVAX price (simplified - would use price oracle in production)
      const avaxUsd = 35.0; // Fallback price
      
      return gasCostEth * avaxUsd;
    } catch (error) {
      logger.debug('Failed to estimate gas USD:', error);
      return 2.0; // Fallback estimate
    }
  }

  /**
   * Estimate USD value of token amount (simplified)
   */
  private estimateUsdValue(amount: bigint, token: Token): number {
    // Simplified USD estimation - in production would use price oracles
    const humanAmount = Number(amount) / Math.pow(10, token.decimals);
    
    // Use rough estimates for major tokens
    switch (token.symbol.toUpperCase()) {
      case 'USDC':
      case 'USDT':
        return humanAmount;
      case 'WAVAX':
      case 'AVAX':
        return humanAmount * 35.0;
      case 'JOE':
        return humanAmount * 0.5;
      default:
        return humanAmount * 1.0; // Default to $1 per token
    }
  }
}

/**
 * Factory function to create TraderJoe router
 */
export function createTraderJoeRouter(rpcUrl?: string): TraderJoeRouter {
  return new TraderJoeRouter(
    rpcUrl || env.avalancheRpcUrl,
    env.traderJoeRouter,
    env.traderJoeFactory
  );
}

/**
 * Common token definitions for Avalanche
 */
export const AVALANCHE_TOKENS = {
  WAVAX: {
    address: env.wavaxToken,
    decimals: 18,
    symbol: 'WAVAX',
    name: 'Wrapped AVAX',
    chainId: 43114
  },
  USDC: {
    address: env.usdcToken,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    chainId: 43114
  },
  JOE: {
    address: env.joeToken,
    decimals: 18,
    symbol: 'JOE',
    name: 'JoeToken',
    chainId: 43114
  }
} as const;