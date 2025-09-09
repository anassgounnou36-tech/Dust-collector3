/**
 * Environment variable configuration for Phase 4 Trader Joe Router
 */
export declare const env: {
    readonly mockMode: boolean;
    readonly dbPath: string;
    readonly avalancheRpcUrl: string;
    readonly tronRpcUrl: string;
    readonly avalanchePrivateKey: string | undefined;
    readonly tronPrivateKey: string | undefined;
    readonly defaultClaimRecipientAvax: string | undefined;
    readonly defaultClaimRecipientTron: string | undefined;
    readonly enableSyntheticGmx: boolean;
    readonly devLowerThresholds: boolean;
    readonly traderJoeRouter: string;
    readonly traderJoeFactory: string;
    readonly traderJoeQuoter: string;
    readonly traderJoeSJoeStakingAddress: string | undefined;
    readonly traderJoeSJoeStakingAbiPath: string;
    readonly sJoeHarvestFunction: string;
    readonly joeToken: string;
    readonly sJoeToken: string;
    readonly usdcToken: string;
    readonly wavaxToken: string;
    readonly sJoeMinUsd: number;
    readonly gmxMinUsd: number;
    readonly gmxRewardRouterV2AbiPath: string;
    readonly coinGeckoApiKey: string | undefined;
    readonly defiLlamaApiUrl: string;
    readonly router: {
        readonly slippageTolerance: number;
        readonly deadlineMinutes: number;
        readonly maxHops: number;
        readonly minProfitUsd: number;
    };
    readonly chainlinkFeeds: {
        readonly avaxUsd: string;
    };
};
/**
 * Validates required environment variables for Phase 4
 */
export declare function validatePhase4Env(): void;
/**
 * Gets environment-specific configuration for testing
 */
export declare function getTestConfig(): {
    mockMode: boolean;
    router: {
        minProfitUsd: number;
        slippageTolerance: number;
        deadlineMinutes: number;
        maxHops: number;
    };
    dbPath: string;
    avalancheRpcUrl: string;
    tronRpcUrl: string;
    avalanchePrivateKey: string | undefined;
    tronPrivateKey: string | undefined;
    defaultClaimRecipientAvax: string | undefined;
    defaultClaimRecipientTron: string | undefined;
    enableSyntheticGmx: boolean;
    devLowerThresholds: boolean;
    traderJoeRouter: string;
    traderJoeFactory: string;
    traderJoeQuoter: string;
    traderJoeSJoeStakingAddress: string | undefined;
    traderJoeSJoeStakingAbiPath: string;
    sJoeHarvestFunction: string;
    joeToken: string;
    sJoeToken: string;
    usdcToken: string;
    wavaxToken: string;
    sJoeMinUsd: number;
    gmxMinUsd: number;
    gmxRewardRouterV2AbiPath: string;
    coinGeckoApiKey: string | undefined;
    defiLlamaApiUrl: string;
    chainlinkFeeds: {
        readonly avaxUsd: string;
    };
};
//# sourceMappingURL=env.d.ts.map