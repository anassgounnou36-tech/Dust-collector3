import { describe, it, expect } from 'vitest';
import { FileCollector } from '../../src/collectors/file.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('FileCollector', () => {
  const testDir = './tmp/test-file-collector';
  
  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should load wallets from CSV file', async () => {
    const csvContent = `address,chain,source,balance_tokens,balance_usd,token_symbol,token_address,discovered_at
0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D,avalanche,file,0.1,2.5,GMX,0x62edc0692BD897D2295872a9FFCac5425011c661,2024-01-01T00:00:00.000Z
0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5,avalanche,file,0.05,1.25,GMX,0x62edc0692BD897D2295872a9FFCac5425011c661,2024-01-01T00:00:00.000Z`;

    const testFile = join(testDir, 'test-wallets.csv');
    writeFileSync(testFile, csvContent);

    const collector = new FileCollector();
    const wallets = await collector.collect(testFile);

    expect(wallets).toHaveLength(2);
    expect(wallets[0].address).toBe('0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D');
    expect(wallets[0].chain).toBe('avalanche');
    expect(wallets[0].source).toBe('file');
    expect(wallets[0].balance_usd).toBe(2.5);
    expect(wallets[0].token_symbol).toBe('GMX');
  });

  it('should load wallets from plain text file', async () => {
    const txtContent = `0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D
0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5
# This is a comment
0x1234567890123456789012345678901234567890`;

    const testFile = join(testDir, 'test-wallets.txt');
    writeFileSync(testFile, txtContent);

    const collector = new FileCollector();
    const wallets = await collector.collect(testFile);

    expect(wallets).toHaveLength(3);
    expect(wallets[0].address).toBe('0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D');
    expect(wallets[0].chain).toBe('avalanche');
    expect(wallets[0].source).toBe('file');
    expect(wallets[0].balance_usd).toBeUndefined();
  });

  it('should handle limit parameter', async () => {
    const csvContent = `address,chain,source
0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D,avalanche,file
0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5,avalanche,file
0x1234567890123456789012345678901234567890,avalanche,file`;

    const testFile = join(testDir, 'test-wallets.csv');
    writeFileSync(testFile, csvContent);

    const collector = new FileCollector();
    const wallets = await collector.collect(testFile, { limit: 2 });

    expect(wallets).toHaveLength(2);
  });

  it('should skip invalid addresses', async () => {
    const csvContent = `address,chain,source
0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D,avalanche,file
invalid-address,avalanche,file
0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5,avalanche,file
short-addr,avalanche,file`;

    const testFile = join(testDir, 'test-wallets.csv');
    writeFileSync(testFile, csvContent);

    const collector = new FileCollector();
    const wallets = await collector.collect(testFile);

    expect(wallets).toHaveLength(2);
    expect(wallets[0].address).toBe('0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D');
    expect(wallets[1].address).toBe('0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5');
  });

  it('should throw error for non-existent file', async () => {
    const collector = new FileCollector();
    
    await expect(collector.collect('./non-existent-file.csv')).rejects.toThrow();
  });
});