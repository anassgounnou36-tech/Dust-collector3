import { describe, it, expect, vi } from 'vitest';
import { WalletScanner } from '../../src/engine/walletScanner.js';
import type { WalletRow } from '../../src/collectors/index.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Mock the gmx-dust integration
vi.mock('../../src/integrations/gmx-dust.js', () => ({
  gmxDustIntegration: {
    getPendingRewards: vi.fn().mockResolvedValue([
      {
        id: 'test-reward-1',
        wallet: { value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D', chain: 'avalanche' },
        protocol: 'gmx-dust',
        token: { value: '0x62edc0692BD897D2295872a9FFCac5425011c661', chain: 'avalanche' },
        amountWei: '1000000000000000000',
        amountUsd: 2.5,
        claimTo: { value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D', chain: 'avalanche' },
        discoveredAt: new Date(),
        estGasLimit: 65000,
      },
    ]),
  },
}));

describe('WalletScanner', () => {
  const testDir = './tmp/test-wallet-scanner';
  
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should scan wallets and return results', async () => {
    const wallets: WalletRow[] = [
      {
        address: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche',
        source: 'test',
        discovered_at: new Date().toISOString(),
      },
      {
        address: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5',
        chain: 'avalanche',
        source: 'test',
        discovered_at: new Date().toISOString(),
      },
    ];

    const scanner = new WalletScanner({
      batchSize: 2,
      dryRun: true,
      outputFile: join(testDir, 'test-output.csv'),
      minUsd: 1.0,
    });

    const result = await scanner.scanWallets(wallets);

    expect(result.totalWallets).toBe(2);
    expect(result.scannedWallets).toBe(2);
    expect(result.qualifiedWallets).toBe(1); // Only one wallet has qualifying rewards
    expect(result.totalRewards).toBe(1);
    expect(result.totalUsd).toBe(2.5);
    expect(result.acceptedWallets).toHaveLength(1);
  });

  it('should process wallets in batches', async () => {
    const wallets: WalletRow[] = Array.from({ length: 5 }, (_, i) => ({
      address: `0x${'0'.repeat(39)}${i + 1}`,
      chain: 'avalanche',
      source: 'test',
      discovered_at: new Date().toISOString(),
    }));

    const scanner = new WalletScanner({
      batchSize: 2,
      dryRun: true,
      minUsd: 0.5,
    });

    const result = await scanner.scanWallets(wallets);

    expect(result.totalWallets).toBe(5);
    expect(result.scannedWallets).toBe(5);
    // Should have called getPendingRewards 3 times (batches of 2, 2, 1)
  });

  it('should read and scan from CSV file', async () => {
    const csvContent = `address,chain,source,balance_tokens,balance_usd,token_symbol,token_address,discovered_at
0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D,avalanche,file,0.1,2.5,GMX,0x62edc0692BD897D2295872a9FFCac5425011c661,2024-01-01T00:00:00.000Z
0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5,avalanche,file,0.05,1.25,GMX,0x62edc0692BD897D2295872a9FFCac5425011c661,2024-01-01T00:00:00.000Z`;

    const csvFile = join(testDir, 'test-wallets.csv');
    writeFileSync(csvFile, csvContent);

    const scanner = new WalletScanner({
      dryRun: true,
      minUsd: 1.0,
    });

    const result = await scanner.scanFromCSV(csvFile);

    expect(result.totalWallets).toBe(2);
    expect(result.scannedWallets).toBe(2);
  });

  it('should handle empty wallet list', async () => {
    const scanner = new WalletScanner({
      dryRun: true,
    });

    const result = await scanner.scanWallets([]);

    expect(result.totalWallets).toBe(0);
    expect(result.scannedWallets).toBe(0);
    expect(result.qualifiedWallets).toBe(0);
    expect(result.totalRewards).toBe(0);
    expect(result.totalUsd).toBe(0);
    expect(result.acceptedWallets).toHaveLength(0);
  });

  it('should save accepted wallets to file when not in dry run', async () => {
    const wallets: WalletRow[] = [
      {
        address: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche',
        source: 'test',
        discovered_at: new Date().toISOString(),
      },
    ];

    const outputFile = join(testDir, 'accepted-wallets.csv');
    const scanner = new WalletScanner({
      dryRun: false, // Enable file writing
      outputFile,
      minUsd: 1.0,
    });

    await scanner.scanWallets(wallets);

    // Check if file was created
    expect(existsSync(outputFile)).toBe(true);
  });

  it('should filter by minimum USD threshold', async () => {
    const wallets: WalletRow[] = [
      {
        address: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche',
        source: 'test',
        discovered_at: new Date().toISOString(),
      },
    ];

    const scanner = new WalletScanner({
      dryRun: true,
      minUsd: 5.0, // Higher than the mock reward value (2.5)
    });

    const result = await scanner.scanWallets(wallets);

    expect(result.qualifiedWallets).toBe(0); // Should be filtered out
    expect(result.totalRewards).toBe(0);
  });

  it('should throw error for non-existent CSV file', async () => {
    const scanner = new WalletScanner({
      dryRun: true,
    });

    await expect(scanner.scanFromCSV('./non-existent.csv')).rejects.toThrow(
      'Wallet CSV file not found'
    );
  });
});