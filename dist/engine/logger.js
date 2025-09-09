"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
class Logger {
    logLevel;
    constructor(logLevel = 'info') {
        this.logLevel = logLevel;
    }
    getTimestamp() {
        return new Date().toISOString();
    }
    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const requestedLevelIndex = levels.indexOf(level);
        return requestedLevelIndex <= currentLevelIndex;
    }
    normalizeArg(arg) {
        if (arg instanceof Error) {
            return JSON.stringify({
                name: arg.name,
                message: arg.message,
                stack: arg.stack,
                ...this.enumerateErrorExtras(arg)
            }, null, 2);
        }
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            }
            catch {
                return '[Unserializable Object]';
            }
        }
        return String(arg);
    }
    enumerateErrorExtras(err) {
        const out = {};
        for (const k of Object.keys(err)) {
            // @ts-ignore
            out[k] = err[k];
        }
        return out;
    }
    formatMessage(level, message, args) {
        const timestamp = this.getTimestamp();
        const formattedArgs = args.length > 0
            ? ' ' + args.map(a => this.normalizeArg(a)).join(' ')
            : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
    }
    baseLog(method, level, message, args) {
        if (!this.shouldLog(level))
            return;
        // eslint-disable-next-line no-console
        console[method](this.formatMessage(level, message, args));
    }
    error(message, ...args) {
        this.baseLog('error', 'error', message, args);
    }
    errorObject(err, context = 'Error') {
        if (!this.shouldLog('error'))
            return;
        if (err instanceof Error) {
            this.error(context, err);
        }
        else {
            this.error(context, err);
        }
    }
    warn(message, ...args) {
        this.baseLog('warn', 'warn', message, args);
    }
    info(message, ...args) {
        this.baseLog('log', 'info', message, args);
    }
    debug(message, ...args) {
        this.baseLog('log', 'debug', message, args);
    }
    fatal(message, err) {
        this.error(`FATAL: ${message}`, err);
    }
    // Specialized logging methods for bot operations
    bundleCreated(bundleId, itemCount, totalUsd) {
        this.info(`Bundle created: ${bundleId} with ${itemCount} items worth $${totalUsd.toFixed(2)}`);
    }
    bundleExecuted(bundleId, success, txHash, error) {
        if (success && txHash) {
            this.info(`Bundle executed successfully: ${bundleId} (tx: ${txHash})`);
        }
        else {
            this.error(`Bundle execution failed: ${bundleId}`, error || 'Unknown error');
        }
    }
    // Enhanced profit summary logging for verified payouts
    verifiedPayoutSummary(protocol, claimedUsd, gasUsd, netUsd, txHash, verified) {
        const status = verified ? '✅' : '❌';
        const verifiedText = verified ? 'verified=yes' : 'verified=no';
        this.info(`${status} ${protocol} claim: gross $${claimedUsd.toFixed(2)} | gas $${gasUsd.toFixed(2)} | net $${netUsd.toFixed(2)} | tx ${txHash} | ${verifiedText}`);
    }
    discoveryRun(protocol, walletCount, rewardCount) {
        this.info(`Discovery completed: ${protocol} found ${rewardCount} rewards across ${walletCount} wallets`);
    }
    profitabilityCheck(bundleId, passed, reason) {
        if (passed) {
            this.debug(`Profitability check passed: ${bundleId}`);
        }
        else {
            this.debug(`Profitability check failed: ${bundleId} - ${reason}`);
        }
    }
    routerQuote(router, tokenIn, tokenOut, amountIn, quote) {
        if (quote) {
            this.debug(`Router quote [${router}]: ${amountIn} ${tokenIn} → ${quote} ${tokenOut}`);
        }
        else {
            this.debug(`Router quote [${router}]: No route found for ${amountIn} ${tokenIn} → ${tokenOut}`);
        }
    }
    routerEvaluation(router, evaluation) {
        const status = evaluation.profitable ? 'PROFITABLE' : 'UNPROFITABLE';
        this.info(`Router evaluation [${router}]: ${status} - Profit: $${evaluation.profitUsd.toFixed(2)}, Gas: $${evaluation.gasUsd.toFixed(2)}, Impact: ${(evaluation.priceImpact * 100).toFixed(2)}%, Score: ${evaluation.score}`);
    }
    slippageProtection(config) {
        this.debug(`Slippage protection: ${(config.tolerance * 100).toFixed(2)}% tolerance, ${Math.floor((config.deadline - Date.now() / 1000) / 60)}min deadline`);
        if (config.warnings.length > 0) {
            config.warnings.forEach(warning => this.warn(`Slippage warning: ${warning}`));
        }
    }
    pairDiscovery(tokenA, tokenB, pairCount) {
        this.debug(`Pair discovery: Found ${pairCount} pairs for ${tokenA}/${tokenB}`);
    }
    priceImpactWarning(impact, threshold = 0.05) {
        if (impact > threshold) {
            this.warn(`High price impact detected: ${(impact * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`);
        }
    }
    routerComparison(best, evaluations) {
        if (best) {
            this.info(`Router comparison: Best route found via ${best} (${evaluations} evaluations)`);
        }
        else {
            this.warn(`Router comparison: No profitable routes found (${evaluations} evaluations)`);
        }
    }
    phase4Metrics(metrics) {
        const successRate = metrics.quotesRequested > 0 ? (metrics.quotesSuccessful / metrics.quotesRequested) * 100 : 0;
        this.info(`Phase 4 metrics: ${metrics.quotesSuccessful}/${metrics.quotesRequested} quotes (${successRate.toFixed(1)}%), Avg gas: $${metrics.averageGasUsd.toFixed(2)}, Avg impact: ${(metrics.averagePriceImpact * 100).toFixed(2)}%, Profitable: ${metrics.profitableRoutes}`);
    }
}
exports.Logger = Logger;
// Global logger instance
exports.logger = new Logger(process.env.LOG_LEVEL || 'info');
//# sourceMappingURL=logger.js.map