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

import { config } from 'dotenv';
import { createTraderJoeEvaluator, quickEvaluate } from '../engine/traderJoeEvaluator.js';
import { AVALANCHE_TOKENS } from '../routers/traderJoe/TraderJoeRouter.js';
import { phase4Metrics } from '../metrics/phase4.js';
import { validatePhase4Env, env } from '../config/env.js';
import { logger } from '../engine/logger.js';
import { 
  sendTelegramAlert, 
  createProfitableOpportunityAlert, 
  createExecutionErrorAlert,
  createSystemStatusAlert,
  createEvaluationSummaryAlert 
} from '../notifications/telegram.js';

// Load environment variables
config();

/**
 * Loop configuration
 */
const LOOP_CONFIG = {
  intervalMs: 3000, // 3 seconds
  maxIterations: process.env.MAX_ITERATIONS ? parseInt(process.env.MAX_ITERATIONS) : 0, // 0 = infinite
  gracefulShutdownTimeoutMs: 5000,
  
  // Token pairs to evaluate continuously
  testPairs: [
    ['WAVAX', 'USDC'],
    ['JOE', 'USDC'], 
    ['JOE', 'WAVAX']
  ] as const,
  
  // Test amounts in USD equivalent
  testAmounts: [100, 500, 1000],
  
  // Detailed logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  structuredLogging: true,
  
  // Notification configuration
  notifications: {
    // Send alerts for opportunities with profit above this threshold
    profitabilityThresholdUsd: parseFloat(process.env.NOTIFICATION_PROFIT_THRESHOLD || '1.0'),
    // Minimum execution score to trigger profitable opportunity alerts
    minExecutionScore: parseFloat(process.env.NOTIFICATION_MIN_SCORE || '70'),
    // Send summary alerts every N iterations
    summaryIntervalIterations: parseInt(process.env.NOTIFICATION_SUMMARY_INTERVAL || '100'),
    // Cooldown between similar notifications (in milliseconds)
    cooldownMs: parseInt(process.env.NOTIFICATION_COOLDOWN_MS || '300000') // 5 minutes default
  }
};

/**
 * Interface for structured JSON evaluation results
 */
interface EvaluationResult {
  timestamp: string;
  iteration: number;
  pair: string;
  amountUsd: number;
  evaluation: {
    profitable: boolean;
    profitUsd: number;
    gasUsd: number;
    netUsd: number;
    priceImpact: number;
    executionScore: number;
    warnings: string[];
    errors: string[];
  };
  quote?: {
    inputAmount: string;
    outputAmount: string;
    executionPrice: number;
    route: {
      input: string;
      output: string;
    };
  };
  metrics: {
    totalEvaluations: number;
    successfulEvaluations: number;
    profitableEvaluations: number;
    averageResponseTime: number;
  };
}

/**
 * Phase 4 continuous evaluation loop
 */
class Phase4Loop {
  private running = false;
  private iteration = 0;
  private evaluator: ReturnType<typeof createTraderJoeEvaluator>;
  private gracefulShutdown = false;
  
  // Notification tracking
  private lastNotificationTime = new Map<string, number>();
  private profitableOpportunities: Array<{
    pair: string;
    amountUsd: number;
    profitUsd: number;
    netUsd: number;
    executionScore: number;
    timestamp: number;
  }> = [];

  constructor() {
    this.evaluator = createTraderJoeEvaluator();
    this.setupGracefulShutdown();
  }

  /**
   * Start the continuous evaluation loop
   */
  async start(): Promise<void> {
    logger.info('🚀 Starting Phase 4 continuous dry-run evaluation loop');
    
    try {
      // Validate environment
      logger.info('Validating Phase 4 environment...');
      validatePhase4Env();
      logger.info('✅ Environment validation passed');

      // Reset metrics for clean start
      phase4Metrics.reset();
      
      this.running = true;
      this.logStructured({
        type: 'loop_started',
        timestamp: new Date().toISOString(),
        config: LOOP_CONFIG
      });

      // Send startup notification
      await this.sendStartupNotification();

      await this.runLoop();

    } catch (error) {
      logger.error('❌ Phase 4 loop startup failed:', error);
      this.logStructured({
        type: 'loop_error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    }
  }

  /**
   * Stop the evaluation loop
   */
  stop(): void {
    logger.info('🛑 Stopping Phase 4 evaluation loop...');
    this.running = false;
    this.gracefulShutdown = true;
  }

  /**
   * Main evaluation loop
   */
  private async runLoop(): Promise<void> {
    while (this.running && !this.gracefulShutdown) {
      this.iteration++;
      const startTime = Date.now();

      try {
        // Check max iterations limit
        if (LOOP_CONFIG.maxIterations > 0 && this.iteration > LOOP_CONFIG.maxIterations) {
          logger.info(`📊 Reached maximum iterations (${LOOP_CONFIG.maxIterations}), stopping...`);
          break;
        }

        // Perform evaluations for all pairs and amounts
        await this.performEvaluations();

        // Calculate and log iteration metrics
        const iterationTime = Date.now() - startTime;
        await this.logIterationMetrics(iterationTime);

        // Wait for next iteration
        if (this.running && !this.gracefulShutdown) {
          await this.sleep(LOOP_CONFIG.intervalMs);
        }

      } catch (error) {
        logger.error(`❌ Error in iteration ${this.iteration}:`, error);
        this.logStructured({
          type: 'iteration_error',
          timestamp: new Date().toISOString(),
          iteration: this.iteration,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Continue to next iteration after brief pause
        if (this.running && !this.gracefulShutdown) {
          await this.sleep(1000);
        }
      }
    }

    await this.shutdown();
  }

  /**
   * Perform evaluations for all configured pairs and amounts
   */
  private async performEvaluations(): Promise<void> {
    for (const [tokenInSymbol, tokenOutSymbol] of LOOP_CONFIG.testPairs) {
      for (const amountUsd of LOOP_CONFIG.testAmounts) {
        if (!this.running || this.gracefulShutdown) break;

        try {
          const startTime = Date.now();
          const evaluation = await quickEvaluate(tokenInSymbol, tokenOutSymbol, amountUsd);
          const responseTime = Date.now() - startTime;

          // Create structured result
          const result: EvaluationResult = {
            timestamp: new Date().toISOString(),
            iteration: this.iteration,
            pair: `${tokenInSymbol}/${tokenOutSymbol}`,
            amountUsd,
            evaluation: {
              profitable: evaluation.profitable,
              profitUsd: evaluation.profitUsd,
              gasUsd: evaluation.gasUsd,
              netUsd: evaluation.netUsd,
              priceImpact: evaluation.priceImpact,
              executionScore: evaluation.executionScore,
              warnings: evaluation.warnings,
              errors: evaluation.errors
            },
            metrics: this.getCurrentMetrics()
          };

          // Add quote details if available
          if (evaluation.quote) {
            result.quote = {
              inputAmount: evaluation.quote.inputAmount.toString(),
              outputAmount: evaluation.quote.outputAmount.toString(),
              executionPrice: evaluation.quote.executionPrice,
              route: {
                input: evaluation.quote.route.input.symbol,
                output: evaluation.quote.route.output.symbol
              }
            };
          }

          // Log structured JSON result
          this.logStructured({
            type: 'evaluation_result',
            ...result,
            responseTimeMs: responseTime
          });

          // Log summary for console readability
          const status = evaluation.profitable ? '✅ PROFITABLE' : '❌ UNPROFITABLE';
          logger.info(`[${this.iteration}] ${result.pair} ($${amountUsd}): ${status} - Profit: $${evaluation.profitUsd.toFixed(2)}, Score: ${evaluation.executionScore.toFixed(1)}/100`);

          // Check if we should send notifications based on evaluation status
          await this.handleEvaluationNotifications(result);

        } catch (error) {
          logger.error(`❌ Evaluation failed for ${tokenInSymbol}/${tokenOutSymbol}:`, error);
          this.logStructured({
            type: 'evaluation_error',
            timestamp: new Date().toISOString(),
            iteration: this.iteration,
            pair: `${tokenInSymbol}/${tokenOutSymbol}`,
            amountUsd,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Send error notification if significant
          await this.handleErrorNotification(error, {
            pair: `${tokenInSymbol}/${tokenOutSymbol}`,
            amountUsd,
            iteration: this.iteration
          });
        }
      }
    }
  }

  /**
   * Get current metrics from phase4 metrics collector
   */
  private getCurrentMetrics(): EvaluationResult['metrics'] {
    const metrics = phase4Metrics.getMetrics();
    const routerMetrics = Array.from(metrics.routerPerformance.values());
    const avgResponseTime = routerMetrics.length > 0 
      ? routerMetrics.reduce((sum, r) => sum + r.averageResponseTime, 0) / routerMetrics.length 
      : 0;
    
    return {
      totalEvaluations: metrics.totalQuotes,
      successfulEvaluations: metrics.successfulQuotes,
      profitableEvaluations: metrics.profitableEvaluations,
      averageResponseTime: avgResponseTime
    };
  }

  /**
   * Log iteration summary metrics
   */
  private async logIterationMetrics(iterationTimeMs: number): Promise<void> {
    const metrics = phase4Metrics.getMetrics();
    const routerMetrics = Array.from(metrics.routerPerformance.values());
    const avgResponseTime = routerMetrics.length > 0 
      ? routerMetrics.reduce((sum, r) => sum + r.averageResponseTime, 0) / routerMetrics.length 
      : 0;
    
    this.logStructured({
      type: 'iteration_summary',
      timestamp: new Date().toISOString(),
      iteration: this.iteration,
      iterationTimeMs,
      totalRuntime: Date.now() - metrics.startTime.getTime(),
      evaluationsSinceStart: metrics.totalQuotes,
      successRate: metrics.totalQuotes > 0 ? (metrics.successfulQuotes / metrics.totalQuotes) * 100 : 0,
      profitabilityRate: metrics.totalQuotes > 0 ? (metrics.profitableEvaluations / metrics.totalQuotes) * 100 : 0,
      averageResponseTime: avgResponseTime
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    logger.info('🔄 Performing graceful shutdown...');
    
    // Log final metrics
    this.logStructured({
      type: 'loop_stopped',
      timestamp: new Date().toISOString(),
      totalIterations: this.iteration,
      finalMetrics: this.getCurrentMetrics()
    });

    logger.info('✅ Phase 4 evaluation loop stopped gracefully');
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = () => {
      if (!this.gracefulShutdown) {
        logger.info('🔄 Received shutdown signal, initiating graceful shutdown...');
        this.gracefulShutdown = true;
        this.stop();
        
        // Force exit after timeout
        setTimeout(() => {
          logger.warn('⚠️ Graceful shutdown timeout, forcing exit');
          process.exit(1);
        }, LOOP_CONFIG.gracefulShutdownTimeoutMs);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown); // For nodemon
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Structured JSON logging
   */
  private logStructured(data: any): void {
    if (LOOP_CONFIG.structuredLogging) {
      console.log(JSON.stringify(data, null, 0)); // Single line JSON
    }
  }

  /**
   * Send startup notification
   */
  private async sendStartupNotification(): Promise<void> {
    try {
      const alert = createSystemStatusAlert(
        'Phase 4 evaluation loop started successfully',
        {
          'Evaluation Interval': `${LOOP_CONFIG.intervalMs / 1000} seconds`,
          'Test Pairs': LOOP_CONFIG.testPairs.map(pair => pair.join('/')).join(', '),
          'Test Amounts': LOOP_CONFIG.testAmounts.map(amount => `$${amount}`).join(', '),
          'Max Iterations': LOOP_CONFIG.maxIterations || 'Unlimited'
        }
      );
      
      await sendTelegramAlert(alert);
    } catch (error) {
      logger.warn('Failed to send startup notification:', error);
    }
  }

  /**
   * Handle evaluation-based notifications
   */
  private async handleEvaluationNotifications(result: EvaluationResult): Promise<void> {
    try {
      // Check if this is a profitable opportunity worth notifying about
      if (result.evaluation.profitable && 
          result.evaluation.profitUsd >= LOOP_CONFIG.notifications.profitabilityThresholdUsd &&
          result.evaluation.executionScore >= LOOP_CONFIG.notifications.minExecutionScore) {
        
        // Check cooldown to avoid spam
        const notificationKey = `profitable_${result.pair}_${result.amountUsd}`;
        const now = Date.now();
        const lastNotification = this.lastNotificationTime.get(notificationKey) || 0;
        
        if (now - lastNotification >= LOOP_CONFIG.notifications.cooldownMs) {
          const alert = createProfitableOpportunityAlert(
            result.pair,
            result.amountUsd,
            result.evaluation.profitUsd,
            result.evaluation.netUsd,
            result.evaluation.executionScore
          );
          
          const sent = await sendTelegramAlert(alert);
          if (sent) {
            this.lastNotificationTime.set(notificationKey, now);
            
            // Track this opportunity
            this.profitableOpportunities.push({
              pair: result.pair,
              amountUsd: result.amountUsd,
              profitUsd: result.evaluation.profitUsd,
              netUsd: result.evaluation.netUsd,
              executionScore: result.evaluation.executionScore,
              timestamp: now
            });
          }
        }
      }

      // Send summary notifications at configured intervals
      if (this.iteration % LOOP_CONFIG.notifications.summaryIntervalIterations === 0) {
        await this.sendSummaryNotification();
      }
      
    } catch (error) {
      logger.warn('Failed to handle evaluation notifications:', error);
    }
  }

  /**
   * Handle error notifications
   */
  private async handleErrorNotification(error: unknown, context: Record<string, any>): Promise<void> {
    try {
      // Only send error notifications for repeated errors (to avoid spam)
      const errorKey = `error_${context.pair}`;
      const now = Date.now();
      const lastNotification = this.lastNotificationTime.get(errorKey) || 0;
      
      if (now - lastNotification >= LOOP_CONFIG.notifications.cooldownMs * 2) { // Longer cooldown for errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const alert = createExecutionErrorAlert(errorMessage, context);
        
        const sent = await sendTelegramAlert(alert);
        if (sent) {
          this.lastNotificationTime.set(errorKey, now);
        }
      }
      
    } catch (notificationError) {
      logger.warn('Failed to send error notification:', notificationError);
    }
  }

  /**
   * Send periodic summary notification
   */
  private async sendSummaryNotification(): Promise<void> {
    try {
      const now = Date.now();
      const summaryPeriod = LOOP_CONFIG.notifications.summaryIntervalIterations * LOOP_CONFIG.intervalMs;
      const cutoffTime = now - summaryPeriod;
      
      // Filter recent profitable opportunities
      const recentOpportunities = this.profitableOpportunities.filter(op => op.timestamp >= cutoffTime);
      const averageProfit = recentOpportunities.length > 0 
        ? recentOpportunities.reduce((sum, op) => sum + op.profitUsd, 0) / recentOpportunities.length 
        : 0;
      
      const metrics = this.getCurrentMetrics();
      const timespan = `${LOOP_CONFIG.notifications.summaryIntervalIterations} iterations (${Math.round(summaryPeriod / 60000)} minutes)`;
      
      const alert = createEvaluationSummaryAlert(
        metrics.totalEvaluations,
        recentOpportunities.length,
        averageProfit,
        timespan
      );
      
      await sendTelegramAlert(alert);
      
    } catch (error) {
      logger.warn('Failed to send summary notification:', error);
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const loop = new Phase4Loop();
    await loop.start();
  } catch (error) {
    logger.error('❌ Phase 4 loop failed to start:', error);
    process.exit(1);
  }
}

// Run the loop if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { Phase4Loop, LOOP_CONFIG };