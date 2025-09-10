import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * E2E smoke test for the wallet discovery pipeline
 * These tests only run if environment variables are set (e.g., in CI)
 * They validate the integration between components without making real API calls
 */
describe('Wallet Discovery Pipeline Smoke Test', () => {
  const hasApiKeys = process.env.COVALENT_API_KEY || process.env.BITQUERY_API_KEY || process.env.SNOWTRACE_API_KEY;
  const runE2E = process.env.RUN_E2E_TESTS === 'true' || process.env.CI === 'true';

  // Skip all tests if no API keys are configured and not in CI
  const testCondition = hasApiKeys && runE2E;

  beforeAll(() => {
    if (!testCondition) {
      console.log('⏭️  Skipping E2E tests - no API keys configured or RUN_E2E_TESTS not set');
    }
  });

  it.skipIf(!testCondition)('should have example wallet file for testing', () => {
    const exampleFile = './example/wallets-small.csv';
    expect(existsSync(exampleFile)).toBe(true);
  });

  it.skipIf(!testCondition)('should be able to import collector modules', async () => {
    // Test that all collector modules can be imported without errors
    const { CovalentCollector, BitqueryCollector, SnowTraceCollector, FileCollector } = await import('../../src/collectors/index.js');
    
    expect(CovalentCollector).toBeDefined();
    expect(BitqueryCollector).toBeDefined();
    expect(SnowTraceCollector).toBeDefined();
    expect(FileCollector).toBeDefined();
  });

  it.skipIf(!testCondition)('should be able to import wallet scanner', async () => {
    const { WalletScanner } = await import('../../src/engine/walletScanner.js');
    expect(WalletScanner).toBeDefined();
    
    // Test instantiation with default config
    const scanner = new WalletScanner({ dryRun: true });
    expect(scanner).toBeDefined();
  });

  it.skipIf(!testCondition)('should validate environment variables structure', () => {
    // Test that new environment variables are properly defined in config
    const { env } = require('../../src/config/env.js');
    
    expect(env).toHaveProperty('covalentApiKey');
    expect(env).toHaveProperty('bitqueryApiKey');
    expect(env).toHaveProperty('snowtraceApiKey');
    expect(env).toHaveProperty('defaultWalletsFile');
    expect(env).toHaveProperty('acceptedWalletsFile');
    expect(env).toHaveProperty('walletFetchLimit');
    expect(env).toHaveProperty('dryRunOnly');
  });

  it.skipIf(!testCondition)('should have updated package.json scripts', async () => {
    const packageJson = await import('../../package.json');
    
    expect(packageJson.scripts).toHaveProperty('wallets:fetch');
    expect(packageJson.scripts['wallets:fetch']).toContain('tsx src/cli/wallets-fetch.ts');
  });

  it.skipIf(!testCondition)('file collector should work with example data', async () => {
    const { FileCollector } = await import('../../src/collectors/index.js');
    const collector = new FileCollector();
    
    const wallets = await collector.collect('./example/wallets-small.csv', { limit: 10 });
    
    expect(wallets.length).toBeGreaterThan(0);
    expect(wallets[0]).toHaveProperty('address');
    expect(wallets[0]).toHaveProperty('chain');
    expect(wallets[0]).toHaveProperty('source', 'file');
    
    // Verify address format
    expect(wallets[0].address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it.skipIf(!testCondition)('wallet scanner should process example data in dry run', async () => {
    const { WalletScanner } = await import('../../src/engine/walletScanner.js');
    
    const scanner = new WalletScanner({
      dryRun: true,
      batchSize: 2,
      minUsd: 0.1, // Low threshold for testing
    });
    
    const result = await scanner.scanFromCSV('./example/wallets-small.csv');
    
    expect(result).toHaveProperty('totalWallets');
    expect(result).toHaveProperty('scannedWallets');
    expect(result).toHaveProperty('qualifiedWallets');
    expect(result).toHaveProperty('totalRewards');
    expect(result).toHaveProperty('totalUsd');
    expect(result).toHaveProperty('acceptedWallets');
    
    expect(result.totalWallets).toBeGreaterThan(0);
    expect(result.scannedWallets).toEqual(result.totalWallets);
  });

  it.skipIf(!testCondition)('normalization utilities should work correctly', async () => {
    const { normalizeWallets, deduplicateWallets, filterByMinUsd } = await import('../../src/collectors/normalize.js');
    
    const testWallets = [
      {
        address: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche',
        source: 'test',
        balance_usd: 5.0,
        discovered_at: new Date().toISOString(),
      },
      {
        address: '0xE816F3DB12DB343FAF01B0781F9FE80122FA7E7D', // Same address, different case
        chain: 'avalanche',
        source: 'test',
        balance_usd: 3.0,
        discovered_at: new Date().toISOString(),
      },
      {
        address: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5',
        chain: 'avalanche',
        source: 'test',
        balance_usd: 1.0,
        discovered_at: new Date().toISOString(),
      },
    ];
    
    const normalized = normalizeWallets(testWallets);
    expect(normalized).toHaveLength(3);
    expect(normalized[0].address).toBe(normalized[1].address); // Should be normalized to same case
    
    const deduplicated = deduplicateWallets(normalized);
    expect(deduplicated).toHaveLength(2); // Should remove one duplicate
    
    const filtered = filterByMinUsd(deduplicated, 2.0);
    expect(filtered).toHaveLength(1); // Only one wallet above $2.0
    expect(filtered[0].balance_usd).toBeGreaterThanOrEqual(2.0);
  });
});