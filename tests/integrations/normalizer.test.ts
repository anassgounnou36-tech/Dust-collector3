import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeClaimTargets, filterSyntheticRewards } from '../../src/integrations/_normalizer.js';
import type { PendingReward, Address } from '../../src/types/common.js';

describe('Normalizer Tests', () => {
  let mockRewards: PendingReward[];
  let placeholderAddress: Address;
  let validAddress: Address;

  beforeEach(() => {
    placeholderAddress = {
      value: '0x0000000000000000000000000000000000000000',
      chain: 'avalanche'
    };

    validAddress = {
      value: '0x1234567890123456789012345678901234567890',
      chain: 'avalanche'
    };

    // Set up environment for testing
    process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = validAddress.value;

    mockRewards = [
      {
        id: 'reward-1',
        wallet: validAddress,
        protocol: 'test',
        token: { value: '0xToken1', chain: 'avalanche' },
        amountWei: '1000000000000000000',
        amountUsd: 5.0,
        claimTo: placeholderAddress, // Will be normalized
        discoveredAt: new Date()
      },
      {
        id: 'reward-2',
        wallet: validAddress,
        protocol: 'test',
        token: { value: '0xToken2', chain: 'avalanche' },
        amountWei: '2000000000000000000',
        amountUsd: 10.0,
        claimTo: validAddress, // Already valid
        discoveredAt: new Date()
      },
      {
        id: 'reward-3-synthetic',
        wallet: validAddress,
        protocol: 'test',
        token: { value: '0xToken3', chain: 'avalanche' },
        amountWei: '500000000000000000',
        amountUsd: 2.5,
        claimTo: validAddress,
        discoveredAt: new Date(),
        isSynthetic: true // Should be filtered in non-mock mode
      }
    ];
  });

  describe('Claim Target Normalization', () => {
    it('should normalize placeholder addresses in non-mock mode', () => {
      const result = normalizeClaimTargets(mockRewards, false);
      
      expect(result).toHaveLength(3);
      expect(result[0].claimTo.value).toBe(validAddress.value); // Normalized
      expect(result[1].claimTo.value).toBe(validAddress.value); // Unchanged
      expect(result[2].claimTo.value).toBe(validAddress.value); // Unchanged
    });

    it('should not normalize in mock mode', () => {
      const result = normalizeClaimTargets(mockRewards, true);
      
      expect(result).toHaveLength(3);
      expect(result[0].claimTo.value).toBe(placeholderAddress.value); // Unchanged in mock mode
      expect(result[1].claimTo.value).toBe(validAddress.value); // Unchanged
      expect(result[2].claimTo.value).toBe(validAddress.value); // Unchanged
    });

    it('should handle missing environment variable gracefully', () => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
      
      const result = normalizeClaimTargets(mockRewards, false);
      
      // Should return original rewards when no default recipient is configured
      expect(result).toHaveLength(3);
      expect(result[0].claimTo.value).toBe(placeholderAddress.value); // Not normalized due to missing env var
    });
  });

  describe('Synthetic Reward Filtering', () => {
    it('should filter out synthetic rewards in non-mock mode', () => {
      const result = filterSyntheticRewards(mockRewards, false);
      
      expect(result).toHaveLength(2);
      expect(result.find(r => r.isSynthetic)).toBeUndefined();
      expect(result.map(r => r.id)).toEqual(['reward-1', 'reward-2']);
    });

    it('should keep synthetic rewards in mock mode', () => {
      const result = filterSyntheticRewards(mockRewards, true);
      
      expect(result).toHaveLength(3);
      expect(result.find(r => r.isSynthetic)).toBeDefined();
      expect(result.map(r => r.id)).toEqual(['reward-1', 'reward-2', 'reward-3-synthetic']);
    });

    it('should handle rewards without isSynthetic flag', () => {
      const rewardsWithoutFlag = mockRewards.map(r => ({ ...r, isSynthetic: undefined }));
      
      const result = filterSyntheticRewards(rewardsWithoutFlag, false);
      
      expect(result).toHaveLength(3); // All kept since none are explicitly synthetic
    });
  });

  describe('Combined Processing', () => {
    it('should apply both filters in correct order', () => {
      // First filter synthetics, then normalize
      let result = filterSyntheticRewards(mockRewards, false);
      result = normalizeClaimTargets(result, false);
      
      expect(result).toHaveLength(2); // Synthetic filtered out
      expect(result[0].claimTo.value).toBe(validAddress.value); // Normalized
      expect(result[1].claimTo.value).toBe(validAddress.value); // Already valid
    });

    it('should work with empty rewards array', () => {
      const emptyRewards: PendingReward[] = [];
      
      let result = filterSyntheticRewards(emptyRewards, false);
      result = normalizeClaimTargets(result, false);
      
      expect(result).toHaveLength(0);
    });
  });
});