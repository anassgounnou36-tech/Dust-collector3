/**
 * Slippage protection and calculation utilities for Phase 4
 */

import type { SlippageConfig } from '../routers/types.js';

/**
 * Default slippage configurations for different scenarios
 */
export const DEFAULT_SLIPPAGE = {
  CONSERVATIVE: 0.001, // 0.1%
  NORMAL: 0.005,      // 0.5%
  AGGRESSIVE: 0.01,   // 1.0%
  EMERGENCY: 0.03     // 3.0%
} as const;

/**
 * Time-to-live configurations for transactions
 */
export const DEFAULT_TTL = {
  FAST: 2,      // 2 minutes
  NORMAL: 10,   // 10 minutes
  SLOW: 30,     // 30 minutes
  BATCH: 60     // 1 hour for batch operations
} as const;

/**
 * Calculates the minimum output amount after applying slippage
 */
export function calculateMinOutput(
  expectedOutput: bigint,
  slippageTolerance: number
): bigint {
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
export function calculateMaxInput(
  expectedInput: bigint,
  slippageTolerance: number
): bigint {
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
export function calculateDeadline(ttlMinutes: number): number {
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
export function validateSlippageConfig(config: SlippageConfig): void {
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
export function calculateActualSlippage(
  expectedAmount: bigint,
  actualAmount: bigint,
  isOutput: boolean = true
): number {
  if (expectedAmount === 0n) {
    return 0;
  }

  let slippage: number;
  
  if (isOutput) {
    // For output: slippage = (expected - actual) / expected
    const diff = Number(expectedAmount - actualAmount);
    slippage = diff / Number(expectedAmount);
  } else {
    // For input: slippage = (actual - expected) / expected
    const diff = Number(actualAmount - expectedAmount);
    slippage = diff / Number(expectedAmount);
  }

  return Math.max(0, slippage); // Ensure non-negative
}

/**
 * Price impact calculation
 */
export function calculatePriceImpact(
  inputAmount: bigint,
  outputAmount: bigint,
  marketPrice: number,
  inputDecimals: number,
  outputDecimals: number
): number {
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
export function getRecommendedSlippage(
  volumeUsd: number,
  priceImpact: number,
  urgency: 'low' | 'normal' | 'high' = 'normal'
): number {
  let baseSlippage: number;

  // Base slippage based on urgency
  switch (urgency) {
    case 'low':
      baseSlippage = DEFAULT_SLIPPAGE.CONSERVATIVE;
      break;
    case 'high':
      baseSlippage = DEFAULT_SLIPPAGE.AGGRESSIVE;
      break;
    default:
      baseSlippage = DEFAULT_SLIPPAGE.NORMAL;
  }

  // Adjust for volume (larger trades need more slippage)
  if (volumeUsd > 10000) {
    baseSlippage *= 1.5;
  } else if (volumeUsd > 1000) {
    baseSlippage *= 1.2;
  }

  // Adjust for price impact
  if (priceImpact > 0.02) { // 2%+
    baseSlippage = Math.max(baseSlippage, priceImpact * 1.5);
  } else if (priceImpact > 0.01) { // 1%+
    baseSlippage = Math.max(baseSlippage, priceImpact * 1.2);
  }

  // Cap at reasonable maximum
  return Math.min(baseSlippage, DEFAULT_SLIPPAGE.EMERGENCY);
}

/**
 * Slippage protection result
 */
export interface SlippageResult {
  readonly originalAmount: bigint;
  readonly protectedAmount: bigint;
  readonly slippageTolerance: number;
  readonly deadline: number;
  readonly priceImpact: number;
  readonly recommended: boolean;
  readonly warnings: string[];
}

/**
 * Comprehensive slippage protection for a trade
 */
export function protectTrade(
  amount: bigint,
  slippageConfig: SlippageConfig,
  priceImpact: number,
  volumeUsd: number,
  isOutput: boolean = true
): SlippageResult {
  validateSlippageConfig(slippageConfig);

  const warnings: string[] = [];
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
export function formatSlippage(slippage: number): string {
  return `${(slippage * 100).toFixed(2)}%`;
}

/**
 * Utility to format deadline for display
 */
export function formatDeadline(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const minutesLeft = Math.floor((deadline - now) / 60);
  return `${minutesLeft} minutes`;
}