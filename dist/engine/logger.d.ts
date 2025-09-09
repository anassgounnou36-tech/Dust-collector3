export declare class Logger {
    private logLevel;
    constructor(logLevel?: string);
    private getTimestamp;
    private shouldLog;
    private normalizeArg;
    private enumerateErrorExtras;
    private formatMessage;
    private baseLog;
    error(message: string, ...args: any[]): void;
    errorObject(err: any, context?: string): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    fatal(message: string, err?: any): void;
    bundleCreated(bundleId: string, itemCount: number, totalUsd: number): void;
    bundleExecuted(bundleId: string, success: boolean, txHash?: string, error?: string): void;
    verifiedPayoutSummary(protocol: string, claimedUsd: number, gasUsd: number, netUsd: number, txHash: string, verified: boolean): void;
    discoveryRun(protocol: string, walletCount: number, rewardCount: number): void;
    profitabilityCheck(bundleId: string, passed: boolean, reason?: string): void;
    routerQuote(router: string, tokenIn: string, tokenOut: string, amountIn: string, quote: string | null): void;
    routerEvaluation(router: string, evaluation: {
        profitable: boolean;
        profitUsd: number;
        gasUsd: number;
        priceImpact: number;
        score: number;
    }): void;
    slippageProtection(config: {
        tolerance: number;
        deadline: number;
        warnings: string[];
    }): void;
    pairDiscovery(tokenA: string, tokenB: string, pairCount: number): void;
    priceImpactWarning(impact: number, threshold?: number): void;
    routerComparison(best: string | null, evaluations: number): void;
    phase4Metrics(metrics: {
        quotesRequested: number;
        quotesSuccessful: number;
        averageGasUsd: number;
        averagePriceImpact: number;
        profitableRoutes: number;
    }): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map