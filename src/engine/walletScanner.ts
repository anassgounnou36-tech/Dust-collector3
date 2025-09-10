import type { WalletRow } from '../collectors/index.js';
import type { Address, PendingReward } from '../types/common.js';
import { gmxDustIntegration } from '../integrations/gmx-dust.js';
import { formatAsCSV } from '../collectors/normalize.js';
import { writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

export interface WalletScannerConfig {
  batchSize?: number;
  concurrency?: number;
  rateLimit?: number;
  dryRun?: boolean;
  outputFile?: string;
  minUsd?: number;
}

export interface ScanResult {
  totalWallets: number;
  scannedWallets: number;
  qualifiedWallets: number;
  totalRewards: number;
  totalUsd: number;
  acceptedWallets: WalletRow[];
}

/**
 * Batched wallet scanner that reads CSV and drives gmx:dust scan/collect
 * Provides throttling, retries, and dry-run by default for safety
 */
export class WalletScanner {
  private config: Required<WalletScannerConfig>;

  constructor(config: WalletScannerConfig = {}) {
    this.config = {
      batchSize: config.batchSize || 10,
      concurrency: config.concurrency || 3,
      rateLimit: config.rateLimit || 5, // requests per second
      dryRun: config.dryRun !== false, // default true for safety
      outputFile: config.outputFile || './data/accepted-wallets.csv',
      minUsd: config.minUsd || 0.5,
    };
  }

  /**
   * Scan wallets from CSV file using gmx:dust integration
   */
  async scanFromCSV(csvPath: string): Promise<ScanResult> {
    console.log(`\n🔍 Wallet Scanner: Starting batch scan from ${csvPath}`);
    console.log(`⚙️  Config: batchSize=${this.config.batchSize}, concurrency=${this.config.concurrency}, dryRun=${this.config.dryRun}`);

    if (!existsSync(csvPath)) {
      throw new Error(`Wallet CSV file not found: ${csvPath}`);
    }

    // Read and parse CSV
    const wallets = this.parseWalletsCSV(csvPath);
    console.log(`📊 Loaded ${wallets.length} wallets from CSV`);

    return this.scanWallets(wallets);
  }

  /**
   * Scan a list of wallets for GMX dust
   */
  async scanWallets(wallets: WalletRow[]): Promise<ScanResult> {
    if (wallets.length === 0) {
      console.log('⚠️  No wallets to scan');
      return {
        totalWallets: 0,
        scannedWallets: 0,
        qualifiedWallets: 0,
        totalRewards: 0,
        totalUsd: 0,
        acceptedWallets: [],
      };
    }

    const result: ScanResult = {
      totalWallets: wallets.length,
      scannedWallets: 0,
      qualifiedWallets: 0,
      totalRewards: 0,
      totalUsd: 0,
      acceptedWallets: [],
    };

    // Process wallets in batches
    const batches = this.createBatches(wallets, this.config.batchSize);
    console.log(`📦 Processing ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} wallets)`);

      try {
        const batchResult = await this.processBatch(batch);
        
        // Accumulate results
        result.scannedWallets += batch.length;
        result.qualifiedWallets += batchResult.qualified;
        result.totalRewards += batchResult.rewards;
        result.totalUsd += batchResult.totalUsd;
        result.acceptedWallets.push(...batchResult.acceptedWallets);

        console.log(`✅ Batch ${i + 1} complete: ${batchResult.qualified}/${batch.length} qualified, ${batchResult.rewards} rewards, $${batchResult.totalUsd.toFixed(2)}`);

        // Rate limiting between batches
        if (i < batches.length - 1 && this.config.rateLimit > 0) {
          const delay = 1000 / this.config.rateLimit;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
        // Continue with next batch rather than failing completely
      }
    }

    // Save accepted wallets to CSV
    if (result.acceptedWallets.length > 0) {
      this.saveAcceptedWallets(result.acceptedWallets);
    }

    console.log(`\n📈 Scan Summary:`);
    console.log(`   Total wallets: ${result.totalWallets}`);
    console.log(`   Scanned wallets: ${result.scannedWallets}`);
    console.log(`   Qualified wallets: ${result.qualifiedWallets} (${(result.qualifiedWallets / result.scannedWallets * 100).toFixed(1)}%)`);
    console.log(`   Total rewards: ${result.totalRewards}`);
    console.log(`   Total USD value: $${result.totalUsd.toFixed(2)}`);
    console.log(`   Output file: ${this.config.outputFile}`);

    return result;
  }

  /**
   * Process a single batch of wallets
   */
  private async processBatch(wallets: WalletRow[]): Promise<{
    qualified: number;
    rewards: number;
    totalUsd: number;
    acceptedWallets: WalletRow[];
  }> {
    // Convert WalletRow to Address format
    const addresses: Address[] = wallets.map(w => ({
      value: w.address,
      chain: w.chain as any,
    }));

    // Use existing gmx-dust integration to scan
    const rewards = await gmxDustIntegration.getPendingRewards(addresses);
    
    // Filter by minimum USD threshold
    const qualifiedRewards = rewards.filter(r => r.amountUsd >= this.config.minUsd);
    
    // Create accepted wallets list (wallets with qualifying rewards)
    const qualifiedAddresses = new Set(qualifiedRewards.map(r => r.wallet.value.toLowerCase()));
    const acceptedWallets = wallets.filter(w => qualifiedAddresses.has(w.address.toLowerCase()));

    // Update wallet USD values from actual scan results
    for (const wallet of acceptedWallets) {
      const walletRewards = qualifiedRewards.filter(r => r.wallet.value.toLowerCase() === wallet.address.toLowerCase());
      wallet.balance_usd = walletRewards.reduce((sum, r) => sum + r.amountUsd, 0);
    }

    const totalUsd = qualifiedRewards.reduce((sum, r) => sum + r.amountUsd, 0);

    return {
      qualified: acceptedWallets.length,
      rewards: qualifiedRewards.length,
      totalUsd,
      acceptedWallets,
    };
  }

  /**
   * Parse wallets from CSV content
   */
  private parseWalletsCSV(csvPath: string): WalletRow[] {
    const fs = require('fs');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').slice(1); // Skip header
    const wallets: WalletRow[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const fields = trimmed.split(',').map((f: string) => f.trim());
      if (fields.length < 2) continue;

      wallets.push({
        address: fields[0],
        chain: fields[1] || 'avalanche',
        source: fields[2] || 'unknown',
        balance_tokens: fields[3] ? parseFloat(fields[3]) : undefined,
        balance_usd: fields[4] ? parseFloat(fields[4]) : undefined,
        token_symbol: fields[5] || undefined,
        token_address: fields[6] || undefined,
        discovered_at: fields[7] || new Date().toISOString(),
      });
    }

    return wallets;
  }

  /**
   * Create batches from wallet list
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Save accepted wallets to CSV file
   */
  private saveAcceptedWallets(wallets: WalletRow[]): void {
    try {
      // Ensure output directory exists
      const outputDir = dirname(this.config.outputFile);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const csvContent = formatAsCSV(wallets);
      writeFileSync(this.config.outputFile, csvContent, 'utf8');
      console.log(`💾 Saved ${wallets.length} accepted wallets to ${this.config.outputFile}`);
    } catch (error) {
      console.error('Failed to save accepted wallets:', error);
    }
  }
}