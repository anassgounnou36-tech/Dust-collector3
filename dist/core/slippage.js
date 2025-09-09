"use strict";
/**
 * Slippage protection and calculation utilities for Phase 4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TTL = exports.DEFAULT_SLIPPAGE = void 0;
exports.calculateMinOutput = calculateMinOutput;
exports.calculateMaxInput = calculateMaxInput;
exports.calculateDeadline = calculateDeadline;
exports.validateSlippageConfig = validateSlippageConfig;
exports.calculateActualSlippage = calculateActualSlippage;
exports.calculatePriceImpact = calculatePriceImpact;
exports.getRecommendedSlippage = getRecommendedSlippage;
exports.protectTrade = protectTrade;
exports.formatSlippage = formatSlippage;
exports.formatDeadline = formatDeadline;
/**
 * Default slippage configurations for different scenarios
 */
exports.DEFAULT_SLIPPAGE = {
    CONSERVATIVE: 0.001, // 0.1%
    NORMAL: 0.005, // 0.5%
    AGGRESSIVE: 0.01, // 1.0%
    EMERGENCY: 0.03 // 3.0%
};
/**
 * Time-to-live configurations for transactions
 */
exports.DEFAULT_TTL = {
    FAST: 2, // 2 minutes
    NORMAL: 10, // 10 minutes
    SLOW: 30, // 30 minutes
    BATCH: 60 // 1 hour for batch operations
};
/**
 * Calculates the minimum output amount after applying slippage
 */
function calculateMinOutput(expectedOutput, slippageTolerance) {
    if (slippageTolerance < 0 || slippageTolerance >= 1) {
        throw new Error(`Invalid slippage tolerance: ${slippageTolerance}. Must be between 0 and 1.`);
    }
    const slippageMultiplier = 1 - slippageTolerance;
    const minOutput = (expectedOutput * BigInt(Math.floor(slippageMultiplier * 10000))) / BigInt(10000);
    return minOutput;
}
/**
 * Calculates the maximum input amount before applying slippage
 */
function calculateMaxInput(expectedInput, slippageTolerance) {
    if (slippageTolerance < 0 || slippageTolerance >= 1) {
        throw new Error(`Invalid slippage tolerance: ${slippageTolerance}. Must be between 0 and 1.`);
    }
    const slippageMultiplier = 1 + slippageTolerance;
    const maxInput = (expectedInput * BigInt(Math.floor(slippageMultiplier * 10000))) / BigInt(10000);
    return maxInput;
}
/**
 * Calculates transaction deadline based on current time and TTL
 */
function calculateDeadline(ttlMinutes) {
    if (ttlMinutes <= 0) {
        throw new Error(`Invalid TTL: ${ttlMinutes}. Must be positive.`);
    }
    const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp
    const deadline = currentTime + (ttlMinutes * 60);
    return deadline;
}
/**
 * Validates slippage configuration
 */
function validateSlippageConfig(config) {
    if (config.tolerance < 0 || config.tolerance >= 1) {
        throw new Error(`Invalid slippage tolerance: ${config.tolerance}. Must be between 0 and 1.`);
    }
    if (config.deadlineMinutes <= 0) {
        throw new Error(`Invalid deadline: ${config.deadlineMinutes}. Must be positive.`);
    }
    if (config.deadlineMinutes > 60) {
        console.warn(`Long deadline detected: ${config.deadlineMinutes} minutes. Consider shorter deadlines for better execution.`);
    }
}
/**
 * Calculates actual slippage from expected vs actual amounts
 */
function calculateActualSlippage(expectedAmount, actualAmount, isOutput = true) {
    if (expectedAmount === 0n) {
        return 0;
    }
    let slippage;
    if (isOutput) {
        // For output: slippage = (expected - actual) / expected
        const diff = Number(expectedAmount - actualAmount);
        slippage = diff / Number(expectedAmount);
    }
    else {
        // For input: slippage = (actual - expected) / expected
        const diff = Number(actualAmount - expectedAmount);
        slippage = diff / Number(expectedAmount);
    }
    return Math.max(0, slippage); // Ensure non-negative
}
/**
 * Price impact calculation
 */
function calculatePriceImpact(inputAmount, outputAmount, marketPrice, inputDecimals, outputDecimals) {
    if (inputAmount === 0n || outputAmount === 0n || marketPrice <= 0) {
        return 0;
    }
    // Convert to human-readable numbers
    const inputHuman = Number(inputAmount) / Math.pow(10, inputDecimals);
    const outputHuman = Number(outputAmount) / Math.pow(10, outputDecimals);
    // Calculate execution price
    const executionPrice = outputHuman / inputHuman;
    // Price impact = (market_price - execution_price) / market_price
    const priceImpact = (marketPrice - executionPrice) / marketPrice;
    return Math.max(0, priceImpact);
}
/**
 * Determines appropriate slippage for given conditions
 */
function getRecommendedSlippage(volumeUsd, priceImpact, urgency = 'normal') {
    let baseSlippage;
    // Base slippage based on urgency
    switch (urgency) {
        case 'low':
            baseSlippage = exports.DEFAULT_SLIPPAGE.CONSERVATIVE;
            break;
        case 'high':
            baseSlippage = exports.DEFAULT_SLIPPAGE.AGGRESSIVE;
            break;
        default:
            baseSlippage = exports.DEFAULT_SLIPPAGE.NORMAL;
    }
    // Adjust for volume (larger trades need more slippage)
    if (volumeUsd > 10000) {
        baseSlippage *= 1.5;
    }
    else if (volumeUsd > 1000) {
        baseSlippage *= 1.2;
    }
    // Adjust for price impact
    if (priceImpact > 0.02) { // 2%+
        baseSlippage = Math.max(baseSlippage, priceImpact * 1.5);
    }
    else if (priceImpact > 0.01) { // 1%+
        baseSlippage = Math.max(baseSlippage, priceImpact * 1.2);
    }
    // Cap at reasonable maximum
    return Math.min(baseSlippage, exports.DEFAULT_SLIPPAGE.EMERGENCY);
}
/**
 * Comprehensive slippage protection for a trade
 */
function protectTrade(amount, slippageConfig, priceImpact, volumeUsd, isOutput = true) {
    validateSlippageConfig(slippageConfig);
    const warnings = [];
    const deadline = calculateDeadline(slippageConfig.deadlineMinutes);
    // Check if slippage is appropriate
    const recommendedSlippage = getRecommendedSlippage(volumeUsd, priceImpact);
    if (slippageConfig.tolerance < recommendedSlippage) {
        warnings.push(`Slippage tolerance ${(slippageConfig.tolerance * 100).toFixed(2)}% may be too low. Recommended: ${(recommendedSlippage * 100).toFixed(2)}%`);
    }
    if (priceImpact > 0.05) { // 5%+
        warnings.push(`High price impact detected: ${(priceImpact * 100).toFixed(2)}%. Consider smaller trade size.`);
    }
    if (slippageConfig.deadlineMinutes < 2) {
        warnings.push(`Very short deadline: ${slippageConfig.deadlineMinutes} minutes. May cause transaction failures.`);
    }
    // Calculate protected amount
    const protectedAmount = isOutput
        ? calculateMinOutput(amount, slippageConfig.tolerance)
        : calculateMaxInput(amount, slippageConfig.tolerance);
    return {
        originalAmount: amount,
        protectedAmount,
        slippageTolerance: slippageConfig.tolerance,
        deadline,
        priceImpact,
        recommended: warnings.length === 0,
        warnings
    };
}
/**
 * Utility to format slippage percentage for display
 */
function formatSlippage(slippage) {
    return `${(slippage * 100).toFixed(2)}%`;
}
/**
 * Utility to format deadline for display
 */
function formatDeadline(deadline) {
    const now = Math.floor(Date.now() / 1000);
    const minutesLeft = Math.floor((deadline - now) / 60);
    return `${minutesLeft} minutes`;
}
//# sourceMappingURL=slippage.js.map