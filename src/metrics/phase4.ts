/**
 * Phase 4 Metrics Collection and Analysis
 * Tracks router performance, profitability, and system health with enhanced cycle reporting
 */

import type { Quote, RouterEvaluation } from '../routers/types.js';
import { logger } from '../engine/logger.js';
import { Policy } from '../economics/policy.js';

/**
 * Cycle summary for reporting
 */
export interface CycleSummary {
  readonly cycleNumber: number;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number; // milliseconds
  readonly walletsDiscovered: number;
  readonly rewardsFound: number;
  readonly bundlesCreated: number;
  readonly totalRewardsUsd: number;
  readonly totalGasUsd: number;
  readonly netProfitUsd: number;
  readonly quotesRequested: number;
  readonly quotesSuccessful: number;
  readonly averageResponseTime: number;
  readonly errors: Array<{
    type: string;
    count: number;
    message: string;
  }>;
  readonly warnings: string[];
  readonly recommendations: string[];
}

/**
 * Router performance metrics
 */
export interface RouterMetrics {
  readonly name: string;
  readonly quotesRequested: number;
  readonly quotesSuccessful: number;
  readonly quotesEmpty: number;
  readonly averageResponseTime: number; // milliseconds
  readonly totalGasEstimated: number; // USD
  readonly totalVolumeUsd: number;
  readonly averagePriceImpact: number;
  readonly profitableQuotes: number;
  readonly lastUpdated: Date;
}

/**
 * Enhanced Phase 4 Metrics with cycle tracking
 */
export interface Phase4Metrics {
  readonly startTime: Date;
  readonly totalQuotes: number;
  readonly successfulQuotes: number;
  readonly profitableEvaluations: number;
  readonly totalVolumeAnalyzed: number; // USD
  readonly averageGasUsd: number;
  readonly averagePriceImpact: number;
  readonly routerPerformance: Map<string, RouterMetrics>;
  readonly topTokenPairs: Array<{
    tokenA: string;
    tokenB: string;
    quoteCount: number;
    totalVolume: number;
  }>;
  readonly errorCounts: Map<string, number>;
  readonly currentCycle: number;
  readonly cycleSummaries: CycleSummary[];
  readonly performanceWindow: Array<{
    timestamp: Date;
    operation: string;
    success: boolean;
    duration: number;
  }>;
}

/**
 * Enhanced metrics collector with cycle tracking
 */
export class Phase4MetricsCollector {
  private startTime: Date = new Date();
  private routerMetrics: Map<string, RouterMetrics> = new Map();
  private quoteHistory: Array<{
    timestamp: Date;
    router: string;
    tokenA: string;
    tokenB: string;
    amountUsd: number;
    successful: boolean;
    responseTime: number;
    gasUsd?: number;
    priceImpact?: number;
    profitable?: boolean;
  }> = [];
  private errorCounts: Map<string, number> = new Map();
  
  // Enhanced cycle tracking
  private currentCycle: number = 0;
  private cycleSummaries: CycleSummary[] = [];
  private currentCycleStart: Date = new Date();
  private currentCycleData = {
    walletsDiscovered: 0,
    rewardsFound: 0,
    bundlesCreated: 0,
    totalRewardsUsd: 0,
    totalGasUsd: 0,
    errors: new Map<string, { count: number; message: string }>(),
    warnings: new Set<string>(),
  };
  
  // Performance monitoring window
  private performanceWindow: Array<{
    timestamp: Date;
    operation: string;
    success: boolean;
    duration: number;
  }> = [];

  /**
   * Start a new cycle
   */
  startCycle(): void {
    this.currentCycle++;
    this.currentCycleStart = new Date();
    this.currentCycleData = {
      walletsDiscovered: 0,
      rewardsFound: 0,
      bundlesCreated: 0,
      totalRewardsUsd: 0,
      totalGasUsd: 0,
      errors: new Map(),
      warnings: new Set(),
    };
    
    logger.info(`Phase 4: Starting cycle ${this.currentCycle}`);
  }

  /**
   * Complete current cycle and generate summary
   */
  completeCycle(): CycleSummary {
    const endTime = new Date();
    const duration = endTime.getTime() - this.currentCycleStart.getTime();
    
    // Get cycle quote statistics
    const cycleQuotes = this.quoteHistory.filter(q => 
      q.timestamp >= this.currentCycleStart && q.timestamp <= endTime
    );
    
    const summary: CycleSummary = {
      cycleNumber: this.currentCycle,
      startTime: this.currentCycleStart,
      endTime,
      duration,
      walletsDiscovered: this.currentCycleData.walletsDiscovered,
      rewardsFound: this.currentCycleData.rewardsFound,
      bundlesCreated: this.currentCycleData.bundlesCreated,
      totalRewardsUsd: this.currentCycleData.totalRewardsUsd,
      totalGasUsd: this.currentCycleData.totalGasUsd,
      netProfitUsd: this.currentCycleData.totalRewardsUsd - this.currentCycleData.totalGasUsd,
      quotesRequested: cycleQuotes.length,
      quotesSuccessful: cycleQuotes.filter(q => q.successful).length,
      averageResponseTime: cycleQuotes.length > 0 
        ? cycleQuotes.reduce((sum, q) => sum + q.responseTime, 0) / cycleQuotes.length 
        : 0,
      errors: Array.from(this.currentCycleData.errors.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        message: data.message
      })),
      warnings: Array.from(this.currentCycleData.warnings),
      recommendations: this.generateCycleRecommendations(cycleQuotes)
    };
    
    this.cycleSummaries.push(summary);
    
    // Keep only recent cycle summaries
    if (this.cycleSummaries.length > 50) {
      this.cycleSummaries = this.cycleSummaries.slice(-50);
    }
    
    logger.info(`Phase 4: Completed cycle ${this.currentCycle}`, {
      duration: `${(duration / 1000).toFixed(1)}s`,
      walletsDiscovered: summary.walletsDiscovered,
      rewardsFound: summary.rewardsFound,
      netProfitUsd: `$${summary.netProfitUsd.toFixed(2)}`
    });
    
    return summary;
  }

  /**
   * Record discovery results
   */
  recordDiscovery(protocol: string, walletsFound: number, rewardsFound: number, totalRewardsUsd: number): void {
    this.currentCycleData.walletsDiscovered += walletsFound;
    this.currentCycleData.rewardsFound += rewardsFound;
    this.currentCycleData.totalRewardsUsd += totalRewardsUsd;
    
    this.recordPerformanceOperation('discovery', true, 0);
    
    logger.info(`Discovery completed for ${protocol}`, {
      walletsFound,
      rewardsFound,
      totalRewardsUsd: `$${totalRewardsUsd.toFixed(2)}`
    });
  }

  /**
   * Record bundle creation
   */
  recordBundleCreation(bundleCount: number, totalGasUsd: number): void {
    this.currentCycleData.bundlesCreated += bundleCount;
    this.currentCycleData.totalGasUsd += totalGasUsd;
    
    this.recordPerformanceOperation('bundling', true, 0);
  }

  /**
   * Record an error in current cycle
   */
  recordCycleError(errorType: string, message: string): void {
    const existing = this.currentCycleData.errors.get(errorType);
    if (existing) {
      existing.count++;
    } else {
      this.currentCycleData.errors.set(errorType, { count: 1, message });
    }
    
    this.recordPerformanceOperation(errorType, false, 0);
  }

  /**
   * Record performance operation for monitoring
   */
  recordPerformanceOperation(operation: string, success: boolean, duration: number): void {
    this.performanceWindow.push({
      timestamp: new Date(),
      operation,
      success,
      duration
    });
    
    // Keep window size manageable
    if (this.performanceWindow.length > Policy.PERFORMANCE_METRICS_WINDOW_SIZE) {
      this.performanceWindow = this.performanceWindow.slice(-Policy.PERFORMANCE_METRICS_WINDOW_SIZE);
    }
  }

  /**
   * Get success rate for the performance window
   */
  getSuccessRate(): number {
    if (this.performanceWindow.length === 0) return 1.0;
    
    const successful = this.performanceWindow.filter(op => op.success).length;
    return successful / this.performanceWindow.length;
  }

  /**
   * Check if system performance is healthy
   */
  isPerformanceHealthy(): { healthy: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let healthy = true;
    
    const successRate = this.getSuccessRate();
    if (successRate < Policy.SUCCESS_RATE_WARNING_THRESHOLD) {
      warnings.push(`Success rate ${(successRate * 100).toFixed(1)}% below threshold ${(Policy.SUCCESS_RATE_WARNING_THRESHOLD * 100).toFixed(1)}%`);
      healthy = false;
    }
    
    // Check for error spikes
    const recentErrors = this.performanceWindow.filter(op => 
      !op.success && 
      op.timestamp.getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );
    
    if (recentErrors.length > 5) {
      warnings.push(`High error rate: ${recentErrors.length} errors in last 5 minutes`);
      healthy = false;
    }
    
    return { healthy, warnings };
  }

  /**
   * Generate recommendations based on cycle performance
   */
  private generateCycleRecommendations(cycleQuotes: typeof this.quoteHistory): string[] {
    const recommendations: string[] = [];
    
    const successRate = cycleQuotes.length > 0 
      ? cycleQuotes.filter(q => q.successful).length / cycleQuotes.length 
      : 0;
    
    if (successRate < 0.8) {
      recommendations.push('Consider checking network connectivity and RPC endpoints');
    }
    
    const avgResponseTime = cycleQuotes.length > 0
      ? cycleQuotes.reduce((sum, q) => sum + q.responseTime, 0) / cycleQuotes.length
      : 0;
    
    if (avgResponseTime > 5000) { // 5 seconds
      recommendations.push('High response times detected - consider optimizing RPC calls');
    }
    
    const highGasCost = cycleQuotes.filter(q => (q.gasUsd || 0) > 10).length;
    if (highGasCost > cycleQuotes.length * 0.3) {
      recommendations.push('High gas costs detected - consider waiting for lower gas prices');
    }
    
    if (this.currentCycleData.rewardsFound === 0) {
      recommendations.push('No rewards found - consider expanding wallet discovery scope');
    }
    
    const netProfit = this.currentCycleData.totalRewardsUsd - this.currentCycleData.totalGasUsd;
    if (netProfit < 0) {
      recommendations.push('Negative net profit - review profitability thresholds');
    }
    
    return recommendations;
  }

  /**
   * Record a quote request
   */
  recordQuote(
    router: string,
    tokenA: string,
    tokenB: string,
    amountUsd: number,
    responseTime: number,
    quote: Quote | null,
    error?: Error
  ): void {
    const successful = quote !== null && !error;
    const profitable = quote ? this.isQuoteProfitable(quote) : false;

    // Update router metrics
    this.updateRouterMetrics(router, {
      successful,
      responseTime,
      gasUsd: quote?.gasUsd || 0,
      priceImpact: quote?.priceImpact || 0,
      profitable,
      volumeUsd: amountUsd
    });

    // Record in history
    this.quoteHistory.push({
      timestamp: new Date(),
      router,
      tokenA,
      tokenB,
      amountUsd,
      successful,
      responseTime,
      gasUsd: quote?.gasUsd,
      priceImpact: quote?.priceImpact,
      profitable
    });

    // Record error if present
    if (error) {
      const errorKey = `${router}:${error.name}`;
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }

    // Log quote for debugging
    logger.routerQuote(
      router,
      tokenA,
      tokenB,
      amountUsd.toFixed(2),
      quote ? quote.outputAmount.toString() : null
    );
  }

  /**
   * Record a router evaluation
   */
  recordEvaluation(router: string, evaluation: RouterEvaluation): void {
    logger.routerEvaluation(router, {
      profitable: evaluation.profitable,
      profitUsd: evaluation.profitUsd,
      gasUsd: evaluation.gasUsd,
      priceImpact: evaluation.priceImpact,
      score: evaluation.executionScore
    });
  }

  /**
   * Get current metrics snapshot with enhanced cycle data
   */
  getMetrics(): Phase4Metrics {
    const totalQuotes = this.quoteHistory.length;
    const successfulQuotes = this.quoteHistory.filter(q => q.successful).length;
    const profitableEvaluations = this.quoteHistory.filter(q => q.profitable).length;
    
    const totalVolumeAnalyzed = this.quoteHistory.reduce((sum, q) => sum + q.amountUsd, 0);
    const successfulWithGas = this.quoteHistory.filter(q => q.successful && q.gasUsd !== undefined);
    const averageGasUsd = successfulWithGas.length > 0 
      ? successfulWithGas.reduce((sum, q) => sum + (q.gasUsd || 0), 0) / successfulWithGas.length
      : 0;

    const successfulWithImpact = this.quoteHistory.filter(q => q.successful && q.priceImpact !== undefined);
    const averagePriceImpact = successfulWithImpact.length > 0
      ? successfulWithImpact.reduce((sum, q) => sum + (q.priceImpact || 0), 0) / successfulWithImpact.length
      : 0;

    // Calculate top token pairs
    const pairCounts = new Map<string, { count: number; volume: number }>();
    this.quoteHistory.forEach(q => {
      const pairKey = `${q.tokenA}/${q.tokenB}`;
      const existing = pairCounts.get(pairKey) || { count: 0, volume: 0 };
      pairCounts.set(pairKey, {
        count: existing.count + 1,
        volume: existing.volume + q.amountUsd
      });
    });

    const topTokenPairs = Array.from(pairCounts.entries())
      .map(([pair, data]) => {
        const [tokenA, tokenB] = pair.split('/');
        return { tokenA, tokenB, quoteCount: data.count, totalVolume: data.volume };
      })
      .sort((a, b) => b.quoteCount - a.quoteCount)
      .slice(0, 10);

    return {
      startTime: this.startTime,
      totalQuotes,
      successfulQuotes,
      profitableEvaluations,
      totalVolumeAnalyzed,
      averageGasUsd,
      averagePriceImpact,
      routerPerformance: new Map(this.routerMetrics),
      topTokenPairs,
      errorCounts: new Map(this.errorCounts),
      currentCycle: this.currentCycle,
      cycleSummaries: [...this.cycleSummaries],
      performanceWindow: [...this.performanceWindow]
    };
  }

  /**
   * Get router-specific metrics
   */
  getRouterMetrics(routerName: string): RouterMetrics | null {
    return this.routerMetrics.get(routerName) || null;
  }

  /**
   * Reset metrics (for testing or periodic resets)
   */
  reset(): void {
    this.startTime = new Date();
    this.routerMetrics.clear();
    this.quoteHistory = [];
    this.errorCounts.clear();
  }

  /**
   * Get performance summary for logging
   */
  getPerformanceSummary(): {
    quotesRequested: number;
    quotesSuccessful: number;
    averageGasUsd: number;
    averagePriceImpact: number;
    profitableRoutes: number;
  } {
    const metrics = this.getMetrics();
    return {
      quotesRequested: metrics.totalQuotes,
      quotesSuccessful: metrics.successfulQuotes,
      averageGasUsd: metrics.averageGasUsd,
      averagePriceImpact: metrics.averagePriceImpact,
      profitableRoutes: metrics.profitableEvaluations
    };
  }

  /**
   * Export metrics to JSON for analysis
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();
    const exportData = {
      ...metrics,
      routerPerformance: Object.fromEntries(metrics.routerPerformance),
      errorCounts: Object.fromEntries(metrics.errorCounts),
      quoteHistory: this.quoteHistory
    };
    return JSON.stringify(exportData, null, 2);
  }

  private updateRouterMetrics(
    router: string,
    data: {
      successful: boolean;
      responseTime: number;
      gasUsd: number;
      priceImpact: number;
      profitable: boolean;
      volumeUsd: number;
    }
  ): void {
    const existing = this.routerMetrics.get(router) || {
      name: router,
      quotesRequested: 0,
      quotesSuccessful: 0,
      quotesEmpty: 0,
      averageResponseTime: 0,
      totalGasEstimated: 0,
      totalVolumeUsd: 0,
      averagePriceImpact: 0,
      profitableQuotes: 0,
      lastUpdated: new Date()
    };

    const newRequested = existing.quotesRequested + 1;
    const newSuccessful = existing.quotesSuccessful + (data.successful ? 1 : 0);
    const newEmpty = existing.quotesEmpty + (!data.successful ? 1 : 0);
    const newProfitable = existing.profitableQuotes + (data.profitable ? 1 : 0);

    // Calculate running averages
    const newAverageResponseTime = 
      (existing.averageResponseTime * existing.quotesRequested + data.responseTime) / newRequested;
    
    const newTotalGas = existing.totalGasEstimated + data.gasUsd;
    const newTotalVolume = existing.totalVolumeUsd + data.volumeUsd;
    
    const newAveragePriceImpact = newSuccessful > 0
      ? (existing.averagePriceImpact * existing.quotesSuccessful + data.priceImpact) / newSuccessful
      : 0;

    this.routerMetrics.set(router, {
      name: router,
      quotesRequested: newRequested,
      quotesSuccessful: newSuccessful,
      quotesEmpty: newEmpty,
      averageResponseTime: newAverageResponseTime,
      totalGasEstimated: newTotalGas,
      totalVolumeUsd: newTotalVolume,
      averagePriceImpact: newAveragePriceImpact,
      profitableQuotes: newProfitable,
      lastUpdated: new Date()
    });
  }

  private isQuoteProfitable(quote: Quote): boolean {
    // Simple profitability check - profit after gas costs
    const inputUsd = this.estimateTokenValueUsd(quote.inputAmount, quote.route.input);
    const outputUsd = this.estimateTokenValueUsd(quote.outputAmount, quote.route.output);
    const netUsd = outputUsd - inputUsd - quote.gasUsd;
    return netUsd > 0;
  }

  private estimateTokenValueUsd(amount: bigint, token: any): number {
    // Simplified USD estimation - in real implementation would use price oracles
    // For now, assume 1:1 with USD for calculation purposes
    return Number(amount) / Math.pow(10, 18); // Assume 18 decimals
  }
}

// Global metrics collector instance
export const phase4Metrics = new Phase4MetricsCollector();

/**
 * Enhanced utility functions for Phase 4 monitoring
 */

/**
 * Get enhanced performance summary
 */
export function getEnhancedPerformanceSummary(): {
  quotesRequested: number;
  quotesSuccessful: number;
  averageGasUsd: number;
  averagePriceImpact: number;
  profitableRoutes: number;
  currentCycle: number;
  performanceHealthy: boolean;
  warnings: string[];
} {
  const summary = phase4Metrics.getPerformanceSummary();
  const health = phase4Metrics.isPerformanceHealthy();
  const metrics = phase4Metrics.getMetrics();
  
  return {
    ...summary,
    currentCycle: metrics.currentCycle,
    performanceHealthy: health.healthy,
    warnings: health.warnings
  };
}

/**
 * Log current metrics with cycle information
 */
export function logPhase4Metrics(): void {
  const enhancedSummary = getEnhancedPerformanceSummary();
  logger.phase4Metrics(enhancedSummary);
}

/**
 * Log cycle summary
 */
export function logCycleSummary(summary: CycleSummary): void {
  logger.info(`Cycle ${summary.cycleNumber} Summary`, {
    duration: `${(summary.duration / 1000).toFixed(1)}s`,
    walletsDiscovered: summary.walletsDiscovered,
    rewardsFound: summary.rewardsFound,
    bundlesCreated: summary.bundlesCreated,
    netProfitUsd: `$${summary.netProfitUsd.toFixed(2)}`,
    quotesSuccessRate: summary.quotesRequested > 0 
      ? `${((summary.quotesSuccessful / summary.quotesRequested) * 100).toFixed(1)}%`
      : 'N/A',
    averageResponseTime: `${summary.averageResponseTime.toFixed(0)}ms`,
    errorsCount: summary.errors.length,
    warningsCount: summary.warnings.length,
    recommendationsCount: summary.recommendations.length
  });
  
  // Log detailed recommendations if any
  if (summary.recommendations.length > 0) {
    logger.info('Cycle Recommendations:', summary.recommendations);
  }
  
  // Log errors if any
  if (summary.errors.length > 0) {
    logger.warn('Cycle Errors:', summary.errors);
  }
}

/**
 * Get cycle performance trends
 */
export function getCyclePerformanceTrends(cycles: number = 10): {
  successRateTrend: number;
  profitabilityTrend: number;
  responseTrend: number;
  averageProfit: number;
} {
  const metrics = phase4Metrics.getMetrics();
  const recentCycles = metrics.cycleSummaries.slice(-cycles);
  
  if (recentCycles.length < 2) {
    return {
      successRateTrend: 0,
      profitabilityTrend: 0,
      responseTrend: 0,
      averageProfit: 0
    };
  }
  
  // Calculate trends
  const successRates = recentCycles.map(c => 
    c.quotesRequested > 0 ? c.quotesSuccessful / c.quotesRequested : 0
  );
  const profits = recentCycles.map(c => c.netProfitUsd);
  const responseTimes = recentCycles.map(c => c.averageResponseTime);
  
  const successRateTrend = calculateTrend(successRates);
  const profitabilityTrend = calculateTrend(profits);
  const responseTrend = calculateTrend(responseTimes);
  const averageProfit = profits.reduce((sum, p) => sum + p, 0) / profits.length;
  
  return {
    successRateTrend,
    profitabilityTrend,
    responseTrend,
    averageProfit
  };
}

/**
 * Calculate simple linear trend (positive = improving, negative = degrading)
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;
  
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
}

/**
 * Utility to get metrics for external reporting
 */
export function getPhase4MetricsSnapshot(): Phase4Metrics {
  return phase4Metrics.getMetrics();
}