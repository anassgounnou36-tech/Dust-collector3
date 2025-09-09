import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { sJoeIntegration } from '../src/integrations/traderjoe/sjoe.js';
import { quoteToUsd, getTokenDecimals } from '../src/economics/pricing.js';
import { injectPricingService } from '../src/engine/executor.js';
import { env } from '../src/config/env.js';

describe('sJOE Production Integration', () => {
  beforeEach(() => {
    // Load environment variables
    config();
  });

  describe('Environment Configuration', () => {
    it('should have all required environment variables configured', () => {
      expect(env.traderJoeSJoeStakingAddress).toBeDefined();
      expect(env.sJoeToken).toBeDefined();
      expect(env.joeToken).toBeDefined();
      expect(env.defaultClaimRecipientAvax).toBeDefined();
      expect(env.sJoeMinUsd).toBe(1);
      expect(env.sJoeHarvestFunction).toBe('harvest');
    });

    it('should have correct token addresses', () => {
      expect(env.sJoeToken).toBe('0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
      expect(env.joeToken).toBe('0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd');
      expect(env.traderJoeSJoeStakingAddress).toBe('0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
    });
  });

  describe('Pricing Service Integration', () => {
    it('should have correct token decimals for sJOE and JOE', () => {
      expect(getTokenDecimals('sJOE')).toBe(18);
      expect(getTokenDecimals('JOE')).toBe(18);
    });

    it('should quote stable tokens correctly', async () => {
      // Test with USDC (stable token)
      const usdcAmount = await quoteToUsd('avalanche', '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', '1000000'); // 1 USDC
      expect(usdcAmount).toBe(1);
    });

    it('should return 0 for non-stable tokens (JOE/sJOE)', async () => {
      // Since JOE and sJOE are not stable tokens, they should return 0 for now
      const joeAmount = await quoteToUsd('avalanche', env.joeToken, '1000000000000000000'); // 1 JOE
      const sJoeAmount = await quoteToUsd('avalanche', env.sJoeToken, '1000000000000000000'); // 1 sJOE
      
      expect(joeAmount).toBe(0);
      expect(sJoeAmount).toBe(0);
    });

    it('should inject pricing service correctly', () => {
      // Test that pricing service injection works
      expect(() => {
        injectPricingService({
          quoteToUsd: async (chain, token, amountWei) => {
            if (chain === 'avalanche') {
              return await quoteToUsd(chain, token, amountWei);
            }
            return 0;
          },
          getTokenDecimals
        });
      }).not.toThrow();
    });
  });

  describe('sJOE Integration Flow', () => {
    it('should discover wallets in mock mode', async () => {
      const wallets = await sJoeIntegration.discoverWallets(true);
      expect(wallets).toHaveLength(1);
      expect(wallets[0].chain).toBe('avalanche');
      expect(wallets[0].value).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should discover configured wallet in production mode', async () => {
      const wallets = await sJoeIntegration.discoverWallets(false);
      expect(wallets).toHaveLength(1);
      expect(wallets[0].chain).toBe('avalanche');
      expect(wallets[0].value).toBe(env.defaultClaimRecipientAvax);
    });

    it('should get pending rewards in mock mode', async () => {
      const mockWallet = {
        value: '0x1234567890123456789012345678901234567890',
        chain: 'avalanche' as const
      };
      
      const rewards = await sJoeIntegration.getPendingRewards([mockWallet], true);
      expect(rewards).toHaveLength(1);
      expect(rewards[0].amountUsd).toBeGreaterThan(env.sJoeMinUsd);
      expect(rewards[0].claimTo).toEqual(mockWallet);
    });

    it('should build claim bundles from rewards', async () => {
      const mockWallet = {
        value: '0x1234567890123456789012345678901234567890',
        chain: 'avalanche' as const
      };
      
      const rewards = await sJoeIntegration.getPendingRewards([mockWallet], true);
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      
      expect(bundles).toHaveLength(1);
      expect(bundles[0].chain).toBe('avalanche');
      expect(bundles[0].protocol).toBe('traderjoe');
      expect(bundles[0].contractAddress).toBe(env.traderJoeSJoeStakingAddress);
      expect(bundles[0].callData).toBeDefined();
      expect(bundles[0].value).toBe(0); // No ETH/AVAX value needed
    });

    it('should use correct harvest function in bundles', async () => {
      const mockWallet = {
        value: '0x1234567890123456789012345678901234567890',
        chain: 'avalanche' as const
      };
      
      const rewards = await sJoeIntegration.getPendingRewards([mockWallet], true);
      const bundles = await sJoeIntegration.buildBundle(rewards, true);
      
      // Check that the call data matches harvest() function selector
      expect(bundles[0].callData).toBe('0x4641257d'); // harvest() selector
    });

    it('should support getReward function when configured', async () => {
      // Temporarily change the environment variable
      const originalFunction = process.env.SJOE_HARVEST_FUNCTION;
      process.env.SJOE_HARVEST_FUNCTION = 'getReward';
      
      try {
        const mockWallet = {
          value: '0x1234567890123456789012345678901234567890',
          chain: 'avalanche' as const
        };
        
        const rewards = await sJoeIntegration.getPendingRewards([mockWallet], true);
        const bundles = await sJoeIntegration.buildBundle(rewards, true);
        
        // Check that the call data matches getReward() function selector
        expect(bundles[0].callData).toBe('0x3d18b912'); // getReward() selector
      } finally {
        // Restore original value
        process.env.SJOE_HARVEST_FUNCTION = originalFunction;
      }
    });
  });

  describe('Integration Validation', () => {
    it('should validate that integration is included in active integrations', () => {
      expect(sJoeIntegration.key).toBe('traderjoe-sjoe');
      expect(sJoeIntegration.chain).toBe('avalanche');
      expect(typeof sJoeIntegration.discoverWallets).toBe('function');
      expect(typeof sJoeIntegration.getPendingRewards).toBe('function');
      expect(typeof sJoeIntegration.buildBundle).toBe('function');
    });

    it('should have proper error handling for missing configuration', async () => {
      // This test ensures the integration handles missing env vars gracefully
      const originalAddress = process.env.TRADERJOE_SJOE_STAKING_ADDRESS;
      delete process.env.TRADERJOE_SJOE_STAKING_ADDRESS;
      
      try {
        const mockWallet = {
          value: '0x1234567890123456789012345678901234567890',
          chain: 'avalanche' as const
        };
        
        const rewards = await sJoeIntegration.getPendingRewards([mockWallet], true);
        const bundles = await sJoeIntegration.buildBundle(rewards, true);
        
        // Should still work in mock mode with fallback address
        expect(bundles).toHaveLength(1);
        expect(bundles[0].contractAddress).toBe('0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
      } finally {
        // Restore original value
        if (originalAddress) {
          process.env.TRADERJOE_SJOE_STAKING_ADDRESS = originalAddress;
        }
      }
    });
  });
});