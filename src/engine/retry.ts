import type { Address } from '../types/common.js';
import { Policy } from '../economics/policy.js';
import { logger } from './logger.js';

// In-memory quarantine store
const quarantineStore = new Map<string, number>();

// Retry attempt tracking
const retryAttempts = new Map<string, number>();

export interface RetryableError extends Error {
  retryable: boolean;
  retryAfter?: number; // milliseconds
}

export function createRetryableError(message: string, retryable: boolean = true, retryAfter?: number): RetryableError {
  const error = new Error(message) as RetryableError;
  error.retryable = retryable;
  error.retryAfter = retryAfter || undefined;
  return error;
}

export function isRetryableError(error: any): error is RetryableError {
  return error && typeof error === 'object' && 'retryable' in error;
}

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = Policy.RETRY_MAX_ATTEMPTS,
  baseDelayMs: number = Policy.RETRY_BASE_DELAY_MS,
  operationId?: string
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // Clear retry tracking on success
      if (operationId) {
        retryAttempts.delete(operationId);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (isRetryableError(error) && !error.retryable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * delay; // ±10% jitter
      const totalDelay = delay + jitter;
      
      logger.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${totalDelay.toFixed(0)}ms: ${lastError.message}`);
      
      // Track retry attempts
      if (operationId) {
        retryAttempts.set(operationId, attempt);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  // All attempts failed
  if (operationId) {
    retryAttempts.delete(operationId);
  }
  
  throw lastError || new Error('Operation failed after maximum attempts');
}

export function quarantineWallet(wallet: Address, reason: string): void {
  const key = `${wallet.chain}:${wallet.value}`;
  const quarantineUntil = Date.now() + (Policy.QUARANTINE_TTL_HOURS * 60 * 60 * 1000);
  
  quarantineStore.set(key, quarantineUntil);
  logger.warn(`Quarantined wallet ${wallet.value} on ${wallet.chain}: ${reason}`);
}

export function isWalletQuarantined(wallet: Address): boolean {
  const key = `${wallet.chain}:${wallet.value}`;
  const quarantineUntil = quarantineStore.get(key);
  
  if (!quarantineUntil) {
    return false;
  }
  
  if (Date.now() > quarantineUntil) {
    // Quarantine expired
    quarantineStore.delete(key);
    return false;
  }
  
  return true;
}

export function releaseQuarantine(wallet: Address): void {
  const key = `${wallet.chain}:${wallet.value}`;
  quarantineStore.delete(key);
  logger.info(`Released quarantine for wallet ${wallet.value} on ${wallet.chain}`);
}

export function getQuarantinedWallets(): Array<{ wallet: Address; until: Date }> {
  const result: Array<{ wallet: Address; until: Date }> = [];
  
  for (const [key, until] of quarantineStore.entries()) {
    const [chain, address] = key.split(':');
    if (chain && address) {
      result.push({
        wallet: { value: address, chain: chain as any },
        until: new Date(until)
      });
    }
  }
  
  return result;
}

export function cleanupExpiredQuarantines(): void {
  const now = Date.now();
  
  for (const [key, until] of quarantineStore.entries()) {
    if (now > until) {
      quarantineStore.delete(key);
    }
  }
}

export function getRetryAttempt(operationId: string): number {
  return retryAttempts.get(operationId) || 0;
}

export function clearRetryTracking(): void {
  retryAttempts.clear();
}

export function getQuarantineStats(): {
  totalQuarantined: number;
  expiringSoon: number; // within next hour
} {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  let expiringSoon = 0;
  
  for (const until of quarantineStore.values()) {
    if (until - now < oneHour) {
      expiringSoon++;
    }
  }
  
  return {
    totalQuarantined: quarantineStore.size,
    expiringSoon
  };
}