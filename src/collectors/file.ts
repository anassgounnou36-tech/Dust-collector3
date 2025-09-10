import type { WalletCollector, WalletRow, CollectorConfig } from './index.js';
import { readFileSync } from 'fs';
import { parse } from 'path';

/**
 * File-based collector for importing wallets from CSV/TXT files
 */
export class FileCollector implements WalletCollector {
  name = 'file';

  async collect(filePath: string, config?: CollectorConfig): Promise<WalletRow[]> {
    const { limit = 5000 } = config || {};
    const wallets: WalletRow[] = [];

    console.log(`File: Reading wallet addresses from ${filePath}`);

    try {
      const content = readFileSync(filePath, 'utf8');
      const { ext } = parse(filePath);
      
      let lines: string[] = [];

      if (ext === '.csv') {
        // Parse CSV format
        lines = content.split('\n').slice(1); // Skip header
      } else {
        // Treat as plain text with one address per line
        lines = content.split('\n');
      }

      for (const line of lines) {
        if (wallets.length >= limit) break;
        
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // Skip empty lines and comments

        let address: string;
        let chain = 'avalanche';
        let source = 'file';
        let balanceUsd: number | undefined;
        let balanceTokens: number | undefined;
        let tokenSymbol: string | undefined;
        let tokenAddress: string | undefined;
        let discoveredAt: string;

        if (ext === '.csv') {
          // Parse CSV fields: address,chain,source,balance_tokens,balance_usd,token_symbol,token_address,discovered_at
          const fields = trimmed.split(',').map(f => f.trim());
          address = fields[0];
          chain = fields[1] || 'avalanche';
          source = fields[2] || 'file';
          balanceTokens = fields[3] ? parseFloat(fields[3]) : undefined;
          balanceUsd = fields[4] ? parseFloat(fields[4]) : undefined;
          tokenSymbol = fields[5] || undefined;
          tokenAddress = fields[6] || undefined;
          discoveredAt = fields[7] || new Date().toISOString();
        } else {
          // Plain text - just the address
          address = trimmed;
          discoveredAt = new Date().toISOString();
        }

        // Basic address validation
        if (!address.startsWith('0x') || address.length !== 42) {
          console.warn(`File: Skipping invalid address: ${address}`);
          continue;
        }

        wallets.push({
          address,
          chain,
          source,
          balance_tokens: balanceTokens,
          balance_usd: balanceUsd,
          token_symbol: tokenSymbol,
          token_address: tokenAddress,
          discovered_at: discoveredAt,
        });
      }

      console.log(`File: Loaded ${wallets.length} wallet addresses from ${filePath}`);
      return wallets;

    } catch (error) {
      console.error(`File import error for ${filePath}:`, error);
      throw error;
    }
  }
}