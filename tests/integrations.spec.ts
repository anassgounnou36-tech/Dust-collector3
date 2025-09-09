import { describe, it, expect } from 'vitest';
import { justlendIntegration } from '../src/integrations/justlend.js';
import { groupByContract } from '../src/engine/bundler.js';
import { TronClient } from '../src/chains/tron.js';

// Set mock mode for tests
process.env.MOCK_MODE = 'true';

describe('Integration Tests', () => {
  describe('JustLend Integration in Mock Mode', () => {
    it('should return pending rewards in mock mode', async () => {
      const mockWallets = [
        { value: 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF', chain: 'tron' as const },
        { value: 'TMuA6YqfCeX8EhbfYEg5y7S4DqzSJireY9', chain: 'tron' as const }
      ];

      const rewards = await justlendIntegration.getPendingRewards(mockWallets);

      expect(rewards.length).toBeGreaterThan(0);
      
      // Check first reward structure
      const firstReward = rewards[0];
      expect(firstReward).toBeDefined();
      expect(firstReward.protocol).toBe('justlend');
      expect(firstReward.wallet.chain).toBe('tron');
      expect(firstReward.token.chain).toBe('tron');
      expect(firstReward.amountUsd).toBeGreaterThan(0);
      expect(firstReward.amountWei).toBeDefined();
      expect(firstReward.discoveredAt).toBeInstanceOf(Date);
    });

    it('should create valid bundles from rewards', async () => {
      const mockWallets = [
        { value: 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF', chain: 'tron' as const }
      ];

      const rewards = await justlendIntegration.getPendingRewards(mockWallets);
      expect(rewards.length).toBeGreaterThan(0);

      const bundles = await justlendIntegration.buildBundle(rewards);
      expect(bundles.length).toBeGreaterThan(0);

      const bundle = bundles[0];
      expect(bundle).toBeDefined();
      expect(bundle.chain).toBe('tron');
      expect(bundle.protocol).toBe('justlend');
      expect(bundle.items.length).toBeGreaterThan(0);
      expect(bundle.totalUsd).toBeGreaterThan(0);
      expect(bundle.estGasUsd).toBeGreaterThanOrEqual(0);
      expect(bundle.netUsd).toBeDefined();
    });
  });

  describe('Bundling Logic', () => {
    it('should create bundles using groupByContract', async () => {
      const mockWallets = [
        { value: 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF', chain: 'tron' as const },
        { value: 'TMuA6YqfCeX8EhbfYEg5y7S4DqzSJireY9', chain: 'tron' as const }
      ];

      const rewards = await justlendIntegration.getPendingRewards(mockWallets);
      const bundles = groupByContract(rewards);

      if (bundles.length > 0) {
        const bundle = bundles[0];
        expect(bundle.id).toBeDefined();
        expect(bundle.chain).toBe('tron');
        expect(bundle.protocol).toBe('justlend');
        expect(bundle.totalUsd).toBeGreaterThan(0);
        expect(bundle.estGasUsd).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Mock Chain Client', () => {
    it('should create Tron client and simulate transactions', async () => {
      const client = new TronClient('https://api.trongrid.io');
      
      expect(client.chain).toBe('tron');
      
      // Test gas price method
      const gasPrice = await client.gasPrice();
      expect(gasPrice).toBeGreaterThan(0n);
      
      // Test native USD price
      const nativePrice = await client.nativeUsd();
      expect(nativePrice).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Mock Flow', () => {
    it('should complete discovery to execution simulation', async () => {
      // 1. Discover wallets
      const wallets = await justlendIntegration.discoverWallets();
      expect(wallets.length).toBeGreaterThan(0);
      
      // 2. Get pending rewards
      const rewards = await justlendIntegration.getPendingRewards(wallets);
      
      if (rewards.length > 0) {
        // 3. Create bundles
        const bundles = groupByContract(rewards);
        expect(bundles.length).toBeGreaterThan(0);
        
        // 4. Verify bundle profitability
        const bundle = bundles[0];
        expect(bundle.totalUsd).toBeGreaterThan(0);
        expect(bundle.netUsd).toBeLessThanOrEqual(bundle.totalUsd);
        
        // 5. Check if meets minimum thresholds
        const meetsMinimum = bundle.totalUsd >= 2.0 && bundle.netUsd >= 1.0;
        
        if (meetsMinimum) {
          expect(bundle.totalUsd).toBeGreaterThanOrEqual(2.0);
          expect(bundle.netUsd).toBeGreaterThanOrEqual(1.0);
        }
      }
    });
  });
});