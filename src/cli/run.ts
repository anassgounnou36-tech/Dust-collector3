#!/usr/bin/env node

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config, Integration, ChainClient } from '../types/common.js';
import { initDb, initSchema, upsertWallet, recordPending } from '../state/db.js';
import { AvalancheClient } from '../chains/avalanche.js';
import { TronClient } from '../chains/tron.js';
import { justlendIntegration } from '../integrations/justlend.js';
import { sunswapIntegration } from '../integrations/sunswap.js';
import { gmxIntegration } from '../integrations/gmx.js';
import { traderJoeIntegration } from '../integrations/traderjoe.js';
import { sJoeIntegration } from '../integrations/traderjoe/sjoe.js';
import { benqiIntegration } from '../integrations/benqi.js';
import { yieldYakIntegration } from '../integrations/yieldyak.js';
import { seedWallets } from '../discovery/seeds.js';
import { groupByContract, splitLargeBundles, mergeBundles } from '../engine/bundler.js';
import { dryRun } from '../engine/simulator.js';
import { execute, injectPricingService } from '../engine/executor.js';
import { recordExecutionResult } from '../engine/ledger.js';
import { shouldSkipIdempotency } from '../engine/idempotency.js';
import { isWalletQuarantined, withExponentialBackoff } from '../engine/retry.js';
import { Scheduler } from '../engine/scheduler.js';
import { logger } from '../engine/logger.js';
import { Policy } from '../economics/policy.js';
import { validateClaimRecipients } from '../config/addresses.js';
import { normalizeClaimTargets, filterSyntheticRewards } from '../integrations/_normalizer.js';
import { quoteToUsd, getTokenDecimals } from '../economics/pricing.js';
import { printStartupDiagnostics } from '../engine/startupDiagnostics.js';

// Environment variables
config();

// ---------------------------------------------------------------------------
// Global safety handlers
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught exception', err);
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.fatal('Unhandled rejection', reason);
});

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------
function loadConfig(): Config {
  try {
    const configPath = join(__dirname, '../config/config.example.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const baseConfig = JSON.parse(configFile);

    const envConfig: Config = {
      ...baseConfig,
      chains: {
        avalanche: {
          rpcUrl: process.env.PRICER_RPC_AVAX || baseConfig.chains.avalanche.rpcUrl,
          privateKey: process.env.PRIVATE_KEY_AVAX
        },
        tron: {
          rpcUrl: process.env.PRICER_RPC_TRON || baseConfig.chains.tron.rpcUrl,
          privateKey: process.env.PRIVATE_KEY_TRON
        }
      },
      database: {
        path: process.env.DB_PATH || baseConfig.database.path
      },
      mockMode: process.env.MOCK_MODE === 'true'
    };

    return envConfig;
  } catch (error) {
    logger.fatal('Failed to load configuration file', error);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Chain clients
// ---------------------------------------------------------------------------
function createChainClients(configObj: Config): Map<string, ChainClient> {
  const clients = new Map<string, ChainClient>();
  const debug = process.env.DEBUG_STARTUP === 'true';

  if (configObj.chains.avalanche.privateKey || configObj.mockMode) {
    try {
      const avalancheClient = new AvalancheClient(
        configObj.chains.avalanche.rpcUrl,
        configObj.chains.avalanche.privateKey
      );
      clients.set('avalanche', avalancheClient);
      logger.info('Avalanche client initialized');
      if (debug) logger.debug('Avalanche RPC', configObj.chains.avalanche.rpcUrl);
    } catch (e) {
      logger.error('Failed to initialize Avalanche client', e);
    }
  } else {
    logger.warn('Skipping Avalanche client: no PRIVATE_KEY_AVAX and not in mock mode');
  }

  if (configObj.chains.tron.privateKey || configObj.mockMode) {
    try {
      const tronClient = new TronClient(
        configObj.chains.tron.rpcUrl,
        configObj.chains.tron.privateKey
      );
      clients.set('tron', tronClient);
      logger.info('Tron client initialized');
      if (debug) logger.debug('Tron RPC', configObj.chains.tron.rpcUrl);
    } catch (e) {
      logger.error('Failed to initialize Tron client', e);
    }
  } else {
    logger.warn('Skipping Tron client: no PRIVATE_KEY_TRON and not in mock mode');
  }

  return clients;
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
function getActiveIntegrations(configObj: Config): Integration[] {
  const integrations: Integration[] = [];

  if (configObj.chains.tron.privateKey || configObj.mockMode) {
    integrations.push(justlendIntegration, sunswapIntegration);
  } else {
    logger.warn('No Tron integrations activated');
  }

  if (configObj.chains.avalanche.privateKey || configObj.mockMode) {
    integrations.push(gmxIntegration, traderJoeIntegration, sJoeIntegration, benqiIntegration, yieldYakIntegration);
  } else {
    logger.warn('No Avalanche integrations activated');
  }

  return integrations;
}

// ---------------------------------------------------------------------------
// Discovery & Claims
// ---------------------------------------------------------------------------
async function runDiscoveryAndClaims(
  configObj: Config,
  clients: Map<string, ChainClient>,
  integrations: Integration[]
): Promise<void> {
  const db = initDb(configObj.database.path);

  logger.info('Starting discovery and claims cycle...');

  try {
    // Seed wallets (only in mock mode)
    if (configObj.mockMode) {
      const seeds = await seedWallets();
      logger.info(`Found ${seeds.length} seed wallets (mock mode)`);
      for (const wallet of seeds) {
        try {
          upsertWallet(db, wallet);
        } catch (e) {
          logger.warn('Failed to upsert seed wallet', wallet, e);
        }
      }
    } else {
      logger.info('Skipping seed wallet discovery in production mode');
    }

    // Integrations discovery
    const allPendingRewards = [];
    for (const integration of integrations) {
      try {
        logger.info(`Running integration: ${integration.key}`);

        const wallets = await integration.discoverWallets(configObj.mockMode);
        logger.discoveryRun(integration.key, wallets.length, 0);

        if (wallets.length === 0) continue;

        // Filter quarantined
        const activeWallets = wallets.filter(w => !isWalletQuarantined(w));
        if (activeWallets.length < wallets.length) {
            logger.info(`Filtered out ${wallets.length - activeWallets.length} quarantined wallets`);
        }

        const pendingRewards = await integration.getPendingRewards(activeWallets, configObj.mockMode);
        logger.discoveryRun(integration.key, activeWallets.length, pendingRewards.length);

        for (const reward of pendingRewards) {
          try {
            recordPending(db, reward);
          } catch (e) {
            logger.warn('Failed to record pending reward', reward.id, e);
          }
        }

        allPendingRewards.push(...pendingRewards);
      } catch (error) {
        logger.error(`Integration ${integration.key} failed`, error);
      }
    }

    if (allPendingRewards.length === 0) {
      logger.info('No pending rewards found');
      return;
    }

    // Policy filter
    const filteredRewards = allPendingRewards.filter(reward => {
      if (reward.amountUsd < Policy.MIN_ITEM_USD) return false;

      if (reward.lastClaimAt) {
        const daysSinceClaim = (Date.now() - reward.lastClaimAt.getTime()) / 86400000;
        if (daysSinceClaim < Policy.COOLDOWN_DAYS) return false;
      }
      return true;
    });

    logger.info(`Filtered ${allPendingRewards.length} rewards to ${filteredRewards.length} after policy checks`);
    if (filteredRewards.length === 0) return;

    // Normalize claim targets and filter synthetic rewards
    let normalizedRewards = filterSyntheticRewards(filteredRewards, configObj.mockMode);
    normalizedRewards = normalizeClaimTargets(normalizedRewards, configObj.mockMode);
    
    if (normalizedRewards.length !== filteredRewards.length) {
      logger.info(`Normalized ${filteredRewards.length} rewards to ${normalizedRewards.length} after safety filters`);
    }
    if (normalizedRewards.length === 0) return;

    // Bundling
    let bundles = groupByContract(normalizedRewards);
    logger.info(`Created ${bundles.length} initial bundles`);

    bundles = splitLargeBundles(bundles, Policy.MAX_BUNDLE_SIZE);
    bundles = mergeBundles(bundles, Policy.MIN_BUNDLE_SIZE);

    const profitableBundles = bundles.filter(bundle => {
      if (bundle.totalUsd < Policy.MIN_BUNDLE_GROSS_USD) {
        logger.profitabilityCheck(bundle.id, false, `Gross USD ${bundle.totalUsd} < ${Policy.MIN_BUNDLE_GROSS_USD}`);
        return false;
      }
      if (bundle.netUsd < Policy.MIN_BUNDLE_NET_USD) {
        logger.profitabilityCheck(bundle.id, false, `Net USD ${bundle.netUsd} < ${Policy.MIN_BUNDLE_NET_USD}`);
        return false;
      }
      logger.profitabilityCheck(bundle.id, true);
      return true;
    });

    logger.info(`${profitableBundles.length} of ${bundles.length} bundles passed profitability checks`);
    if (profitableBundles.length === 0) return;

    // Execute
    for (const bundle of profitableBundles) {
      try {
        if (shouldSkipIdempotency(bundle)) {
          logger.info(`Skipping bundle ${bundle.id} due to idempotency`);
          continue;
        }

        const simulationResult = await dryRun(bundle, clients);
        if (!simulationResult.ok) {
          logger.warn(`Simulation failed for bundle ${bundle.id}: ${simulationResult.reason}`);
          continue;
        }

        const result = await withExponentialBackoff(
          () => execute(bundle, clients, configObj.mockMode),
            Policy.RETRY_MAX_ATTEMPTS,
            Policy.RETRY_BASE_DELAY_MS,
            `bundle-${bundle.id}`
        );

        recordExecutionResult(db, bundle, result);

        if (result.success) {
          logger.info(`Successfully executed bundle ${bundle.id}: claimed $${result.claimedUsd.toFixed(2)}`);
        } else {
          logger.error(`Bundle execution failed ${bundle.id}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Failed to execute bundle ${bundle.id}`, error);
      }
    }
  } catch (error) {
    logger.error('Discovery and claims cycle failed', error);
    throw error; // Let outer handler catch for fatal logging if needed
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  logger.info('Cross-Protocol Dust Collector Bot starting...');

  const configObj = loadConfig();
  logger.info('Configuration loaded', {
    mockMode: configObj.mockMode,
    dbPath: configObj.database.path
  });

  // Validate recipient configuration for non-mock mode
  try {
    validateClaimRecipients(configObj.mockMode);
    if (!configObj.mockMode) {
      logger.info('✅ Claim recipient validation passed for production mode');
    }
  } catch (error) {
    logger.fatal('❌ Claim recipient validation failed:', error);
    process.exit(1);
  }

  // Validate sJOE integration configuration for non-mock mode
  if (!configObj.mockMode) {
    try {
      const { env } = await import('../config/env.js');
      
      if (!env.traderJoeSJoeStakingAddress) {
        throw new Error('TRADERJOE_SJOE_STAKING_ADDRESS is required for non-mock mode');
      }
      
      if (!env.sJoeToken) {
        throw new Error('SJOE_TOKEN_ADDRESS is required for non-mock mode');
      }
      
      if (!env.joeToken) {
        throw new Error('JOE_TOKEN_ADDRESS is required for non-mock mode');
      }
      
      logger.info('✅ sJOE integration configuration validated for production mode');
    } catch (error) {
      logger.fatal('❌ sJOE integration configuration validation failed:', error);
      process.exit(1);
    }
  }

  // Inject pricing service for payout verification
  injectPricingService({
    quoteToUsd: async (chain, token, amountWei) => {
      if (chain === 'avalanche') {
        return await quoteToUsd(chain, token, amountWei);
      } else {
        // For other chains, placeholder implementation
        console.warn(`Pricing not implemented for chain ${chain}, returning 0`);
        return 0;
      }
    },
    getTokenDecimals
  });

  const db = initDb(configObj.database.path);
  initSchema(db);
  logger.info('Database initialized');

  const clients = createChainClients(configObj);
  logger.info(`Initialized ${clients.size} chain clients`);

  const integrations = getActiveIntegrations(configObj);
  logger.info(`Active integrations: ${integrations.map(i => i.key).join(', ') || '(none)'}`);

  if (integrations.length === 0) {
    logger.fatal('No integrations available. Provide private keys or enable mock mode.');
    process.exit(1);
  }

  // Optional diagnostics
  printStartupDiagnostics({
    dbPath: configObj.database.path,
    clients: Array.from(clients.keys()),
    integrations: integrations.map(i => i.key)
  });

  const scheduler = new Scheduler({
    intervalMs: Policy.SCHEDULE_TICK_INTERVAL_MS,
    jitterMs: Policy.SCHEDULE_JITTER_MS
  });

  await scheduler.loop(async () => {
    try {
      await runDiscoveryAndClaims(configObj, clients, integrations);
    } catch (e) {
      logger.error('Scheduled loop iteration failed', e);
    }
  });

  logger.info('Bot shutdown complete');
}

// Execute if run directly
if (require.main === module) {
  main().catch((error) => {
    logger.fatal('Fatal error in main()', error);
    // eslint-disable-next-line no-console
    console.error('RAW FATAL:', error);
    process.exit(1);
  });
}