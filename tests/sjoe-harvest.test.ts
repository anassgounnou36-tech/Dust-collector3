import { describe, it, expect, beforeEach } from 'vitest';
import { sJoeIntegration } from '../src/integrations/traderjoe/sjoe.js';
import type { Address, PendingReward } from '../src/types/common.js';

describe('sJOE Harvest Logic', () => {
  beforeEach(() => {
    // Set mock mode for testing
    process.env.MOCK_MODE = 'true';
  });

  describe('Harvest Function Encoding', () => {
    it('should create bundles with harvest() function by default', async () => {
      const wallets: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];
      
      const rewards = await sJoeIntegration.getPendingRewards(wallets, true);
      expect(rewards).toHaveLength(1);
      
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      expect(bundles).toHaveLength(1);
      
      const bundle = bundles[0];
      expect(bundle.callData).toBe('0x4641257d'); // harvest() function selector
      expect(bundle.contractAddress).toBe('0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
      expect(bundle.value).toBe(0);
    });

    it('should create bundles with getReward() function when configured', async () => {
      // Set environment variable for getReward function
      process.env.SJOE_HARVEST_FUNCTION = 'getReward';
      
      const wallets: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];
      
      const rewards = await sJoeIntegration.getPendingRewards(wallets, true);
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      
      const bundle = bundles[0];
      expect(bundle.callData).toBe('0x3d18b912'); // getReward() function selector
      expect(bundle.contractAddress).toBe('0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
      
      // Clean up
      delete process.env.SJOE_HARVEST_FUNCTION;
    });

    it('should fallback to harvest() for invalid function names', async () => {
      process.env.SJOE_HARVEST_FUNCTION = 'invalidFunction';
      
      const wallets: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];
      
      const rewards = await sJoeIntegration.getPendingRewards(wallets, true);
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      
      const bundle = bundles[0];
      expect(bundle.callData).toBe('0x4641257d'); // Should fallback to harvest()
      
      // Clean up
      delete process.env.SJOE_HARVEST_FUNCTION;
    });
  });

  describe('Bundle Structure', () => {
    it('should include all required transaction fields in bundles', async () => {
      const wallets: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];
      
      const rewards = await sJoeIntegration.getPendingRewards(wallets, true);
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      
      const bundle = bundles[0];
      
      // Check all transaction fields are present
      expect(bundle.contractAddress).toBeDefined();
      expect(bundle.callData).toBeDefined();
      expect(bundle.value).toBeDefined();
      expect(bundle.value).toBe(0); // Should be 0 for harvest calls
      
      // Check original bundle fields are still present
      expect(bundle.id).toBeDefined();
      expect(bundle.chain).toBe('avalanche');
      expect(bundle.protocol).toBe('traderjoe');
      expect(bundle.claimTo).toBeDefined();
      expect(bundle.items).toHaveLength(1);
      expect(bundle.totalUsd).toBeGreaterThan(0);
      expect(bundle.estGasUsd).toBeGreaterThan(0);
      expect(bundle.netUsd).toBeGreaterThanOrEqual(0);
    });

    it('should use fallback contract address in mock mode when env var not set', async () => {
      // Temporarily clear the environment variable
      const originalAddress = process.env.TRADERJOE_SJOE_STAKING_ADDRESS;
      delete process.env.TRADERJOE_SJOE_STAKING_ADDRESS;
      
      const wallets: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];
      
      const rewards = await sJoeIntegration.getPendingRewards(wallets, true);
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      
      const bundle = bundles[0];
      expect(bundle.contractAddress).toBe('0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
      
      // Restore original environment variable
      if (originalAddress) {
        process.env.TRADERJOE_SJOE_STAKING_ADDRESS = originalAddress;
      }
    });
  });

  describe('Function Selector Fallbacks', () => {
    it('should use correct function selectors when ABI is not available', async () => {
      // This test validates the fallback function selectors are correct
      const wallets: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];
      
      const rewards = await sJoeIntegration.getPendingRewards(wallets, true);
      
      // Test harvest function
      const harvestBundles = await sJoeIntegration.buildBundle(rewards, true);
      expect(harvestBundles[0].callData).toBe('0x4641257d');
      
      // Test getReward function
      process.env.SJOE_HARVEST_FUNCTION = 'getReward';
      const getRewardBundles = await sJoeIntegration.buildBundle(rewards, true);
      expect(getRewardBundles[0].callData).toBe('0x3d18b912');
      
      delete process.env.SJOE_HARVEST_FUNCTION;
    });
  });
});