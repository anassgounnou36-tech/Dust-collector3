export class Logger {
  private logLevel: string;

  constructor(logLevel: string = 'info') {
    this.logLevel = logLevel;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  private normalizeArg(arg: any): string {
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
      } catch {
        return '[Unserializable Object]';
      }
    }
    return String(arg);
  }

  private enumerateErrorExtras(err: Error): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of Object.keys(err as any)) {
      // @ts-ignore
      out[k] = (err as any)[k];
    }
    return out;
  }

  private formatMessage(level: string, message: string, args: any[]): string {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.length > 0
      ? ' ' + args.map(a => this.normalizeArg(a)).join(' ')
      : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
  }

  private baseLog(method: 'log' | 'warn' | 'error', level: string, message: string, args: any[]) {
    if (!this.shouldLog(level)) return;
    // eslint-disable-next-line no-console
    console[method](this.formatMessage(level, message, args));
  }

  error(message: string, ...args: any[]): void {
    this.baseLog('error', 'error', message, args);
  }

  errorObject(err: any, context: string = 'Error'): void {
    if (!this.shouldLog('error')) return;
    if (err instanceof Error) {
      this.error(context, err);
    } else {
      this.error(context, err);
    }
  }

  warn(message: string, ...args: any[]): void {
    this.baseLog('warn', 'warn', message, args);
  }

  info(message: string, ...args: any[]): void {
    this.baseLog('log', 'info', message, args);
  }

  debug(message: string, ...args: any[]): void {
    this.baseLog('log', 'debug', message, args);
  }

  fatal(message: string, err?: any): void {
    this.error(`FATAL: ${message}`, err);
  }

  // Specialized logging methods for bot operations
  bundleCreated(bundleId: string, itemCount: number, totalUsd: number): void {
    this.info(`Bundle created: ${bundleId} with ${itemCount} items worth $${totalUsd.toFixed(2)}`);
  }

  bundleExecuted(bundleId: string, success: boolean, txHash?: string, error?: string): void {
    if (success && txHash) {
      this.info(`Bundle executed successfully: ${bundleId} (tx: ${txHash})`);
    } else {
      this.error(`Bundle execution failed: ${bundleId}`, error || 'Unknown error');
    }
  }

  // Enhanced profit summary logging for verified payouts
  verifiedPayoutSummary(
    protocol: string,
    claimedUsd: number,
    gasUsd: number,
    netUsd: number,
    txHash: string,
    verified: boolean
  ): void {
    const status = verified ? '✅' : '❌';
    const verifiedText = verified ? 'verified=yes' : 'verified=no';
    this.info(`${status} ${protocol} claim: gross $${claimedUsd.toFixed(2)} | gas $${gasUsd.toFixed(2)} | net $${netUsd.toFixed(2)} | tx ${txHash} | ${verifiedText}`);
  }

  discoveryRun(protocol: string, walletCount: number, rewardCount: number): void {
    this.info(`Discovery completed: ${protocol} found ${rewardCount} rewards across ${walletCount} wallets`);
  }

  profitabilityCheck(bundleId: string, passed: boolean, reason?: string): void {
    if (passed) {
      this.debug(`Profitability check passed: ${bundleId}`);
    } else {
      this.debug(`Profitability check failed: ${bundleId} - ${reason}`);
    }
  }

  routerQuote(router: string, tokenIn: string, tokenOut: string, amountIn: string, quote: string | null): void {
    if (quote) {
      this.debug(`Router quote [${router}]: ${amountIn} ${tokenIn} → ${quote} ${tokenOut}`);
    } else {
      this.debug(`Router quote [${router}]: No route found for ${amountIn} ${tokenIn} → ${tokenOut}`);
    }
  }

  routerEvaluation(router: string, evaluation: {
    profitable: boolean;
    profitUsd: number;
    gasUsd: number;
    priceImpact: number;
    score: number;
  }): void {
    const status = evaluation.profitable ? 'PROFITABLE' : 'UNPROFITABLE';
    this.info(`Router evaluation [${router}]: ${status} - Profit: $${evaluation.profitUsd.toFixed(2)}, Gas: $${evaluation.gasUsd.toFixed(2)}, Impact: ${(evaluation.priceImpact * 100).toFixed(2)}%, Score: ${evaluation.score}`);
  }

  slippageProtection(config: { tolerance: number; deadline: number; warnings: string[] }): void {
    this.debug(`Slippage protection: ${(config.tolerance * 100).toFixed(2)}% tolerance, ${Math.floor((config.deadline - Date.now() / 1000) / 60)}min deadline`);
    if (config.warnings.length > 0) {
      config.warnings.forEach(warning => this.warn(`Slippage warning: ${warning}`));
    }
  }

  pairDiscovery(tokenA: string, tokenB: string, pairCount: number): void {
    this.debug(`Pair discovery: Found ${pairCount} pairs for ${tokenA}/${tokenB}`);
  }

  priceImpactWarning(impact: number, threshold: number = 0.05): void {
    if (impact > threshold) {
      this.warn(`High price impact detected: ${(impact * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`);
    }
  }

  routerComparison(best: string | null, evaluations: number): void {
    if (best) {
      this.info(`Router comparison: Best route found via ${best} (${evaluations} evaluations)`);
    } else {
      this.warn(`Router comparison: No profitable routes found (${evaluations} evaluations)`);
    }
  }

  phase4Metrics(metrics: {
    quotesRequested: number;
    quotesSuccessful: number;
    averageGasUsd: number;
    averagePriceImpact: number;
    profitableRoutes: number;
  }): void {
    const successRate = metrics.quotesRequested > 0 ? (metrics.quotesSuccessful / metrics.quotesRequested) * 100 : 0;
    this.info(`Phase 4 metrics: ${metrics.quotesSuccessful}/${metrics.quotesRequested} quotes (${successRate.toFixed(1)}%), Avg gas: $${metrics.averageGasUsd.toFixed(2)}, Avg impact: ${(metrics.averagePriceImpact * 100).toFixed(2)}%, Profitable: ${metrics.profitableRoutes}`);
  }
}

// Global logger instance
export const logger = new Logger(process.env.LOG_LEVEL || 'info');