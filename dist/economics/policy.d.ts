export declare const PROTOCOL_POLICIES: {
    readonly traderjoe: {
        readonly MIN_REWARD_USD: 1;
        readonly MAX_STAKING_CONTRACTS: 10;
        readonly PREFERRED_CLAIM_TOKENS: readonly ["USDC", "WAVAX"];
        readonly LIQUIDITY_BOOK_ENABLED: true;
    };
    readonly gmx: {
        readonly MIN_REWARD_USD: 5;
        readonly MAX_POSITION_CLOSURES: 3;
        readonly LEVERAGE_WARNING_THRESHOLD: 10;
    };
    readonly benqi: {
        readonly MIN_REWARD_USD: 0.5;
        readonly MAX_LENDING_POSITIONS: 15;
        readonly COMPOUND_THRESHOLD_USD: 10;
    };
    readonly yieldyak: {
        readonly MIN_REWARD_USD: 0.3;
        readonly AUTO_REINVEST_ENABLED: true;
        readonly MAX_FARMS_PER_BUNDLE: 8;
    };
};
export declare const Policy: {
    readonly COOLDOWN_DAYS: 7;
    readonly MIN_ITEM_USD: 0.1;
    readonly MIN_BUNDLE_GROSS_USD: 2;
    readonly MIN_BUNDLE_NET_USD: 1;
    readonly MIN_PROFIT_USD: 0.5;
    readonly MAX_BUNDLE_SIZE: 30;
    readonly MIN_BUNDLE_SIZE: 10;
    readonly IDEMPOTENCY_TTL_HOURS: 1;
    readonly QUARANTINE_TTL_HOURS: 6;
    readonly RETRY_MAX_ATTEMPTS: 3;
    readonly RETRY_BASE_DELAY_MS: 1000;
    readonly SCHEDULE_TICK_INTERVAL_MS: 60000;
    readonly SCHEDULE_JITTER_MS: 5000;
    readonly MAX_DISCOVERY_WALLETS: 1000;
    readonly DISCOVERY_BATCH_SIZE: 50;
    readonly REWARD_SCAN_TIMEOUT_MS: 30000;
    readonly MAX_SLIPPAGE_PCT: 5;
    readonly MIN_EXECUTION_SCORE: 50;
    readonly GAS_ESTIMATION_BUFFER_PCT: 20;
    readonly PRICE_IMPACT_WARNING_PCT: 2;
    readonly PRICE_IMPACT_MAX_PCT: 5;
    readonly CYCLE_SUMMARY_INTERVAL: 10;
    readonly CYCLE_METRICS_RETENTION_HOURS: 24;
    readonly PERFORMANCE_METRICS_WINDOW_SIZE: 100;
    readonly SUCCESS_RATE_WARNING_THRESHOLD: 0.8;
} | {
    COOLDOWN_DAYS: 0;
    MIN_ITEM_USD: 0.01;
    MIN_BUNDLE_GROSS_USD: 0.1;
    MIN_BUNDLE_NET_USD: 0.05;
    MIN_PROFIT_USD: 0.01;
    MAX_BUNDLE_SIZE: 5;
    MIN_BUNDLE_SIZE: 1;
    SCHEDULE_TICK_INTERVAL_MS: 30000;
    MAX_DISCOVERY_WALLETS: 20;
    DISCOVERY_BATCH_SIZE: 5;
    CYCLE_SUMMARY_INTERVAL: 3;
    MIN_EXECUTION_SCORE: 20;
    IDEMPOTENCY_TTL_HOURS: 1;
    QUARANTINE_TTL_HOURS: 6;
    RETRY_MAX_ATTEMPTS: 3;
    RETRY_BASE_DELAY_MS: 1000;
    SCHEDULE_JITTER_MS: 5000;
    REWARD_SCAN_TIMEOUT_MS: 30000;
    MAX_SLIPPAGE_PCT: 5;
    GAS_ESTIMATION_BUFFER_PCT: 20;
    PRICE_IMPACT_WARNING_PCT: 2;
    PRICE_IMPACT_MAX_PCT: 5;
    CYCLE_METRICS_RETENTION_HOURS: 24;
    PERFORMANCE_METRICS_WINDOW_SIZE: 100;
    SUCCESS_RATE_WARNING_THRESHOLD: 0.8;
};
export declare function validatePolicyThresholds(): string[];
export declare function adjustPolicyForMarketConditions(gasPrice: number, volatility: number): Record<string, any>;
//# sourceMappingURL=policy.d.ts.map