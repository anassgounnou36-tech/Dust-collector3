import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gmxIntegration, GMX_CONTRACTS } from '../src/integrations/gmx.js';
import { env } from '../src/config/env.js';

describe('GMX Real Mode Integration Tests', () => {
  let originalEnv: typeof env.enableSyntheticGmx;

  beforeEach(() => {
    originalEnv = env.enableSyntheticGmx;
    
    // Disable synthetic mode for real tests
    Object.defineProperty(env, 'enableSyntheticGmx', {
      value: false,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Reset environment
    Object.defineProperty(env, 'enableSyntheticGmx', {
      value: originalEnv,
      writable: true,
      configurable: true
    });
  });

  describe('Contract Addresses', () => {
    it('should have correct GMX contract addresses for Avalanche', () => {
      expect(GMX_CONTRACTS.GMX_TOKEN).toBe('0x62edc0692BD897D2295872a9FFCac5425011c661');
      expect(GMX_CONTRACTS.REWARD_ROUTER_V2).toBe('0x82147C5A7E850eA4E28155DF107F2590fD4ba327');
      expect(GMX_CONTRACTS.ES_GMX_TOKEN).toBe('0xFf1489227BbAAC61a9209A08929E4c2a526DdD17');
      expect(GMX_CONTRACTS.WETH).toBe('0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB');
      expect(GMX_CONTRACTS.WAVAX).toBe('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7');
    });

    it('should have tracking contract addresses', () => {
      expect(GMX_CONTRACTS.STAKED_GMX_TRACKER).toBe('0x908C4D94D34924765f1eDc22A1DD098397c59dD4');
      expect(GMX_CONTRACTS.STAKED_GLP_TRACKER).toBe('0x1aDDD80E6039594eE970E5872D247bf0414C8903');
      expect(GMX_CONTRACTS.FEE_GMX_TRACKER).toBe('0xd2D1162512F927a7e282Ef43a362659E4F2a728F');
      expect(GMX_CONTRACTS.FEE_GLP_TRACKER).toBe('0x4e971a87900b931fF39d1Aad67697F49835400b6');
    });
  });

  describe('Real Wallet Discovery', () => {
    beforeEach(() => {
      // Set a valid checksum address for testing
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8B7F5';
    });

    afterEach(() => {
      // Clean up env variable
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
    });

    it('should discover configured wallet in real mode', async () => {
      const wallets = await gmxIntegration.discoverWallets();
      
      expect(wallets).toHaveLength(1);
      expect(wallets[0]).toEqual({
        value: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8B7F5',
        chain: 'avalanche'
      });
    });

    it('should return empty array when no default recipient configured', async () => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;

      const wallets = await gmxIntegration.discoverWallets();
      expect(wallets).toHaveLength(0);
    });
  });

  describe('Real Reward Discovery', () => {
    const testWallet = { value: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8B7F5', chain: 'avalanche' as const };

    it('should return empty array when RPC URL not configured', async () => {
      // Temporarily clear the RPC URL
      const originalRpcUrl = process.env.PRICER_RPC_AVAX;
      delete process.env.PRICER_RPC_AVAX;
      
      const rewards = await gmxIntegration.getPendingRewards([testWallet]);
      expect(rewards).toHaveLength(0);
      
      // Restore original value
      if (originalRpcUrl) {
        process.env.PRICER_RPC_AVAX = originalRpcUrl;
      }
    });

    it('should handle network errors gracefully', async () => {
      // This test will actually try to connect but should handle errors
      const originalRpcUrl = process.env.PRICER_RPC_AVAX;
      process.env.PRICER_RPC_AVAX = 'https://invalid-rpc-url.example.com';

      const rewards = await gmxIntegration.getPendingRewards([testWallet]);
      expect(rewards).toHaveLength(0);
      
      // Restore original value
      if (originalRpcUrl) {
        process.env.PRICER_RPC_AVAX = originalRpcUrl;
      } else {
        delete process.env.PRICER_RPC_AVAX;
      }
    });
  });

  describe('Real Bundle Creation', () => {
    const testWallet = { value: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8B7F5', chain: 'avalanche' as const };

    beforeEach(() => {
      // Set up the test address as the default recipient so it's allowed
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8B7F5';
    });

    afterEach(() => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
    });

    it('should return empty array for empty rewards', async () => {
      const bundles = await gmxIntegration.buildBundle([]);
      expect(bundles).toHaveLength(0);
    });

    it('should create bundle for mock rewards in real mode', async () => {
      const mockRewards = [
        {
          id: 'gmx-es-gmx-test',
          wallet: testWallet,
          protocol: 'gmx',
          token: { value: GMX_CONTRACTS.ES_GMX_TOKEN, chain: 'avalanche' as const },
          amountWei: '500000000000000000',
          amountUsd: 12.5,
          claimTo: testWallet,
          discoveredAt: new Date(),
          estGasLimit: 200000
        }
      ];

      const bundles = await gmxIntegration.buildBundle(mockRewards);
      
      expect(bundles).toHaveLength(1);
      
      const bundle = bundles[0];
      expect(bundle.protocol).toBe('gmx');
      expect(bundle.chain).toBe('avalanche');
      expect(bundle.items).toHaveLength(1);
      expect(bundle.totalUsd).toBe(12.5);
      expect(bundle.contractAddress).toBe(GMX_CONTRACTS.REWARD_ROUTER_V2);
      expect(bundle.callData).toBeDefined();
      expect(bundle.value).toBe(0);
      expect(bundle.estGasUsd).toBeGreaterThan(0);
      expect(bundle.netUsd).toBeLessThan(bundle.totalUsd);
    });

    it('should reject invalid recipients in non-mock mode', async () => {
      // Use a different address that's not configured
      const invalidWallet = { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' as const };
      
      const mockRewards = [
        {
          id: 'gmx-es-gmx-test',
          wallet: invalidWallet,
          protocol: 'gmx',
          token: { value: GMX_CONTRACTS.ES_GMX_TOKEN, chain: 'avalanche' as const },
          amountWei: '500000000000000000',
          amountUsd: 12.5,
          claimTo: invalidWallet,
          discoveredAt: new Date(),
          estGasLimit: 200000
        }
      ];

      await expect(gmxIntegration.buildBundle(mockRewards)).rejects.toThrow('Invalid recipient');
    });
  });

  describe('Integration Properties', () => {
    it('should have correct integration metadata', () => {
      expect(gmxIntegration.key).toBe('gmx');
      expect(gmxIntegration.chain).toBe('avalanche');
    });

    it('should expose required integration methods', () => {
      expect(typeof gmxIntegration.discoverWallets).toBe('function');
      expect(typeof gmxIntegration.getPendingRewards).toBe('function');
      expect(typeof gmxIntegration.buildBundle).toBe('function');
    });
  });

  describe('Environment Configuration', () => {
    it('should have GMX minimum USD threshold', () => {
      expect(env.gmxMinUsd).toBeDefined();
      expect(typeof env.gmxMinUsd).toBe('number');
      expect(env.gmxMinUsd).toBeGreaterThan(0);
    });

    it('should have ABI path configured', () => {
      expect(env.gmxRewardRouterV2AbiPath).toBeDefined();
      expect(env.gmxRewardRouterV2AbiPath).toContain('gmx_reward_router_v2.json');
    });
  });
});