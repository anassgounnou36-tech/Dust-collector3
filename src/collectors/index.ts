/**
 * Central export for all wallet collectors
 */

export interface WalletRow {
  address: string;
  chain: string;
  source: string;
  balance_wei?: string;
  balance_tokens?: number;
  balance_usd?: number;
  token_symbol?: string;
  token_address?: string;
  discovered_at: string;
}

export interface CollectorConfig {
  pageSize?: number;
  limit?: number;
  concurrency?: number;
  rateLimit?: number;
}

export interface WalletCollector {
  name: string;
  collect(tokenAddress: string, config?: CollectorConfig): Promise<WalletRow[]>;
}

// Export all collectors
export { CovalentCollector } from './covalent.js';
export { BitqueryCollector } from './bitquery.js';
export { SnowTraceCollector } from './snowtrace.js';
export { FileCollector } from './file.js';
export { normalizeWallets, deduplicateWallets, filterByMinUsd } from './normalize.js';