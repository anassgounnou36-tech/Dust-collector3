import type { PendingReward } from '../types/common.js';
import { isPlaceholderAddress, getDefaultClaimRecipient } from '../config/addresses.js';

/**
 * Normalize claim targets in pending rewards to use environment-provided 
 * default recipients when in non-mock mode and address is missing or placeholder.
 */
export function normalizeClaimTargets(
  rewards: PendingReward[], 
  mockMode: boolean
): PendingReward[] {
  if (mockMode) {
    return rewards; // No normalization in mock mode
  }
  
  return rewards.map(reward => {
    // Check if claimTo needs to be normalized
    const needsNormalization = !reward.claimTo || isPlaceholderAddress(reward.claimTo);
    
    if (!needsNormalization) {
      return reward; // Already has valid claim target
    }
    
    // Get default recipient for this chain
    const defaultRecipient = getDefaultClaimRecipient(reward.wallet.chain);
    
    if (!defaultRecipient) {
      // This should be caught by validation, but handle gracefully
      console.warn(`No default claim recipient configured for chain ${reward.wallet.chain}, skipping reward ${reward.id}`);
      return reward;
    }
    
    // Return normalized reward with updated claimTo
    return {
      ...reward,
      claimTo: defaultRecipient
    };
  });
}

/**
 * Filter out synthetic rewards in non-mock mode to prevent execution
 * of test/placeholder rewards in production.
 */
export function filterSyntheticRewards(
  rewards: PendingReward[], 
  mockMode: boolean
): PendingReward[] {
  if (mockMode) {
    return rewards; // Allow synthetic rewards in mock mode
  }
  
  const filtered = rewards.filter(reward => !reward.isSynthetic);
  
  if (filtered.length !== rewards.length) {
    console.log(`Filtered out ${rewards.length - filtered.length} synthetic rewards in non-mock mode`);
  }
  
  return filtered;
}