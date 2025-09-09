import crypto from 'crypto';
import type { ClaimBundle } from '../types/common.js';
import { Policy } from '../economics/policy.js';

// In-memory cache for idempotency tracking
const idempotencyCache = new Map<string, number>();

export function computeBundleHash(bundle: ClaimBundle): string {
  // Create a deterministic hash based on bundle contents
  const bundleData = {
    chain: bundle.chain,
    protocol: bundle.protocol,
    claimTo: bundle.claimTo.value,
    items: bundle.items.map(item => ({
      id: item.id,
      wallet: item.wallet.value,
      token: item.token.value,
      amountWei: item.amountWei
    })).sort((a, b) => a.id.localeCompare(b.id)) // Sort for consistency
  };
  
  const dataString = JSON.stringify(bundleData);
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

export function shouldSkipIdempotency(bundle: ClaimBundle): boolean {
  const hash = computeBundleHash(bundle);
  const now = Date.now();
  const ttlMs = Policy.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
  
  // Check if we've seen this bundle recently
  const lastSeen = idempotencyCache.get(hash);
  
  if (lastSeen && (now - lastSeen) < ttlMs) {
    return true; // Skip - recently processed
  }
  
  // Record this bundle as being processed
  idempotencyCache.set(hash, now);
  
  // Clean up old entries to prevent memory leaks
  cleanupExpiredEntries();
  
  return false; // Don't skip - safe to process
}

export function markBundleProcessed(bundle: ClaimBundle): void {
  const hash = computeBundleHash(bundle);
  idempotencyCache.set(hash, Date.now());
}

export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

export function getIdempotencyCacheSize(): number {
  return idempotencyCache.size;
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  const ttlMs = Policy.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
  
  for (const [hash, timestamp] of idempotencyCache.entries()) {
    if (now - timestamp > ttlMs) {
      idempotencyCache.delete(hash);
    }
  }
}

// Optional: Persistent idempotency store for production use
// This would replace the in-memory cache for better reliability across restarts
export interface PersistentIdempotencyStore {
  hasRecentlyProcessed(hash: string): Promise<boolean>;
  markProcessed(hash: string): Promise<void>;
  cleanup(): Promise<void>;
}

export class DatabaseIdempotencyStore implements PersistentIdempotencyStore {
  // TODO: Implement database-backed idempotency store
  // This would use the same SQLite database to persist idempotency records
  
  async hasRecentlyProcessed(_hash: string): Promise<boolean> {
    // TODO: Query database for recent processing of this hash
    throw new Error('DatabaseIdempotencyStore not implemented');
  }
  
  async markProcessed(_hash: string): Promise<void> {
    // TODO: Insert/update database record for this hash
    throw new Error('DatabaseIdempotencyStore not implemented');
  }
  
  async cleanup(): Promise<void> {
    // TODO: Remove expired idempotency records from database
    throw new Error('DatabaseIdempotencyStore not implemented');
  }
}