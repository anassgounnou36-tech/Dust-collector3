"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
exports.executeWithTimeout = executeWithTimeout;
exports.addJitter = addJitter;
const policy_js_1 = require("../economics/policy.js");
const logger_js_1 = require("./logger.js");
class Scheduler {
    running = false;
    intervalId;
    intervalMs;
    jitterMs;
    maxRunTime;
    shutdownResolve;
    constructor(options = {}) {
        this.intervalMs = options.intervalMs || policy_js_1.Policy.SCHEDULE_TICK_INTERVAL_MS;
        this.jitterMs = options.jitterMs || policy_js_1.Policy.SCHEDULE_JITTER_MS;
        this.maxRunTime = options.maxRunTime || 30000; // 30 seconds default
    }
    async loop(tickFn) {
        if (this.running) {
            throw new Error('Scheduler is already running');
        }
        this.running = true;
        logger_js_1.logger.info(`Starting scheduler with ${this.intervalMs}ms interval (±${this.jitterMs}ms jitter)`);
        // Set up graceful shutdown handlers
        const shutdownPromise = this.setupShutdownHandlers();
        // Schedule first tick with initial delay
        this.scheduleNextTick(tickFn);
        // Wait for shutdown signal
        await shutdownPromise;
    }
    scheduleNextTick(tickFn) {
        if (!this.running)
            return;
        // Calculate next interval with jitter
        const jitter = (Math.random() - 0.5) * 2 * this.jitterMs;
        const delay = this.intervalMs + jitter;
        this.intervalId = setTimeout(async () => {
            if (!this.running)
                return;
            try {
                const startTime = Date.now();
                logger_js_1.logger.debug('Starting scheduler tick');
                // Create a timeout promise for max run time
                const timeoutPromise = new Promise((_, reject) => {
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
                logger_js_1.logger.debug(`Scheduler tick completed in ${duration}ms`);
                // Schedule next tick
                this.scheduleNextTick(tickFn);
            }
            catch (error) {
                logger_js_1.logger.error('Scheduler tick failed:', error);
                // Continue scheduling even after errors, but with a longer delay
                setTimeout(() => this.scheduleNextTick(tickFn), this.intervalMs * 2);
            }
        }, delay);
    }
    setupShutdownHandlers() {
        return new Promise((resolve) => {
            this.shutdownResolve = resolve;
            const shutdown = (signal) => {
                logger_js_1.logger.info(`Received ${signal}, initiating graceful shutdown...`);
                this.stop();
            };
            // Handle various shutdown signals
            process.on('SIGINT', () => shutdown('SIGINT'));
            process.on('SIGTERM', () => shutdown('SIGTERM'));
            // Handle uncaught exceptions and unhandled rejections
            process.on('uncaughtException', (error) => {
                logger_js_1.logger.error('Uncaught exception:', error);
                this.stop();
            });
            process.on('unhandledRejection', (reason, promise) => {
                logger_js_1.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
                this.stop();
            });
        });
    }
    stop() {
        if (!this.running)
            return;
        logger_js_1.logger.info('Stopping scheduler...');
        this.running = false;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = undefined;
        }
        if (this.shutdownResolve) {
            this.shutdownResolve();
            this.shutdownResolve = undefined;
        }
        logger_js_1.logger.info('Scheduler stopped');
    }
    isRunning() {
        return this.running;
    }
    getStats() {
        return {
            running: this.running,
            intervalMs: this.intervalMs,
            jitterMs: this.jitterMs,
            maxRunTime: this.maxRunTime
        };
    }
}
exports.Scheduler = Scheduler;
// Utility function for one-time execution with timeout
async function executeWithTimeout(operation, timeoutMs, timeoutMessage) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([operation(), timeoutPromise]);
}
// Utility function to add random jitter to delays
function addJitter(delayMs, jitterMs) {
    const jitter = (Math.random() - 0.5) * 2 * jitterMs;
    return Math.max(0, delayMs + jitter);
}
//# sourceMappingURL=scheduler.js.map