"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateBundleGasUsd = estimateBundleGasUsd;
exports.estimateClaimGasUsd = estimateClaimGasUsd;
exports.validateGasEstimate = validateGasEstimate;
exports.updateGasEstimates = updateGasEstimates;
exports.estimateBundleUsd = estimateBundleUsd;
// Default gas limit for Avalanche claims
const DEFAULT_AVAX_CLAIM_GAS = 120000;
// Gas estimation constants - these would need to be tuned based on real data
const GAS_ESTIMATES = {
    avalanche: {
        baseClaim: 100000, // Base gas for a simple claim
        perExtraClaim: 80000, // Additional gas per extra claim in bundle
        gasPrice: 25000000000, // 25 gwei in wei
        nativePrice: 30 // AVAX price in USD
    },
    tron: {
        baseEnergy: 50000, // Base energy for a simple claim
        perExtraEnergy: 40000, // Additional energy per extra claim
        energyToTrx: 0.001, // Energy to TRX conversion rate
        trxPrice: 0.08 // TRX price in USD
    }
};
function estimateBundleGasUsd(bundle, chain) {
    try {
        if (chain === 'avalanche') {
            const estimates = GAS_ESTIMATES.avalanche;
            const totalGas = estimates.baseClaim + (bundle.items.length - 1) * estimates.perExtraClaim;
            const gasCostWei = BigInt(totalGas) * BigInt(estimates.gasPrice);
            const gasCostEth = Number(gasCostWei) / 1e18;
            return gasCostEth * estimates.nativePrice;
        }
        if (chain === 'tron') {
            const estimates = GAS_ESTIMATES.tron;
            const totalEnergy = estimates.baseEnergy + (bundle.items.length - 1) * estimates.perExtraEnergy;
            const energyCostTrx = totalEnergy * estimates.energyToTrx;
            return energyCostTrx * estimates.trxPrice;
        }
        console.warn(`Unknown chain for gas estimation: ${chain}`);
        return 0;
    }
    catch (error) {
        console.error(`Failed to estimate gas for bundle ${bundle.id}:`, error);
        return 0;
    }
}
function estimateClaimGasUsd(chain, itemCount = 1) {
    const mockBundle = {
        id: 'estimate',
        chain,
        protocol: 'mock',
        claimTo: { value: '0x0', chain },
        items: new Array(itemCount).fill(null),
        totalUsd: 0,
        estGasUsd: 0,
        netUsd: 0
    };
    return estimateBundleGasUsd(mockBundle, chain);
}
// Helper function to validate gas estimates are reasonable
function validateGasEstimate(gasUsd, totalUsd) {
    // Gas should not exceed 50% of total value
    const maxGasRatio = 0.5;
    const gasRatio = gasUsd / totalUsd;
    if (gasRatio > maxGasRatio) {
        console.warn(`Gas estimate too high: ${gasUsd} USD gas for ${totalUsd} USD value (${(gasRatio * 100).toFixed(1)}%)`);
        return false;
    }
    return true;
}
// Update gas estimates based on actual execution data
// This would be called after successful executions to improve estimates
function updateGasEstimates(chain, itemCount, actualGasUsd) {
    // TODO: Implement learning mechanism to improve gas estimates
    // Could use a rolling average or more sophisticated ML approach
    console.log(`Gas estimate feedback: ${chain} with ${itemCount} items cost ${actualGasUsd} USD`);
}
// New function as specified in requirements
async function estimateBundleUsd(bundle) {
    try {
        // Import avalanche client functions dynamically to avoid circular deps
        const { gasPrice, nativeUsd } = await Promise.resolve().then(() => __importStar(require('../chains/avalanche.js')));
        let totalGasLimit = 0;
        // Calculate total gas limit for all claims in bundle
        for (const claim of bundle.items) {
            if (claim.estGasLimit) {
                totalGasLimit += claim.estGasLimit;
            }
            else {
                // Use default heuristic constant as specified
                totalGasLimit += DEFAULT_AVAX_CLAIM_GAS;
            }
        }
        // Get current gas price from chain client
        const maxFeePerGas = await gasPrice();
        // Calculate gas cost in native token
        const gasNative = Number(BigInt(totalGasLimit) * maxFeePerGas) / 1e18;
        // Convert to USD using chain client
        const avaxUsd = await nativeUsd();
        const gasUsd = gasNative * avaxUsd;
        // Set estGasUsd on bundle (mutating for backward compatibility)
        bundle.estGasUsd = gasUsd;
        return gasUsd;
    }
    catch (error) {
        console.error(`Failed to estimate bundle gas USD for bundle ${bundle.id}:`, error);
        return 0;
    }
}
//# sourceMappingURL=gas.js.map