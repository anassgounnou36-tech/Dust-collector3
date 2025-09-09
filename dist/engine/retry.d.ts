import type { Address } from '../types/common.js';
export interface RetryableError extends Error {
    retryable: boolean;
    retryAfter?: number;
}
export declare function createRetryableError(message: string, retryable?: boolean, retryAfter?: number): RetryableError;
export declare function isRetryableError(error: any): error is RetryableError;
export declare function withExponentialBackoff<T>(operation: () => Promise<T>, maxAttempts?: number, baseDelayMs?: number, operationId?: string): Promise<T>;
export declare function quarantineWallet(wallet: Address, reason: string): void;
export declare function isWalletQuarantined(wallet: Address): boolean;
export declare function releaseQuarantine(wallet: Address): void;
export declare function getQuarantinedWallets(): Array<{
    wallet: Address;
    until: Date;
}>;
export declare function cleanupExpiredQuarantines(): void;
export declare function getRetryAttempt(operationId: string): number;
export declare function clearRetryTracking(): void;
export declare function getQuarantineStats(): {
    totalQuarantined: number;
    expiringSoon: number;
};
//# sourceMappingURL=retry.d.ts.map