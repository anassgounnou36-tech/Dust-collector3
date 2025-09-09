#!/usr/bin/env node

/**
 * Single-cycle execution runner
 * Runs one discovery and claims cycle then exits
 */

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
import { benqiIntegration } from '../integrations/benqi.js';
import { yieldYakIntegration } from '../integrations/yieldyak.js';
import { seedWallets } from '../discovery/seeds.js';
import { groupByContract, splitLargeBundles, mergeBundles } from '../engine/bundler.js';
import { dryRun } from '../engine/simulator.js';
import { execute } from '../engine/executor.js';
import { recordExecutionResult } from '../engine/ledger.js';
import { shouldSkipIdempotency } from '../engine/idempotency.js';
import { isWalletQuarantined, withExponentialBackoff } from '../engine/retry.js';
import { logger } from '../engine/logger.js';
import { Policy } from '../economics/policy.js';
import { printStartupDiagnostics } from '../engine/startupDiagnostics.js';
import { env } from '../config/env.js';

// Environment variables
config();

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

  try {
    const avalancheClient = new AvalancheClient(configObj.chains.avalanche.rpcUrl, configObj.chains.avalanche.privateKey);
    clients.set('avalanche', avalancheClient);
  } catch (error) {
    logger.warn('Failed to initialize Avalanche client', error);
  }

  try {
    const tronClient = new TronClient(configObj.chains.tron.rpcUrl, configObj.chains.tron.privateKey);
    clients.set('tron', tronClient);
  } catch (error) {
    logger.warn('Failed to initialize Tron client', error);
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
    integrations.push(gmxIntegration, traderJoeIntegration, benqiIntegration, yieldYakIntegration);
  } else {
    logger.warn('No Avalanche integrations activated');
  }

  return integrations;
}

// ---------------------------------------------------------------------------
// Single Cycle Discovery & Claims
// ---------------------------------------------------------------------------
async function runSingleCycle(
  configObj: Config,
  clients: Map<string, ChainClient>,
  integrations: Integration[],
  db: any
): Promise<void> {
  logger.info('=== Starting Single Discovery & Claims Cycle ===');

  try {
    // Discovery phase
    logger.info('Phase 1: Wallet Discovery');
    const allWallets = await seedWallets();
    
    for (const integration of integrations) {
      try {
        const discoveredWallets = await integration.discoverWallets();
        allWallets.push(...discoveredWallets);
        
        // Store discovered wallets
        for (const wallet of discoveredWallets) {
          await upsertWallet(db, wallet);
        }
      } catch (error) {
        logger.error(`Discovery failed for ${integration.key}`, error);
      }
    }
    
    logger.info(`Discovery complete. Found ${allWallets.length} total wallets`);

    // Reward scanning phase
    logger.info('Phase 2: Reward Scanning');
    const allPendingRewards = [];
    
    for (const integration of integrations) {
      try {
        const integrationWallets = allWallets.filter(w => w.chain === integration.chain);
        const rewards = await integration.getPendingRewards(integrationWallets);
        allPendingRewards.push(...rewards);
        
        // Record pending rewards
        for (const reward of rewards) {
          await recordPending(db, reward);
        }
      } catch (error) {
        logger.error(`Reward scanning failed for ${integration.key}`, error);
      }
    }
    
    logger.info(`Reward scanning complete. Found ${allPendingRewards.length} pending rewards`);

    // Bundling phase
    logger.info('Phase 3: Bundling');
    let bundles = groupByContract(allPendingRewards);
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
    
    logger.info(`Bundling complete. ${profitableBundles.length} profitable bundles ready`);

    // Execution phase
    logger.info('Phase 4: Execution');
    let executed = 0;
    let totalClaimedUsd = 0;

    for (const bundle of profitableBundles) {
      try {
        if (isWalletQuarantined(bundle.claimTo)) {
          logger.warn(`Skipping quarantined wallet ${bundle.claimTo.value}`);
          continue;
        }

        if (shouldSkipIdempotency(bundle)) {
          logger.warn(`Skipping bundle ${bundle.id} due to idempotency`);
          continue;
        }

        const client = clients.get(bundle.chain);
        if (!client) {
          logger.error(`No client available for chain ${bundle.chain}`);
          continue;
        }

        // Simulate first
        const simulation = await dryRun(bundle, clients);
        if (!simulation.ok) {
          logger.warn(`Simulation failed for bundle ${bundle.id}: ${simulation.reason}`);
          continue;
        }

        // Execute
        const result = await withExponentialBackoff(() => execute(bundle, clients), Policy.RETRY_MAX_ATTEMPTS);
        await recordExecutionResult(db, bundle, result);

        if (result.success) {
          logger.info(`✅ Bundle ${bundle.id}: claimed $${result.claimedUsd.toFixed(2)}`);
          executed++;
          totalClaimedUsd += result.claimedUsd;
        } else {
          logger.error(`❌ Bundle ${bundle.id}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Failed to execute bundle ${bundle.id}`, error);
      }
    }
    
    logger.info(`=== Single Cycle Complete ===`);
    logger.info(`Executed: ${executed} bundles`);
    logger.info(`Total claimed: $${totalClaimedUsd.toFixed(2)}`);
    
  } catch (error) {
    logger.error('Single cycle failed', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  logger.info('Cross-Protocol Dust Collector - Single Cycle Mode');
  
  if (env.enableSyntheticGmx) {
    logger.info('🧪 Synthetic GMX mode enabled');
  }
  
  if (env.devLowerThresholds) {
    logger.info('🔧 Development threshold overrides enabled');
  }

  const configObj = loadConfig();
  logger.info('Configuration loaded', {
    mockMode: configObj.mockMode,
    dbPath: configObj.database.path
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

  // Run single cycle
  await runSingleCycle(configObj, clients, integrations, db);
  
  logger.info('Single cycle execution complete - exiting');
  process.exit(0);
}

// Execute if run directly
if (require.main === module) {
  main().catch((error) => {
    logger.fatal('Fatal error in single cycle execution', error);
    // eslint-disable-next-line no-console
    console.error('RAW FATAL:', error);
    process.exit(1);
  });
}