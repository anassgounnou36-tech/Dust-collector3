export interface DecisionPoint {
    id: string;
    passed: boolean;
    observed?: number | string | boolean | null;
    threshold?: number | string | boolean | null;
    weight?: number;
    message?: string;
    timestamp?: number;
}
export interface RouterState {
    routerName?: string;
    chainId?: number | string;
    rpcUrl?: string;
    networkConnected?: boolean;
    [k: string]: any;
}
export interface QuoteResult {
    success?: boolean;
    quote?: any;
    error?: string;
    timing?: number;
    [k: string]: any;
}
export interface EvaluationMetrics {
    [k: string]: number | string | boolean | null | undefined;
}
export interface EvaluationSession {
    id: string;
    startedAt: number;
    completedAt?: number;
    status?: string;
    routerState?: RouterState;
    quoteResult?: QuoteResult;
    decisions: DecisionPoint[];
    metrics?: EvaluationMetrics;
    warnings: string[];
    errors: string[];
    meta?: Record<string, any>;
}
export interface EvaluationSnapshot extends EvaluationSession {
    timestamp?: string;
    sessionId?: string;
    tradeInput?: any;
    evaluationCriteria?: any;
    calculatedMetrics?: any;
    decisionPoints?: DecisionPoint[];
    finalEvaluation?: any;
}
export declare class EvaluationDebugger {
    private sessions;
    private enabled;
    isEnabled(): boolean;
    enable(): void;
    disable(): void;
    clearSnapshots(): void;
    getAllSnapshots(): EvaluationSession[];
    private ensureSession;
    startSession(...args: any[]): string;
    recordRouterState(sessionId: string, ...args: any[]): void;
    recordQuoteResult(sessionId: string, ...args: any[]): void;
    recordDecision(sessionId: string, ...args: any[]): void;
    recordWarning(sessionId: string, warning: string): void;
    recordError(sessionId: string, error: string): void;
    recordMetrics(sessionId: string, metrics: EvaluationMetrics): void;
    completeSession(sessionId: string, ...args: any[]): void;
    getSession(id: string): EvaluationSession | undefined;
    getAllSessions(): EvaluationSession[];
    analyzeFailures(): {
        failureReasons: [string, number][];
        commonWarnings: [string, number][];
    };
}
export declare const evaluationDebugger: EvaluationDebugger;
export declare function analyzeFailedEvaluations(snapshots: EvaluationSnapshot[]): {
    totalEvaluations: number;
    failedEvaluations: number;
    failureReasons: Set<string>;
    commonWarnings: Set<string>;
    failureReasonsCounts: [string, number][];
    commonWarningsCounts: [string, number][];
};
//# sourceMappingURL=evaluationSnapshot.d.ts.map