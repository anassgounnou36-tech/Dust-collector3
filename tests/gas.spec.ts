import { describe, it, expect, beforeEach, vi } from 'vitest';
import { estimateBundleUsd } from '../src/economics/gas.js';
import type { ClaimBundle } from '../src/types/common.js';

// Set mock mode
process.env.MOCK_MODE = 'true';
process.env.AVALANCHE_RPC_URL = 'https://api.avax.network/ext/bc/C/rpc';

// Mock the avalanche chain client functions
vi.mock('../src/chains/avalanche.js', () => ({
  gasPrice: vi.fn().mockResolvedValue(25000000000n), // 25 gwei
  nativeUsd: vi.fn().mockResolvedValue(35.0) // $35 AVAX
}));

// Helper function to create test bundle
function createTestBundle(overrides: Partial<ClaimBundle> = {}): ClaimBundle {
  return {
    id: 'test-bundle-' + Math.random().toString(36).substring(7),
    chain: 'avalanche',
    protocol: 'test-protocol',
    claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
    items: [
      {
        id: 'reward-1',
        wallet: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' },
        protocol: 'test-protocol',
        token: { value: '0xToken123', chain: 'avalanche' },
        amountWei: '1000000',
        amountUsd: 1.0,
        claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
        discoveredAt: new Date()
      },
      {
        id: 'reward-2',
        wallet: { value: '0x2222222222222222222222222222222222222222', chain: 'avalanche' },
        protocol: 'test-protocol',
        token: { value: '0xToken456', chain: 'avalanche' },
        amountWei: '2000000',
        amountUsd: 2.0,
        claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
        discoveredAt: new Date()
      }
    ],
    totalUsd: 3.0,
    estGasUsd: 0,
    netUsd: 0,
    ...overrides
  };
}

describe('Gas Estimator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('estimateBundleUsd', () => {
    it('should estimate gas cost for bundle with 2 claims without estGasLimit', async () => {
      const bundle = createTestBundle();
      
      const gasEstimate = await estimateBundleUsd(bundle);
      
      expect(gasEstimate).toBeGreaterThan(0);
      
      // Should use default gas limit for both claims: 2 * 120000 = 240000 gas
      // At 25 gwei and $35 AVAX: 240000 * 25e9 * 35 / 1e18 = 0.21 USD
      expect(gasEstimate).toBeCloseTo(0.21, 2);
      
      // Should set estGasUsd on bundle
      expect(bundle.estGasUsd).toBe(gasEstimate);
    });

    it('should use provided estGasLimit when available', async () => {
      const bundle = createTestBundle({
        items: [
          {
            id: 'reward-1',
            wallet: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' },
            protocol: 'test-protocol',
            token: { value: '0xToken123', chain: 'avalanche' },
            amountWei: '1000000',
            amountUsd: 1.0,
            claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
            discoveredAt: new Date(),
            estGasLimit: 80000 // Custom gas limit
          },
          {
            id: 'reward-2',
            wallet: { value: '0x2222222222222222222222222222222222222222', chain: 'avalanche' },
            protocol: 'test-protocol',
            token: { value: '0xToken456', chain: 'avalanche' },
            amountWei: '2000000',
            amountUsd: 2.0,
            claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
            discoveredAt: new Date(),
            estGasLimit: 100000 // Custom gas limit
          }
        ]
      });
      
      const gasEstimate = await estimateBundleUsd(bundle);
      
      expect(gasEstimate).toBeGreaterThan(0);
      
      // Should use custom gas limits: 80000 + 100000 = 180000 gas
      // At 25 gwei and $35 AVAX: 180000 * 25e9 * 35 / 1e18 = 0.1575 USD
      expect(gasEstimate).toBeCloseTo(0.1575, 4);
    });

    it('should handle single claim bundle', async () => {
      const bundle = createTestBundle({
        items: [
          {
            id: 'reward-1',
            wallet: { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' },
            protocol: 'test-protocol',
            token: { value: '0xToken123', chain: 'avalanche' },
            amountWei: '1000000',
            amountUsd: 1.0,
            claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
            discoveredAt: new Date()
          }
        ],
        totalUsd: 1.0
      });
      
      const gasEstimate = await estimateBundleUsd(bundle);
      
      expect(gasEstimate).toBeGreaterThan(0);
      
      // Should use default gas limit for single claim: 120000 gas
      // At 25 gwei and $35 AVAX: 120000 * 25e9 * 35 / 1e18 = 0.105 USD
      expect(gasEstimate).toBeCloseTo(0.105, 3);
    });

    it('should handle errors gracefully', async () => {
      // Mock error in gas price fetch
      const { gasPrice } = await import('../src/chains/avalanche.js');
      vi.mocked(gasPrice).mockRejectedValueOnce(new Error('Network error'));
      
      const bundle = createTestBundle();
      const gasEstimate = await estimateBundleUsd(bundle);
      
      expect(gasEstimate).toBe(0);
    });

    it('should return 0 for empty bundle', async () => {
      const bundle = createTestBundle({
        items: [],
        totalUsd: 0
      });
      
      const gasEstimate = await estimateBundleUsd(bundle);
      
      expect(gasEstimate).toBe(0);
    });
  });
});