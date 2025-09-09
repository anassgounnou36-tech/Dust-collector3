import { Policy } from '../economics/policy.js';
import { logger } from './logger.js';

export interface SchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  maxRunTime?: number; // Maximum time a single tick should run (ms)
}

export class Scheduler {
  private running = false;
  private intervalId?: NodeJS.Timeout;
  private readonly intervalMs: number;
  private readonly jitterMs: number;
  private readonly maxRunTime: number;
  private shutdownResolve?: (value: void) => void;

  constructor(options: SchedulerOptions = {}) {
    this.intervalMs = options.intervalMs || Policy.SCHEDULE_TICK_INTERVAL_MS;
    this.jitterMs = options.jitterMs || Policy.SCHEDULE_JITTER_MS;
    this.maxRunTime = options.maxRunTime || 30000; // 30 seconds default
  }

  async loop(tickFn: () => Promise<void>): Promise<void> {
    if (this.running) {
      throw new Error('Scheduler is already running');
    }

    this.running = true;
    logger.info(`Starting scheduler with ${this.intervalMs}ms interval (±${this.jitterMs}ms jitter)`);

    // Set up graceful shutdown handlers
    const shutdownPromise = this.setupShutdownHandlers();

    // Schedule first tick with initial delay
    this.scheduleNextTick(tickFn);

    // Wait for shutdown signal
    await shutdownPromise;
  }

  private scheduleNextTick(tickFn: () => Promise<void>): void {
    if (!this.running) return;

    // Calculate next interval with jitter
    const jitter = (Math.random() - 0.5) * 2 * this.jitterMs;
    const delay = this.intervalMs + jitter;

    this.intervalId = setTimeout(async () => {
      if (!this.running) return;

      try {
        const startTime = Date.now();
        logger.debug('Starting scheduler tick');

        // Create a timeout promise for max run time
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Tick exceeded maximum run time of ${this.maxRunTime}ms`));
          }, this.maxRunTime);
        });

        // Race between tick execution and timeout
        await Promise.race([
          tickFn(),
          timeoutPromise
        ]);

        const duration = Date.now() - startTime;
        logger.debug(`Scheduler tick completed in ${duration}ms`);

        // Schedule next tick
        this.scheduleNextTick(tickFn);
      } catch (error) {
        logger.error('Scheduler tick failed:', error);
        
        // Continue scheduling even after errors, but with a longer delay
        setTimeout(() => this.scheduleNextTick(tickFn), this.intervalMs * 2);
      }
    }, delay);
  }

  private setupShutdownHandlers(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.shutdownResolve = resolve;

      const shutdown = (signal: string) => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        this.stop();
      };

      // Handle various shutdown signals
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      
      // Handle uncaught exceptions and unhandled rejections
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', error);
        this.stop();
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection at:', promise, 'reason:', reason);
        this.stop();
      });
    });
  }

  stop(): void {
    if (!this.running) return;

    logger.info('Stopping scheduler...');
    this.running = false;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined as any;
    }

    if (this.shutdownResolve) {
      this.shutdownResolve();
      this.shutdownResolve = undefined as any;
    }

    logger.info('Scheduler stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): {
    running: boolean;
    intervalMs: number;
    jitterMs: number;
    maxRunTime: number;
  } {
    return {
      running: this.running,
      intervalMs: this.intervalMs,
      jitterMs: this.jitterMs,
      maxRunTime: this.maxRunTime
    };
  }
}

// Utility function for one-time execution with timeout
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

// Utility function to add random jitter to delays
export function addJitter(delayMs: number, jitterMs: number): number {
  const jitter = (Math.random() - 0.5) * 2 * jitterMs;
  return Math.max(0, delayMs + jitter);
}