import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gmxIntegration } from '../src/integrations/gmx.js';
import { env } from '../src/config/env.js';

describe('GMX Synthetic Mode Tests', () => {
  let originalEnv: typeof env.enableSyntheticGmx;

  beforeEach(() => {
    originalEnv = env.enableSyntheticGmx;
  });

  afterEach(() => {
    // Reset environment
    Object.defineProperty(env, 'enableSyntheticGmx', {
      value: originalEnv,
      writable: true,
      configurable: true
    });
  });

  describe('Synthetic GMX Mode', () => {
    beforeEach(() => {
      // Enable synthetic mode for tests
      Object.defineProperty(env, 'enableSyntheticGmx', {
        value: true,
        writable: true,
        configurable: true
      });
    });

    it('should discover synthetic wallets when synthetic mode is enabled', async () => {
      const wallets = await gmxIntegration.discoverWallets();
      
      expect(wallets).toHaveLength(3);
      expect(wallets[0]).toEqual({
        value: '0x1111111111111111111111111111111111111111',
        chain: 'avalanche'
      });
      expect(wallets[1]).toEqual({
        value: '0x2222222222222222222222222222222222222222',
        chain: 'avalanche'
      });
      expect(wallets[2]).toEqual({
        value: '0x3333333333333333333333333333333333333333',
        chain: 'avalanche'
      });
    });

    it('should generate synthetic pending rewards', async () => {
      const testWallets = [
        { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const }
      ];
      
      const rewards = await gmxIntegration.getPendingRewards(testWallets);
      
      expect(rewards).toHaveLength(2);
      
      // Check staked GMX reward (WETH)
      const gmxReward = rewards.find(r => r.id.includes('staking'));
      expect(gmxReward).toBeDefined();
      expect(gmxReward?.amountWei).toBe('1250000000000000000');
      expect(gmxReward?.amountUsd).toBe(3.75);
      expect(gmxReward?.protocol).toBe('gmx');
      expect(gmxReward?.estGasLimit).toBe(180000);
      
      // Check GLP fee reward (AVAX)
      const glpReward = rewards.find(r => r.id.includes('glp-fees'));
      expect(glpReward).toBeDefined();
      expect(glpReward?.amountWei).toBe('5500000000000000000');
      expect(glpReward?.amountUsd).toBe(2.20);
      expect(glpReward?.protocol).toBe('gmx');
      expect(glpReward?.estGasLimit).toBe(160000);
    });

    it('should create synthetic bundles from rewards', async () => {
      const mockRewards = [
        {
          id: 'test-reward-1',
          wallet: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const },
          protocol: 'gmx',
          token: { value: '0xWETH', chain: 'avalanche' as const },
          amountWei: '1000000000000000000',
          amountUsd: 3.0,
          claimTo: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const },
          discoveredAt: new Date(),
          estGasLimit: 180000
        },
        {
          id: 'test-reward-2',
          wallet: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const },
          protocol: 'gmx',
          token: { value: '0xWAVAX', chain: 'avalanche' as const },
          amountWei: '2000000000000000000',
          amountUsd: 2.0,
          claimTo: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const },
          discoveredAt: new Date(),
          estGasLimit: 160000
        }
      ];

      const bundles = await gmxIntegration.buildBundle(mockRewards);
      
      expect(bundles).toHaveLength(1);
      
      const bundle = bundles[0];
      expect(bundle.protocol).toBe('gmx');
      expect(bundle.chain).toBe('avalanche');
      expect(bundle.items).toHaveLength(2);
      expect(bundle.totalUsd).toBe(5.0);
      expect(bundle.estGasUsd).toBe(0.25);
      expect(bundle.netUsd).toBe(4.75);
      expect(bundle.id).toMatch(/^gmx-bundle-\d+$/);
    });

    it('should handle empty rewards list in synthetic mode', async () => {
      const bundles = await gmxIntegration.buildBundle([]);
      expect(bundles).toHaveLength(0);
    });
  });

  describe('Real Mode (Non-Synthetic)', () => {
    beforeEach(() => {
      // Disable synthetic mode
      Object.defineProperty(env, 'enableSyntheticGmx', {
        value: false,
        writable: true,
        configurable: true
      });
    });

    it('should return empty wallets when synthetic mode is disabled', async () => {
      const wallets = await gmxIntegration.discoverWallets();
      expect(wallets).toHaveLength(0);
    });

    it('should return empty rewards when synthetic mode is disabled', async () => {
      const testWallets = [
        { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const }
      ];
      
      const rewards = await gmxIntegration.getPendingRewards(testWallets);
      expect(rewards).toHaveLength(0);
    });

    it('should reject bundles with invalid recipients when synthetic mode is disabled', async () => {
      const mockRewards = [
        {
          id: 'test-reward-1',
          wallet: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const },
          protocol: 'gmx',
          token: { value: '0xWETH', chain: 'avalanche' as const },
          amountWei: '1000000000000000000',
          amountUsd: 3.0,
          claimTo: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const },
          discoveredAt: new Date(),
          estGasLimit: 180000
        }
      ];

      // Should throw error because the recipient is not allowed in non-mock mode
      await expect(gmxIntegration.buildBundle(mockRewards)).rejects.toThrow('Invalid recipient');
    });
  });

  describe('Integration Properties', () => {
    it('should have correct integration properties', () => {
      expect(gmxIntegration.key).toBe('gmx');
      expect(gmxIntegration.chain).toBe('avalanche');
    });

    it('should expose required integration methods', () => {
      expect(typeof gmxIntegration.discoverWallets).toBe('function');
      expect(typeof gmxIntegration.getPendingRewards).toBe('function');
      expect(typeof gmxIntegration.buildBundle).toBe('function');
    });
  });
});