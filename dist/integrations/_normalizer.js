"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeClaimTargets = normalizeClaimTargets;
exports.filterSyntheticRewards = filterSyntheticRewards;
const addresses_js_1 = require("../config/addresses.js");
/**
 * Normalize claim targets in pending rewards to use environment-provided
 * default recipients when in non-mock mode and address is missing or placeholder.
 */
function normalizeClaimTargets(rewards, mockMode) {
    if (mockMode) {
        return rewards; // No normalization in mock mode
    }
    return rewards.map(reward => {
        // Check if claimTo needs to be normalized
        const needsNormalization = !reward.claimTo || (0, addresses_js_1.isPlaceholderAddress)(reward.claimTo);
        if (!needsNormalization) {
            return reward; // Already has valid claim target
        }
        // Get default recipient for this chain
        const defaultRecipient = (0, addresses_js_1.getDefaultClaimRecipient)(reward.wallet.chain);
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
function filterSyntheticRewards(rewards, mockMode) {
    if (mockMode) {
        return rewards; // Allow synthetic rewards in mock mode
    }
    const filtered = rewards.filter(reward => !reward.isSynthetic);
    if (filtered.length !== rewards.length) {
        console.log(`Filtered out ${rewards.length - filtered.length} synthetic rewards in non-mock mode`);
    }
    return filtered;
}
//# sourceMappingURL=_normalizer.js.map