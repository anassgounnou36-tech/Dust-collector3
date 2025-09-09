import { env } from '../config/env.js';

// Base policy constants
const BASE_POLICY = {
  COOLDOWN_DAYS: 7,
  MIN_ITEM_USD: 0.10,
  MIN_BUNDLE_GROSS_USD: 2.0,
  MIN_BUNDLE_NET_USD: 1.0,
  MIN_PROFIT_USD: 0.5, // Baseline economic guardrail (configurable)
  MAX_BUNDLE_SIZE: 30,
  MIN_BUNDLE_SIZE: 10,
  IDEMPOTENCY_TTL_HOURS: 1,
  QUARANTINE_TTL_HOURS: 6,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000,
  SCHEDULE_TICK_INTERVAL_MS: 60000, // 1 minute
  SCHEDULE_JITTER_MS: 5000, // ±5 seconds
  
  // Phase 4 enhancements
  MAX_DISCOVERY_WALLETS: 1000, // Limit wallet discovery to prevent overload
  DISCOVERY_BATCH_SIZE: 50, // Process wallets in batches
  REWARD_SCAN_TIMEOUT_MS: 30000, // 30 second timeout for reward scanning
  MAX_SLIPPAGE_PCT: 5.0, // Maximum slippage tolerance
  MIN_EXECUTION_SCORE: 50, // Minimum execution score for trades
  GAS_ESTIMATION_BUFFER_PCT: 20, // 20% gas estimation buffer
  PRICE_IMPACT_WARNING_PCT: 2.0, // Warn at 2% price impact
  PRICE_IMPACT_MAX_PCT: 5.0, // Max 5% price impact
  
  // Cycle reporting
  CYCLE_SUMMARY_INTERVAL: 10, // Report every 10 cycles
  CYCLE_METRICS_RETENTION_HOURS: 24, // Keep metrics for 24 hours
  
  // Performance monitoring
  PERFORMANCE_METRICS_WINDOW_SIZE: 100, // Track last 100 operations
  SUCCESS_RATE_WARNING_THRESHOLD: 0.8, // Warn if success rate drops below 80%
} as const;

// Development overrides for testing
const DEV_OVERRIDES = {
  COOLDOWN_DAYS: 0, // No cooldown for dev testing
  MIN_ITEM_USD: 0.01, // Lower minimum item value
  MIN_BUNDLE_GROSS_USD: 0.10, // Lower bundle minimums
  MIN_BUNDLE_NET_USD: 0.05,
  MIN_PROFIT_USD: 0.01, // Lower profit threshold
  MAX_BUNDLE_SIZE: 5, // Smaller bundle sizes
  MIN_BUNDLE_SIZE: 1,
  SCHEDULE_TICK_INTERVAL_MS: 30000, // Faster cycles (30 seconds)
  
  // Phase 4 dev overrides
  MAX_DISCOVERY_WALLETS: 20, // Limit for testing
  DISCOVERY_BATCH_SIZE: 5,
  CYCLE_SUMMARY_INTERVAL: 3, // Report every 3 cycles in dev
  MIN_EXECUTION_SCORE: 20, // Lower threshold for testing
} as const;

// Phase 4 protocol-specific policies
export const PROTOCOL_POLICIES = {
  traderjoe: {
    MIN_REWARD_USD: 1.0, // Minimum sJOE reward worth claiming
    MAX_STAKING_CONTRACTS: 10, // Limit staking contract interactions per bundle
    PREFERRED_CLAIM_TOKENS: ['USDC', 'WAVAX'], // Prefer these tokens for claims
    LIQUIDITY_BOOK_ENABLED: true, // Use v2.1 Liquidity Book features
  },
  gmx: {
    MIN_REWARD_USD: 5.0, // Higher minimum for GMX due to gas costs
    MAX_POSITION_CLOSURES: 3, // Limit position closures per bundle
    LEVERAGE_WARNING_THRESHOLD: 10, // Warn for leverage above 10x
  },
  benqi: {
    MIN_REWARD_USD: 0.5,
    MAX_LENDING_POSITIONS: 15,
    COMPOUND_THRESHOLD_USD: 10.0, // Auto-compound rewards above $10
  },
  yieldyak: {
    MIN_REWARD_USD: 0.3,
    AUTO_REINVEST_ENABLED: true,
    MAX_FARMS_PER_BUNDLE: 8,
  }
} as const;

// Apply development overrides if enabled
export const Policy = env.devLowerThresholds 
  ? { ...BASE_POLICY, ...DEV_OVERRIDES }
  : BASE_POLICY;

// Enhanced policy validation
export function validatePolicyThresholds(): string[] {
  const warnings: string[] = [];
  
  if (Policy.MIN_BUNDLE_NET_USD > Policy.MIN_BUNDLE_GROSS_USD) {
    warnings.push('MIN_BUNDLE_NET_USD cannot be greater than MIN_BUNDLE_GROSS_USD');
  }
  
  if (Policy.MIN_BUNDLE_SIZE > Policy.MAX_BUNDLE_SIZE) {
    warnings.push('MIN_BUNDLE_SIZE cannot be greater than MAX_BUNDLE_SIZE');
  }
  
  if (Policy.PRICE_IMPACT_WARNING_PCT > Policy.PRICE_IMPACT_MAX_PCT) {
    warnings.push('PRICE_IMPACT_WARNING_PCT should be less than PRICE_IMPACT_MAX_PCT');
  }
  
  if (Policy.MIN_EXECUTION_SCORE < 0 || Policy.MIN_EXECUTION_SCORE > 100) {
    warnings.push('MIN_EXECUTION_SCORE should be between 0 and 100');
  }
  
  return warnings;
}

// Dynamic policy adjustments based on market conditions
export function adjustPolicyForMarketConditions(gasPrice: number, volatility: number): Record<string, any> {
  const adjustments: Record<string, any> = {};
  
  // Adjust gas-sensitive thresholds during high gas periods
  if (gasPrice > 50) { // High gas (>50 gwei)
    adjustments['MIN_BUNDLE_NET_USD'] = Policy.MIN_BUNDLE_NET_USD * 1.5;
    adjustments['MIN_PROFIT_USD'] = Policy.MIN_PROFIT_USD * 2;
  }
  
  // Adjust slippage during high volatility
  if (volatility > 0.05) { // High volatility (>5%)
    adjustments['MAX_SLIPPAGE_PCT'] = Math.max(Policy.MAX_SLIPPAGE_PCT * 0.8, 2.0);
    adjustments['PRICE_IMPACT_MAX_PCT'] = Math.max(Policy.PRICE_IMPACT_MAX_PCT * 0.8, 3.0);
  }
  
  return adjustments;
}