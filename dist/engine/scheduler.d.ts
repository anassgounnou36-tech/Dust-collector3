export interface SchedulerOptions {
    intervalMs?: number;
    jitterMs?: number;
    maxRunTime?: number;
}
export declare class Scheduler {
    private running;
    private intervalId?;
    private readonly intervalMs;
    private readonly jitterMs;
    private readonly maxRunTime;
    private shutdownResolve?;
    constructor(options?: SchedulerOptions);
    loop(tickFn: () => Promise<void>): Promise<void>;
    private scheduleNextTick;
    private setupShutdownHandlers;
    stop(): void;
    isRunning(): boolean;
    getStats(): {
        running: boolean;
        intervalMs: number;
        jitterMs: number;
        maxRunTime: number;
    };
}
export declare function executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number, timeoutMessage?: string): Promise<T>;
export declare function addJitter(delayMs: number, jitterMs: number): number;
//# sourceMappingURL=scheduler.d.ts.map