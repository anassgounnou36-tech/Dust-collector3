#!/usr/bin/env tsx
/**
 * Phase 4 Continuous Dry-Run Evaluation Loop
 *
 * Continuously evaluates Trader Joe trading opportunities in dry-run mode,
 * logging structured JSON results every 3 seconds.
 *
 * Features:
 * - References Trader Joe single-hop evaluator
 * - Structured JSON logging with detailed metrics
 * - 3-second interval evaluation loop
 * - Graceful shutdown on SIGINT/SIGTERM
 * - Error handling and recovery
 *
 * Usage: npm run phase4:loop
 */
/**
 * Loop configuration
 */
declare const LOOP_CONFIG: {
    intervalMs: number;
    maxIterations: number;
    gracefulShutdownTimeoutMs: number;
    testPairs: readonly [readonly ["WAVAX", "USDC"], readonly ["JOE", "USDC"], readonly ["JOE", "WAVAX"]];
    testAmounts: number[];
    logLevel: string;
    structuredLogging: boolean;
    notifications: {
        profitabilityThresholdUsd: number;
        minExecutionScore: number;
        summaryIntervalIterations: number;
        cooldownMs: number;
    };
};
/**
 * Phase 4 continuous evaluation loop
 */
declare class Phase4Loop {
    private running;
    private iteration;
    private evaluator;
    private gracefulShutdown;
    private lastNotificationTime;
    private profitableOpportunities;
    constructor();
    /**
     * Start the continuous evaluation loop
     */
    start(): Promise<void>;
    /**
     * Stop the evaluation loop
     */
    stop(): void;
    /**
     * Main evaluation loop
     */
    private runLoop;
    /**
     * Perform evaluations for all configured pairs and amounts
     */
    private performEvaluations;
    /**
     * Get current metrics from phase4 metrics collector
     */
    private getCurrentMetrics;
    /**
     * Log iteration summary metrics
     */
    private logIterationMetrics;
    /**
     * Graceful shutdown
     */
    private shutdown;
    /**
     * Setup graceful shutdown handlers
     */
    private setupGracefulShutdown;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Structured JSON logging
     */
    private logStructured;
    /**
     * Send startup notification
     */
    private sendStartupNotification;
    /**
     * Handle evaluation-based notifications
     */
    private handleEvaluationNotifications;
    /**
     * Handle error notifications
     */
    private handleErrorNotification;
    /**
     * Send periodic summary notification
     */
    private sendSummaryNotification;
}
export { Phase4Loop, LOOP_CONFIG };
//# sourceMappingURL=runPhase4Loop.d.ts.map