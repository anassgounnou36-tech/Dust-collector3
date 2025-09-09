import type { PendingReward } from '../types/common.js';
/**
 * Normalize claim targets in pending rewards to use environment-provided
 * default recipients when in non-mock mode and address is missing or placeholder.
 */
export declare function normalizeClaimTargets(rewards: PendingReward[], mockMode: boolean): PendingReward[];
/**
 * Filter out synthetic rewards in non-mock mode to prevent execution
 * of test/placeholder rewards in production.
 */
export declare function filterSyntheticRewards(rewards: PendingReward[], mockMode: boolean): PendingReward[];
//# sourceMappingURL=_normalizer.d.ts.map