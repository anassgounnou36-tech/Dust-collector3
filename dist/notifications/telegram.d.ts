/**
 * Telegram Bot API notification system for Phase 4
 *
 * Sends structured alerts about profitable trading opportunities,
 * execution errors, and system status updates using MarkdownV2 formatting.
 */
/**
 * Alert types for different notification scenarios
 */
export type AlertType = 'profitable_opportunity' | 'execution_error' | 'system_status' | 'evaluation_summary';
/**
 * Alert data structure
 */
export interface AlertData {
    type: AlertType;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
}
/**
 * Send Telegram alert using Bot API
 *
 * @param alert - Alert data to send
 * @returns Promise that resolves to true if sent successfully, false otherwise
 */
export declare function sendTelegramAlert(alert: AlertData): Promise<boolean>;
/**
 * Create a profitable opportunity alert
 */
export declare function createProfitableOpportunityAlert(pair: string, amountUsd: number, profitUsd: number, netUsd: number, executionScore: number): AlertData;
/**
 * Create an execution error alert
 */
export declare function createExecutionErrorAlert(error: string, context?: Record<string, any>): AlertData;
/**
 * Create a system status alert
 */
export declare function createSystemStatusAlert(status: string, details?: Record<string, any>): AlertData;
/**
 * Create an enhanced cycle summary alert
 */
export declare function createCycleSummaryAlert(cycleNumber: number, walletsDiscovered: number, rewardsFound: number, bundlesCreated: number, netProfitUsd: number, duration: number, successRate: number, recommendations: string[]): AlertData;
/**
 * Create a discovery progress alert
 */
export declare function createDiscoveryProgressAlert(protocol: string, walletsFound: number, rewardsFound: number, totalRewardsUsd: number): AlertData;
/**
 * Create a performance warning alert
 */
export declare function createPerformanceWarningAlert(warnings: string[], successRate: number, recentErrors: number): AlertData;
/**
 * Create a high-value opportunity alert
 */
export declare function createHighValueOpportunityAlert(protocol: string, pair: string, amountUsd: number, profitUsd: number, executionScore: number, specialNotes?: string): AlertData;
/**
 * Create a system startup alert
 */
export declare function createSystemStartupAlert(version: string, features: string[], configuration: Record<string, any>): AlertData;
/**
 * Create enhanced evaluation summary alert
 */
export declare function createEvaluationSummaryAlert(totalEvaluations: number, profitableCount: number, averageProfit: number, timespan: string): AlertData;
//# sourceMappingURL=telegram.d.ts.map