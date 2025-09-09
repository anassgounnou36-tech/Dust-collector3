#!/usr/bin/env node
"use strict";
/**
 * Single-cycle execution runner
 * Runs one discovery and claims cycle then exits
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const fs_1 = require("fs");
const path_1 = require("path");
const db_js_1 = require("../state/db.js");
const avalanche_js_1 = require("../chains/avalanche.js");
const tron_js_1 = require("../chains/tron.js");
const justlend_js_1 = require("../integrations/justlend.js");
const sunswap_js_1 = require("../integrations/sunswap.js");
const gmx_js_1 = require("../integrations/gmx.js");
const traderjoe_js_1 = require("../integrations/traderjoe.js");
const benqi_js_1 = require("../integrations/benqi.js");
const yieldyak_js_1 = require("../integrations/yieldyak.js");
const seeds_js_1 = require("../discovery/seeds.js");
const bundler_js_1 = require("../engine/bundler.js");
const simulator_js_1 = require("../engine/simulator.js");
const executor_js_1 = require("../engine/executor.js");
const ledger_js_1 = require("../engine/ledger.js");
const idempotency_js_1 = require("../engine/idempotency.js");
const retry_js_1 = require("../engine/retry.js");
const logger_js_1 = require("../engine/logger.js");
const policy_js_1 = require("../economics/policy.js");
const startupDiagnostics_js_1 = require("../engine/startupDiagnostics.js");
const env_js_1 = require("../config/env.js");
// Environment variables
(0, dotenv_1.config)();
// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------
function loadConfig() {
    try {
        const configPath = (0, path_1.join)(__dirname, '../config/config.example.json');
        const configFile = (0, fs_1.readFileSync)(configPath, 'utf-8');
        const baseConfig = JSON.parse(configFile);
        const envConfig = {
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
    }
    catch (error) {
        logger_js_1.logger.fatal('Failed to load configuration file', error);
        process.exit(1);
    }
}
// ---------------------------------------------------------------------------
// Chain clients
// ---------------------------------------------------------------------------
function createChainClients(configObj) {
    const clients = new Map();
    try {
        const avalancheClient = new avalanche_js_1.AvalancheClient(configObj.chains.avalanche.rpcUrl, configObj.chains.avalanche.privateKey);
        clients.set('avalanche', avalancheClient);
    }
    catch (error) {
        logger_js_1.logger.warn('Failed to initialize Avalanche client', error);
    }
    try {
        const tronClient = new tron_js_1.TronClient(configObj.chains.tron.rpcUrl, configObj.chains.tron.privateKey);
        clients.set('tron', tronClient);
    }
    catch (error) {
        logger_js_1.logger.warn('Failed to initialize Tron client', error);
    }
    return clients;
}
// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
function getActiveIntegrations(configObj) {
    const integrations = [];
    if (configObj.chains.tron.privateKey || configObj.mockMode) {
        integrations.push(justlend_js_1.justlendIntegration, sunswap_js_1.sunswapIntegration);
    }
    else {
        logger_js_1.logger.warn('No Tron integrations activated');
    }
    if (configObj.chains.avalanche.privateKey || configObj.mockMode) {
        integrations.push(gmx_js_1.gmxIntegration, traderjoe_js_1.traderJoeIntegration, benqi_js_1.benqiIntegration, yieldyak_js_1.yieldYakIntegration);
    }
    else {
        logger_js_1.logger.warn('No Avalanche integrations activated');
    }
    return integrations;
}
// ---------------------------------------------------------------------------
// Single Cycle Discovery & Claims
// ---------------------------------------------------------------------------
async function runSingleCycle(configObj, clients, integrations, db) {
    logger_js_1.logger.info('=== Starting Single Discovery & Claims Cycle ===');
    try {
        // Discovery phase
        logger_js_1.logger.info('Phase 1: Wallet Discovery');
        const allWallets = await (0, seeds_js_1.seedWallets)();
        for (const integration of integrations) {
            try {
                const discoveredWallets = await integration.discoverWallets();
                allWallets.push(...discoveredWallets);
                // Store discovered wallets
                for (const wallet of discoveredWallets) {
                    await (0, db_js_1.upsertWallet)(db, wallet);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Discovery failed for ${integration.key}`, error);
            }
        }
        logger_js_1.logger.info(`Discovery complete. Found ${allWallets.length} total wallets`);
        // Reward scanning phase
        logger_js_1.logger.info('Phase 2: Reward Scanning');
        const allPendingRewards = [];
        for (const integration of integrations) {
            try {
                const integrationWallets = allWallets.filter(w => w.chain === integration.chain);
                const rewards = await integration.getPendingRewards(integrationWallets);
                allPendingRewards.push(...rewards);
                // Record pending rewards
                for (const reward of rewards) {
                    await (0, db_js_1.recordPending)(db, reward);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Reward scanning failed for ${integration.key}`, error);
            }
        }
        logger_js_1.logger.info(`Reward scanning complete. Found ${allPendingRewards.length} pending rewards`);
        // Bundling phase
        logger_js_1.logger.info('Phase 3: Bundling');
        let bundles = (0, bundler_js_1.groupByContract)(allPendingRewards);
        bundles = (0, bundler_js_1.splitLargeBundles)(bundles, policy_js_1.Policy.MAX_BUNDLE_SIZE);
        bundles = (0, bundler_js_1.mergeBundles)(bundles, policy_js_1.Policy.MIN_BUNDLE_SIZE);
        const profitableBundles = bundles.filter(bundle => {
            if (bundle.totalUsd < policy_js_1.Policy.MIN_BUNDLE_GROSS_USD) {
                logger_js_1.logger.profitabilityCheck(bundle.id, false, `Gross USD ${bundle.totalUsd} < ${policy_js_1.Policy.MIN_BUNDLE_GROSS_USD}`);
                return false;
            }
            if (bundle.netUsd < policy_js_1.Policy.MIN_BUNDLE_NET_USD) {
                logger_js_1.logger.profitabilityCheck(bundle.id, false, `Net USD ${bundle.netUsd} < ${policy_js_1.Policy.MIN_BUNDLE_NET_USD}`);
                return false;
            }
            logger_js_1.logger.profitabilityCheck(bundle.id, true);
            return true;
        });
        logger_js_1.logger.info(`Bundling complete. ${profitableBundles.length} profitable bundles ready`);
        // Execution phase
        logger_js_1.logger.info('Phase 4: Execution');
        let executed = 0;
        let totalClaimedUsd = 0;
        for (const bundle of profitableBundles) {
            try {
                if ((0, retry_js_1.isWalletQuarantined)(bundle.claimTo)) {
                    logger_js_1.logger.warn(`Skipping quarantined wallet ${bundle.claimTo.value}`);
                    continue;
                }
                if ((0, idempotency_js_1.shouldSkipIdempotency)(bundle)) {
                    logger_js_1.logger.warn(`Skipping bundle ${bundle.id} due to idempotency`);
                    continue;
                }
                const client = clients.get(bundle.chain);
                if (!client) {
                    logger_js_1.logger.error(`No client available for chain ${bundle.chain}`);
                    continue;
                }
                // Simulate first
                const simulation = await (0, simulator_js_1.dryRun)(bundle, clients);
                if (!simulation.ok) {
                    logger_js_1.logger.warn(`Simulation failed for bundle ${bundle.id}: ${simulation.reason}`);
                    continue;
                }
                // Execute
                const result = await (0, retry_js_1.withExponentialBackoff)(() => (0, executor_js_1.execute)(bundle, clients), policy_js_1.Policy.RETRY_MAX_ATTEMPTS);
                await (0, ledger_js_1.recordExecutionResult)(db, bundle, result);
                if (result.success) {
                    logger_js_1.logger.info(`✅ Bundle ${bundle.id}: claimed $${result.claimedUsd.toFixed(2)}`);
                    executed++;
                    totalClaimedUsd += result.claimedUsd;
                }
                else {
                    logger_js_1.logger.error(`❌ Bundle ${bundle.id}: ${result.error}`);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Failed to execute bundle ${bundle.id}`, error);
            }
        }
        logger_js_1.logger.info(`=== Single Cycle Complete ===`);
        logger_js_1.logger.info(`Executed: ${executed} bundles`);
        logger_js_1.logger.info(`Total claimed: $${totalClaimedUsd.toFixed(2)}`);
    }
    catch (error) {
        logger_js_1.logger.error('Single cycle failed', error);
        throw error;
    }
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    logger_js_1.logger.info('Cross-Protocol Dust Collector - Single Cycle Mode');
    if (env_js_1.env.enableSyntheticGmx) {
        logger_js_1.logger.info('🧪 Synthetic GMX mode enabled');
    }
    if (env_js_1.env.devLowerThresholds) {
        logger_js_1.logger.info('🔧 Development threshold overrides enabled');
    }
    const configObj = loadConfig();
    logger_js_1.logger.info('Configuration loaded', {
        mockMode: configObj.mockMode,
        dbPath: configObj.database.path
    });
    const db = (0, db_js_1.initDb)(configObj.database.path);
    (0, db_js_1.initSchema)(db);
    logger_js_1.logger.info('Database initialized');
    const clients = createChainClients(configObj);
    logger_js_1.logger.info(`Initialized ${clients.size} chain clients`);
    const integrations = getActiveIntegrations(configObj);
    logger_js_1.logger.info(`Active integrations: ${integrations.map(i => i.key).join(', ') || '(none)'}`);
    if (integrations.length === 0) {
        logger_js_1.logger.fatal('No integrations available. Provide private keys or enable mock mode.');
        process.exit(1);
    }
    // Optional diagnostics
    (0, startupDiagnostics_js_1.printStartupDiagnostics)({
        dbPath: configObj.database.path,
        clients: Array.from(clients.keys()),
        integrations: integrations.map(i => i.key)
    });
    // Run single cycle
    await runSingleCycle(configObj, clients, integrations, db);
    logger_js_1.logger.info('Single cycle execution complete - exiting');
    process.exit(0);
}
// Execute if run directly
if (require.main === module) {
    main().catch((error) => {
        logger_js_1.logger.fatal('Fatal error in single cycle execution', error);
        // eslint-disable-next-line no-console
        console.error('RAW FATAL:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=single-cycle.js.map