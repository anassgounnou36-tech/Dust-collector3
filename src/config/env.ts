import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Environment variable configuration for Phase 4 Trader Joe Router
 */
export const env = {
  // Core configuration
  mockMode: process.env.MOCK_MODE === 'true',
  dbPath: process.env.DB_PATH || './data/bot.db',

  // Chain RPC URLs
  avalancheRpcUrl: process.env.PRICER_RPC_AVAX || 'https://api.avax.network/ext/bc/C/rpc',
  tronRpcUrl: process.env.PRICER_RPC_TRON || 'https://api.trongrid.io',

  // Private keys (optional)
  avalanchePrivateKey: process.env.PRIVATE_KEY_AVAX,
  tronPrivateKey: process.env.PRIVATE_KEY_TRON,

  // Default claim recipients (required when mockMode=false)
  defaultClaimRecipientAvax: process.env.DEFAULT_CLAIM_RECIPIENT_AVAX,
  defaultClaimRecipientTron: process.env.DEFAULT_CLAIM_RECIPIENT_TRON,

  // Feature flags
  enableSyntheticGmx: process.env.ENABLE_SYNTHETIC_GMX === 'true',
  devLowerThresholds: process.env.DEV_LOWER_THRESHOLDS === 'true',

  // Trader Joe contract addresses
  traderJoeRouter: process.env.TRADERJOE_ROUTER_ADDRESS || '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
  traderJoeFactory: process.env.TRADERJOE_FACTORY_ADDRESS || '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
  traderJoeQuoter: process.env.TRADERJOE_QUOTER_ADDRESS || '0x4c45bbec2ff7810ef4a77ad79ed7d9b699419b5c',
  
  // Trader Joe sJOE staking
  traderJoeSJoeStakingAddress: process.env.TRADERJOE_SJOE_STAKING_ADDRESS,
  traderJoeSJoeStakingAbiPath: process.env.TRADERJOE_SJOE_STAKING_ABI_PATH || './abi/traderjoe_sjoe_staking.json',
  sJoeHarvestFunction: process.env.SJOE_HARVEST_FUNCTION || 'harvest', // 'harvest' or 'getReward'

  // Token addresses
  joeToken: process.env.JOE_TOKEN_ADDRESS || '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
  sJoeToken: process.env.SJOE_TOKEN_ADDRESS || '0x1a731B2299E22FbAC282E7094EdA41046343Cb51',
  usdcToken: process.env.USDC_TOKEN || '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  wavaxToken: process.env.WAVAX_TOKEN || '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  
  // sJOE specific configuration
  sJoeMinUsd: parseFloat(process.env.SJOE_MIN_USD || '1.0'),

  // GMX specific configuration
  gmxMinUsd: parseFloat(process.env.GMX_MIN_USD || '5.0'),
  gmxRewardRouterV2AbiPath: process.env.GMX_REWARD_ROUTER_V2_ABI_PATH || './abi/gmx_reward_router_v2.json',

  // Pricing API configuration
  coinGeckoApiKey: process.env.COINGECKO_API_KEY,
  defiLlamaApiUrl: process.env.DEFILLAMA_API_URL || 'https://api.llama.fi',

  // Router configuration
  router: {
    slippageTolerance: parseFloat(process.env.ROUTER_SLIPPAGE_TOLERANCE || '0.005'), // 0.5% default
    deadlineMinutes: parseInt(process.env.ROUTER_DEADLINE_MINUTES || '10', 10),
    maxHops: parseInt(process.env.ROUTER_MAX_HOPS || '2', 10),
    minProfitUsd: parseFloat(process.env.ROUTER_MIN_PROFIT_USD || '0.50')
  },

  // Chainlink price feeds
  chainlinkFeeds: {
    avaxUsd: process.env.CHAINLINK_AVAX_USD_FEED || '0x0A77230d17318075983913bC2145DB16C7366156'
  }
} as const;

/**
 * Validates required environment variables for Phase 4
 */
export function validatePhase4Env(): void {
  const required = [
    'PRICER_RPC_AVAX'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for Phase 4: ${missing.join(', ')}`);
  }

  // Validate numeric values
  if (isNaN(env.router.slippageTolerance) || env.router.slippageTolerance <= 0 || env.router.slippageTolerance >= 1) {
    throw new Error('ROUTER_SLIPPAGE_TOLERANCE must be a number between 0 and 1');
  }

  if (env.router.deadlineMinutes <= 0) {
    throw new Error('ROUTER_DEADLINE_MINUTES must be positive');
  }

  if (env.router.maxHops <= 0 || env.router.maxHops > 3) {
    throw new Error('ROUTER_MAX_HOPS must be between 1 and 3');
  }

  if (env.router.minProfitUsd < 0) {
    throw new Error('ROUTER_MIN_PROFIT_USD must be non-negative');
  }
}

/**
 * Gets environment-specific configuration for testing
 */
export function getTestConfig() {
  return {
    ...env,
    mockMode: true,
    router: {
      ...env.router,
      minProfitUsd: 0.01 // Lower threshold for tests
    }
  };
}