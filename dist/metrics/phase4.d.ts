/**
 * Phase 4 Metrics Collection and Analysis
 * Tracks router performance, profitability, and system health with enhanced cycle reporting
 */
import type { Quote, RouterEvaluation } from '../routers/types.js';
/**
 * Cycle summary for reporting
 */
export interface CycleSummary {
    readonly cycleNumber: number;
    readonly startTime: Date;
    readonly endTime: Date;
    readonly duration: number;
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
    readonly averageResponseTime: number;
    readonly totalGasEstimated: number;
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
    readonly totalVolumeAnalyzed: number;
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
export declare class Phase4MetricsCollector {
    private startTime;
    private routerMetrics;
    private quoteHistory;
    private errorCounts;
    private currentCycle;
    private cycleSummaries;
    private currentCycleStart;
    private currentCycleData;
    private performanceWindow;
    /**
     * Start a new cycle
     */
    startCycle(): void;
    /**
     * Complete current cycle and generate summary
     */
    completeCycle(): CycleSummary;
    /**
     * Record discovery results
     */
    recordDiscovery(protocol: string, walletsFound: number, rewardsFound: number, totalRewardsUsd: number): void;
    /**
     * Record bundle creation
     */
    recordBundleCreation(bundleCount: number, totalGasUsd: number): void;
    /**
     * Record an error in current cycle
     */
    recordCycleError(errorType: string, message: string): void;
    /**
     * Record performance operation for monitoring
     */
    recordPerformanceOperation(operation: string, success: boolean, duration: number): void;
    /**
     * Get success rate for the performance window
     */
    getSuccessRate(): number;
    /**
     * Check if system performance is healthy
     */
    isPerformanceHealthy(): {
        healthy: boolean;
        warnings: string[];
    };
    /**
     * Generate recommendations based on cycle performance
     */
    private generateCycleRecommendations;
    /**
     * Record a quote request
     */
    recordQuote(router: string, tokenA: string, tokenB: string, amountUsd: number, responseTime: number, quote: Quote | null, error?: Error): void;
    /**
     * Record a router evaluation
     */
    recordEvaluation(router: string, evaluation: RouterEvaluation): void;
    /**
     * Get current metrics snapshot with enhanced cycle data
     */
    getMetrics(): Phase4Metrics;
    /**
     * Get router-specific metrics
     */
    getRouterMetrics(routerName: string): RouterMetrics | null;
    /**
     * Reset metrics (for testing or periodic resets)
     */
    reset(): void;
    /**
     * Get performance summary for logging
     */
    getPerformanceSummary(): {
        quotesRequested: number;
        quotesSuccessful: number;
        averageGasUsd: number;
        averagePriceImpact: number;
        profitableRoutes: number;
    };
    /**
     * Export metrics to JSON for analysis
     */
    exportMetrics(): string;
    private updateRouterMetrics;
    private isQuoteProfitable;
    private estimateTokenValueUsd;
}
export declare const phase4Metrics: Phase4MetricsCollector;
/**
 * Enhanced utility functions for Phase 4 monitoring
 */
/**
 * Get enhanced performance summary
 */
export declare function getEnhancedPerformanceSummary(): {
    quotesRequested: number;
    quotesSuccessful: number;
    averageGasUsd: number;
    averagePriceImpact: number;
    profitableRoutes: number;
    currentCycle: number;
    performanceHealthy: boolean;
    warnings: string[];
};
/**
 * Log current metrics with cycle information
 */
export declare function logPhase4Metrics(): void;
/**
 * Log cycle summary
 */
export declare function logCycleSummary(summary: CycleSummary): void;
/**
 * Get cycle performance trends
 */
export declare function getCyclePerformanceTrends(cycles?: number): {
    successRateTrend: number;
    profitabilityTrend: number;
    responseTrend: number;
    averageProfit: number;
};
/**
 * Utility to get metrics for external reporting
 */
export declare function getPhase4MetricsSnapshot(): Phase4Metrics;
//# sourceMappingURL=phase4.d.ts.map