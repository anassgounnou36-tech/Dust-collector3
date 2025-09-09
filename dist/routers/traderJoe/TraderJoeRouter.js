"use strict";
/**
 * Trader Joe Router Implementation for Phase 4
 * Provides single-hop routing with dry-run capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVALANCHE_TOKENS = exports.TraderJoeRouter = void 0;
exports.createTraderJoeRouter = createTraderJoeRouter;
const ethers_1 = require("ethers");
const Pair_js_1 = require("./abi/Pair.js");
const env_js_1 = require("../../config/env.js");
const logger_js_1 = require("../../engine/logger.js");
const phase4_js_1 = require("../../metrics/phase4.js");
/**
 * Trader Joe specific router implementation
 */
class TraderJoeRouter {
    name = 'TraderJoe';
    chainId = 43114; // Avalanche C-Chain
    provider;
    routerContract;
    factoryContract;
    routerAddress;
    factoryAddress;
    constructor(rpcUrl, routerAddress, factoryAddress) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        this.routerAddress = routerAddress || env_js_1.env.traderJoeRouter;
        this.factoryAddress = factoryAddress || env_js_1.env.traderJoeFactory;
        this.routerContract = new ethers_1.ethers.Contract(this.routerAddress, Pair_js_1.TRADER_JOE_ROUTER_ABI, this.provider);
        this.factoryContract = new ethers_1.ethers.Contract(this.factoryAddress, Pair_js_1.TRADER_JOE_FACTORY_ABI, this.provider);
    }
    /**
     * Get best quote for a single-hop trade
     */
    async getQuote(tokenIn, tokenOut, amountIn, slippage) {
        const startTime = Date.now();
        let quote = null;
        let error;
        try {
            // Find the best pair for this trade
            const pairs = await this.findPairsForTokens(tokenIn, tokenOut);
            if (pairs.length === 0) {
                logger_js_1.logger.debug(`No pairs found for ${tokenIn.symbol}/${tokenOut.symbol}`);
                return null;
            }
            let bestQuote = null;
            // Evaluate each pair to find the best quote
            for (const pair of pairs) {
                try {
                    const pairQuote = await this.getQuoteForPair(pair, tokenIn, tokenOut, amountIn, slippage);
                    if (pairQuote && (!bestQuote || pairQuote.outputAmount > bestQuote.outputAmount)) {
                        bestQuote = pairQuote;
                    }
                }
                catch (pairError) {
                    logger_js_1.logger.debug(`Failed to get quote for pair ${pair.address}:`, pairError);
                }
            }
            quote = bestQuote;
        }
        catch (err) {
            error = err instanceof Error ? err : new Error('Unknown error');
            logger_js_1.logger.debug(`Quote failed for ${tokenIn.symbol}/${tokenOut.symbol}:`, error);
        }
        finally {
            // Record metrics
            const responseTime = Date.now() - startTime;
            const amountUsd = this.estimateUsdValue(amountIn, tokenIn);
            phase4_js_1.phase4Metrics.recordQuote(this.name, tokenIn.symbol, tokenOut.symbol, amountUsd, responseTime, quote, error);
        }
        return quote;
    }
    /**
     * Get multiple quotes for different amounts
     */
    async getQuotes(tokenIn, tokenOut, amounts, slippage) {
        const quotes = [];
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
    async buildTrade(params) {
        if (params.route.pairs.length !== 1) {
            throw new Error('Only single-hop routes supported in Phase 4');
        }
        const pair = params.route.pairs[0];
        const tokenPath = [params.route.input.address, params.route.output.address];
        // Determine bin steps for Trader Joe V2.1
        const binSteps = await this.getBinStepsForPair(pair);
        // Build transaction data
        const routerInterface = new ethers_1.ethers.Interface(Pair_js_1.TRADER_JOE_ROUTER_ABI);
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
    async getPairsForToken(token) {
        // For Phase 4, we'll focus on major pairs with WAVAX and USDC
        const majorTokens = [
            { address: env_js_1.env.wavaxToken, symbol: 'WAVAX', decimals: 18, name: 'Wrapped AVAX', chainId: this.chainId },
            { address: env_js_1.env.usdcToken, symbol: 'USDC', decimals: 6, name: 'USD Coin', chainId: this.chainId }
        ];
        const pairs = [];
        for (const majorToken of majorTokens) {
            if (majorToken.address.toLowerCase() !== token.address.toLowerCase()) {
                try {
                    const foundPairs = await this.findPairsForTokens(token, majorToken);
                    pairs.push(...foundPairs);
                }
                catch (error) {
                    logger_js_1.logger.debug(`Failed to find pairs for ${token.symbol}/${majorToken.symbol}:`, error);
                }
            }
        }
        logger_js_1.logger.pairDiscovery(token.symbol, 'MAJOR_TOKENS', pairs.length);
        return pairs;
    }
    /**
     * Check if a pair exists
     */
    async pairExists(tokenA, tokenB) {
        try {
            const pairs = await this.findPairsForTokens(tokenA, tokenB);
            return pairs.length > 0;
        }
        catch (error) {
            logger_js_1.logger.debug(`Error checking pair existence for ${tokenA.symbol}/${tokenB.symbol}:`, error);
            return false;
        }
    }
    /**
     * Find pairs for two tokens
     */
    async findPairsForTokens(tokenA, tokenB) {
        try {
            // Get all available bin steps for this token pair
            const availableBinSteps = await this.factoryContract.getAvailableLBPairBinSteps(tokenA.address, tokenB.address);
            const pairs = [];
            for (const binStep of availableBinSteps) {
                try {
                    const [pairAddress, created] = await this.factoryContract.getLBPairInformation(tokenA.address, tokenB.address, Number(binStep));
                    if (created && pairAddress !== ethers_1.ethers.ZeroAddress) {
                        const pair = await this.loadPairData(pairAddress, tokenA, tokenB, Number(binStep));
                        if (pair) {
                            pairs.push(pair);
                        }
                    }
                }
                catch (error) {
                    logger_js_1.logger.debug(`Failed to load pair for bin step ${binStep}:`, error);
                }
            }
            return pairs;
        }
        catch (error) {
            logger_js_1.logger.debug(`Failed to find pairs for ${tokenA.symbol}/${tokenB.symbol}:`, error);
            return [];
        }
    }
    /**
     * Load pair data from contract
     */
    async loadPairData(pairAddress, tokenA, tokenB, binStep) {
        try {
            const pairContract = new ethers_1.ethers.Contract(pairAddress, Pair_js_1.TRADER_JOE_PAIR_ABI, this.provider);
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
        }
        catch (error) {
            logger_js_1.logger.debug(`Failed to load pair data for ${pairAddress}:`, error);
            return null;
        }
    }
    /**
     * Get quote for a specific pair
     */
    async getQuoteForPair(pair, tokenIn, tokenOut, amountIn, slippage) {
        try {
            const pairContract = new ethers_1.ethers.Contract(pair.address, Pair_js_1.TRADER_JOE_PAIR_ABI, this.provider);
            // Determine if we're swapping for Y token
            const tokenX = await pairContract.getTokenX();
            const swapForY = tokenIn.address.toLowerCase() === tokenX.toLowerCase();
            // Get swap output
            const [, amountOut] = await pairContract.getSwapOut(BigInt(amountIn.toString()), swapForY);
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
            const route = {
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
        }
        catch (error) {
            logger_js_1.logger.debug(`Failed to get quote for pair ${pair.address}:`, error);
            return null;
        }
    }
    /**
     * Calculate price impact for a trade
     */
    calculatePriceImpact(pair, tokenIn, tokenOut, amountIn, amountOut) {
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
        }
        catch (error) {
            logger_js_1.logger.debug('Failed to calculate price impact:', error);
            return 0;
        }
    }
    /**
     * Get bin steps for a pair
     */
    async getBinStepsForPair(pair) {
        // In Trader Joe V2.1, bin step is stored as fee
        return [pair.fee || 25]; // Default to 25 basis points if not specified
    }
    /**
     * Estimate gas for a trade
     */
    async estimateGasForTrade(params) {
        // Static gas estimate for single-hop swap
        return BigInt(200000); // Conservative estimate
    }
    /**
     * Estimate gas for a pair operation
     */
    async estimateGasForPair(pair) {
        return BigInt(150000); // Conservative estimate for pair interaction
    }
    /**
     * Estimate gas cost in USD
     */
    async estimateGasUsd(gasEstimate) {
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
        }
        catch (error) {
            logger_js_1.logger.debug('Failed to estimate gas USD:', error);
            return 2.0; // Fallback estimate
        }
    }
    /**
     * Estimate USD value of token amount (simplified)
     */
    estimateUsdValue(amount, token) {
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
exports.TraderJoeRouter = TraderJoeRouter;
/**
 * Factory function to create TraderJoe router
 */
function createTraderJoeRouter(rpcUrl) {
    return new TraderJoeRouter(rpcUrl || env_js_1.env.avalancheRpcUrl, env_js_1.env.traderJoeRouter, env_js_1.env.traderJoeFactory);
}
/**
 * Common token definitions for Avalanche
 */
exports.AVALANCHE_TOKENS = {
    WAVAX: {
        address: env_js_1.env.wavaxToken,
        decimals: 18,
        symbol: 'WAVAX',
        name: 'Wrapped AVAX',
        chainId: 43114
    },
    USDC: {
        address: env_js_1.env.usdcToken,
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
        chainId: 43114
    },
    JOE: {
        address: env_js_1.env.joeToken,
        decimals: 18,
        symbol: 'JOE',
        name: 'JoeToken',
        chainId: 43114
    }
};
//# sourceMappingURL=TraderJoeRouter.js.map