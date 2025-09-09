import { describe, it, expect, beforeEach } from 'vitest';
import { groupByContract } from '../src/engine/bundler.js';
import { Policy } from '../src/economics/policy.js';
import { computeBundleHash, shouldSkipIdempotency, clearIdempotencyCache } from '../src/engine/idempotency.js';
import { estimateBundleGasUsd } from '../src/economics/gas.js';
import type { PendingReward, ClaimBundle } from '../src/types/common.js';

// Helper function to create test reward
function createTestReward(overrides: Partial<PendingReward> = {}): PendingReward {
  return {
    id: 'test-reward-' + Math.random().toString(36).substring(7),
    wallet: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
    protocol: 'test-protocol',
    token: { value: '0xToken123', chain: 'avalanche' },
    amountWei: '1000000',
    amountUsd: 1.0,
    claimTo: { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
    discoveredAt: new Date(),
    ...overrides
  };
}

describe('Engine Tests', () => {
  beforeEach(() => {
    clearIdempotencyCache();
  });

  describe('groupByContract', () => {
    it('should group rewards by chain, protocol, and claimTo', () => {
      const rewards: PendingReward[] = [
        createTestReward({
          protocol: 'justlend',
          claimTo: { value: 'addr1', chain: 'tron' },
          wallet: { value: 'wallet1', chain: 'tron' },
          token: { value: 'token1', chain: 'tron' },
          amountUsd: 2.0
        }),
        createTestReward({
          protocol: 'justlend',
          claimTo: { value: 'addr1', chain: 'tron' },
          wallet: { value: 'wallet2', chain: 'tron' },
          token: { value: 'token1', chain: 'tron' },
          amountUsd: 3.0
        }),
        createTestReward({
          protocol: 'gmx',
          claimTo: { value: 'addr2', chain: 'avalanche' },
          wallet: { value: 'wallet3', chain: 'avalanche' },
          token: { value: 'token2', chain: 'avalanche' },
          amountUsd: 5.0
        })
      ];

      const bundles = groupByContract(rewards);

      expect(bundles).toHaveLength(2);
      
      // Find the JustLend bundle
      const justlendBundle = bundles.find(b => b.protocol === 'justlend');
      expect(justlendBundle).toBeDefined();
      expect(justlendBundle!.items).toHaveLength(2);
      expect(justlendBundle!.totalUsd).toBe(5.0);
      expect(justlendBundle!.chain).toBe('tron');

      // Find the GMX bundle
      const gmxBundle = bundles.find(b => b.protocol === 'gmx');
      expect(gmxBundle).toBeDefined();
      expect(gmxBundle!.items).toHaveLength(1);
      expect(gmxBundle!.totalUsd).toBe(5.0);
      expect(gmxBundle!.chain).toBe('avalanche');
    });

    it('should handle empty reward array', () => {
      const bundles = groupByContract([]);
      expect(bundles).toHaveLength(0);
    });
  });

  describe('Policy thresholds', () => {
    it('should filter out rewards below minimum USD threshold', () => {
      const lowValueReward = createTestReward({ amountUsd: 0.05 });
      const validReward = createTestReward({ amountUsd: 0.15 });

      expect(lowValueReward.amountUsd).toBeLessThan(Policy.MIN_ITEM_USD);
      expect(validReward.amountUsd).toBeGreaterThanOrEqual(Policy.MIN_ITEM_USD);
    });

    it('should validate bundle size constraints', () => {
      expect(Policy.MIN_BUNDLE_SIZE).toBeLessThanOrEqual(Policy.MAX_BUNDLE_SIZE);
      expect(Policy.MIN_BUNDLE_SIZE).toBeGreaterThan(0);
      expect(Policy.MAX_BUNDLE_SIZE).toBeGreaterThan(0);
    });

    it('should validate profitability thresholds', () => {
      expect(Policy.MIN_BUNDLE_NET_USD).toBeLessThanOrEqual(Policy.MIN_BUNDLE_GROSS_USD);
      expect(Policy.MIN_BUNDLE_NET_USD).toBeGreaterThan(0);
      expect(Policy.MIN_BUNDLE_GROSS_USD).toBeGreaterThan(0);
    });
  });

  describe('Idempotency', () => {
    it('should generate unique hashes for different bundles', () => {
      const bundle1: ClaimBundle = {
        id: 'bundle1',
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [createTestReward({ id: 'reward1' })],
        totalUsd: 1.0,
        estGasUsd: 0.1,
        netUsd: 0.9
      };

      const bundle2: ClaimBundle = {
        id: 'bundle2',
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [createTestReward({ id: 'reward2' })],
        totalUsd: 2.0,
        estGasUsd: 0.1,
        netUsd: 1.9
      };

      const hash1 = computeBundleHash(bundle1);
      const hash2 = computeBundleHash(bundle2);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
      expect(hash2).toHaveLength(64);
    });

    it('should generate same hash for identical bundles', () => {
      const reward = createTestReward({ id: 'same-reward' });
      
      const bundle1: ClaimBundle = {
        id: 'bundle1',
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [reward],
        totalUsd: 1.0,
        estGasUsd: 0.1,
        netUsd: 0.9
      };

      const bundle2: ClaimBundle = {
        id: 'bundle2', // Different bundle ID
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [reward], // Same reward
        totalUsd: 1.0,
        estGasUsd: 0.1,
        netUsd: 0.9
      };

      const hash1 = computeBundleHash(bundle1);
      const hash2 = computeBundleHash(bundle2);

      expect(hash1).toBe(hash2);
    });

    it('should skip recently processed bundles', () => {
      const bundle: ClaimBundle = {
        id: 'test-bundle',
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [createTestReward()],
        totalUsd: 1.0,
        estGasUsd: 0.1,
        netUsd: 0.9
      };

      // First call should not skip
      expect(shouldSkipIdempotency(bundle)).toBe(false);
      
      // Second call should skip
      expect(shouldSkipIdempotency(bundle)).toBe(true);
    });
  });

  describe('Gas estimation', () => {
    it('should return positive gas estimates', () => {
      const bundle: ClaimBundle = {
        id: 'test-bundle',
        chain: 'avalanche',
        protocol: 'gmx',
        claimTo: { value: 'addr1', chain: 'avalanche' },
        items: [createTestReward(), createTestReward(), createTestReward()],
        totalUsd: 10.0,
        estGasUsd: 0,
        netUsd: 0
      };

      const gasEstimate = estimateBundleGasUsd(bundle, 'avalanche');
      expect(gasEstimate).toBeGreaterThan(0);
    });

    it('should scale gas estimates with bundle size', () => {
      const smallBundle: ClaimBundle = {
        id: 'small-bundle',
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [createTestReward()],
        totalUsd: 2.0,
        estGasUsd: 0,
        netUsd: 0
      };

      const largeBundle: ClaimBundle = {
        id: 'large-bundle',
        chain: 'tron',
        protocol: 'justlend',
        claimTo: { value: 'addr1', chain: 'tron' },
        items: [createTestReward(), createTestReward(), createTestReward()],
        totalUsd: 6.0,
        estGasUsd: 0,
        netUsd: 0
      };

      const smallGas = estimateBundleGasUsd(smallBundle, 'tron');
      const largeGas = estimateBundleGasUsd(largeBundle, 'tron');

      expect(largeGas).toBeGreaterThan(smallGas);
    });
  });

  describe('Microdust filtering', () => {
    it('should filter out rewards below threshold', () => {
      const rewards: PendingReward[] = [
        createTestReward({ amountUsd: 0.05 }), // Below threshold
        createTestReward({ amountUsd: 0.15 }), // Above threshold
        createTestReward({ amountUsd: 0.01 }), // Below threshold
        createTestReward({ amountUsd: 0.25 })  // Above threshold
      ];

      const filteredRewards = rewards.filter(r => r.amountUsd >= Policy.MIN_ITEM_USD);
      
      expect(filteredRewards).toHaveLength(2);
      expect(filteredRewards.every(r => r.amountUsd >= Policy.MIN_ITEM_USD)).toBe(true);
    });

    it('should have MIN_PROFIT_USD baseline economic guardrail', () => {
      expect(Policy.MIN_PROFIT_USD).toBe(0.5);
      expect(typeof Policy.MIN_PROFIT_USD).toBe('number');
      expect(Policy.MIN_PROFIT_USD).toBeGreaterThan(0);
    });
  });
});