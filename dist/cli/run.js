#!/usr/bin/env node
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
const sjoe_js_1 = require("../integrations/traderjoe/sjoe.js");
const benqi_js_1 = require("../integrations/benqi.js");
const yieldyak_js_1 = require("../integrations/yieldyak.js");
const seeds_js_1 = require("../discovery/seeds.js");
const bundler_js_1 = require("../engine/bundler.js");
const simulator_js_1 = require("../engine/simulator.js");
const executor_js_1 = require("../engine/executor.js");
const ledger_js_1 = require("../engine/ledger.js");
const idempotency_js_1 = require("../engine/idempotency.js");
const retry_js_1 = require("../engine/retry.js");
const scheduler_js_1 = require("../engine/scheduler.js");
const logger_js_1 = require("../engine/logger.js");
const policy_js_1 = require("../economics/policy.js");
const addresses_js_1 = require("../config/addresses.js");
const _normalizer_js_1 = require("../integrations/_normalizer.js");
const pricing_js_1 = require("../economics/pricing.js");
const startupDiagnostics_js_1 = require("../engine/startupDiagnostics.js");
// Environment variables
(0, dotenv_1.config)();
// ---------------------------------------------------------------------------
// Global safety handlers
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
    logger_js_1.logger.fatal('Uncaught exception', err);
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger_js_1.logger.fatal('Unhandled rejection', reason);
});
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
    const debug = process.env.DEBUG_STARTUP === 'true';
    if (configObj.chains.avalanche.privateKey || configObj.mockMode) {
        try {
            const avalancheClient = new avalanche_js_1.AvalancheClient(configObj.chains.avalanche.rpcUrl, configObj.chains.avalanche.privateKey);
            clients.set('avalanche', avalancheClient);
            logger_js_1.logger.info('Avalanche client initialized');
            if (debug)
                logger_js_1.logger.debug('Avalanche RPC', configObj.chains.avalanche.rpcUrl);
        }
        catch (e) {
            logger_js_1.logger.error('Failed to initialize Avalanche client', e);
        }
    }
    else {
        logger_js_1.logger.warn('Skipping Avalanche client: no PRIVATE_KEY_AVAX and not in mock mode');
    }
    if (configObj.chains.tron.privateKey || configObj.mockMode) {
        try {
            const tronClient = new tron_js_1.TronClient(configObj.chains.tron.rpcUrl, configObj.chains.tron.privateKey);
            clients.set('tron', tronClient);
            logger_js_1.logger.info('Tron client initialized');
            if (debug)
                logger_js_1.logger.debug('Tron RPC', configObj.chains.tron.rpcUrl);
        }
        catch (e) {
            logger_js_1.logger.error('Failed to initialize Tron client', e);
        }
    }
    else {
        logger_js_1.logger.warn('Skipping Tron client: no PRIVATE_KEY_TRON and not in mock mode');
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
        integrations.push(gmx_js_1.gmxIntegration, traderjoe_js_1.traderJoeIntegration, sjoe_js_1.sJoeIntegration, benqi_js_1.benqiIntegration, yieldyak_js_1.yieldYakIntegration);
    }
    else {
        logger_js_1.logger.warn('No Avalanche integrations activated');
    }
    return integrations;
}
// ---------------------------------------------------------------------------
// Discovery & Claims
// ---------------------------------------------------------------------------
async function runDiscoveryAndClaims(configObj, clients, integrations) {
    const db = (0, db_js_1.initDb)(configObj.database.path);
    logger_js_1.logger.info('Starting discovery and claims cycle...');
    try {
        // Seed wallets (only in mock mode)
        if (configObj.mockMode) {
            const seeds = await (0, seeds_js_1.seedWallets)();
            logger_js_1.logger.info(`Found ${seeds.length} seed wallets (mock mode)`);
            for (const wallet of seeds) {
                try {
                    (0, db_js_1.upsertWallet)(db, wallet);
                }
                catch (e) {
                    logger_js_1.logger.warn('Failed to upsert seed wallet', wallet, e);
                }
            }
        }
        else {
            logger_js_1.logger.info('Skipping seed wallet discovery in production mode');
        }
        // Integrations discovery
        const allPendingRewards = [];
        for (const integration of integrations) {
            try {
                logger_js_1.logger.info(`Running integration: ${integration.key}`);
                const wallets = await integration.discoverWallets(configObj.mockMode);
                logger_js_1.logger.discoveryRun(integration.key, wallets.length, 0);
                if (wallets.length === 0)
                    continue;
                // Filter quarantined
                const activeWallets = wallets.filter(w => !(0, retry_js_1.isWalletQuarantined)(w));
                if (activeWallets.length < wallets.length) {
                    logger_js_1.logger.info(`Filtered out ${wallets.length - activeWallets.length} quarantined wallets`);
                }
                const pendingRewards = await integration.getPendingRewards(activeWallets, configObj.mockMode);
                logger_js_1.logger.discoveryRun(integration.key, activeWallets.length, pendingRewards.length);
                for (const reward of pendingRewards) {
                    try {
                        (0, db_js_1.recordPending)(db, reward);
                    }
                    catch (e) {
                        logger_js_1.logger.warn('Failed to record pending reward', reward.id, e);
                    }
                }
                allPendingRewards.push(...pendingRewards);
            }
            catch (error) {
                logger_js_1.logger.error(`Integration ${integration.key} failed`, error);
            }
        }
        if (allPendingRewards.length === 0) {
            logger_js_1.logger.info('No pending rewards found');
            return;
        }
        // Policy filter
        const filteredRewards = allPendingRewards.filter(reward => {
            if (reward.amountUsd < policy_js_1.Policy.MIN_ITEM_USD)
                return false;
            if (reward.lastClaimAt) {
                const daysSinceClaim = (Date.now() - reward.lastClaimAt.getTime()) / 86400000;
                if (daysSinceClaim < policy_js_1.Policy.COOLDOWN_DAYS)
                    return false;
            }
            return true;
        });
        logger_js_1.logger.info(`Filtered ${allPendingRewards.length} rewards to ${filteredRewards.length} after policy checks`);
        if (filteredRewards.length === 0)
            return;
        // Normalize claim targets and filter synthetic rewards
        let normalizedRewards = (0, _normalizer_js_1.filterSyntheticRewards)(filteredRewards, configObj.mockMode);
        normalizedRewards = (0, _normalizer_js_1.normalizeClaimTargets)(normalizedRewards, configObj.mockMode);
        if (normalizedRewards.length !== filteredRewards.length) {
            logger_js_1.logger.info(`Normalized ${filteredRewards.length} rewards to ${normalizedRewards.length} after safety filters`);
        }
        if (normalizedRewards.length === 0)
            return;
        // Bundling
        let bundles = (0, bundler_js_1.groupByContract)(normalizedRewards);
        logger_js_1.logger.info(`Created ${bundles.length} initial bundles`);
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
        logger_js_1.logger.info(`${profitableBundles.length} of ${bundles.length} bundles passed profitability checks`);
        if (profitableBundles.length === 0)
            return;
        // Execute
        for (const bundle of profitableBundles) {
            try {
                if ((0, idempotency_js_1.shouldSkipIdempotency)(bundle)) {
                    logger_js_1.logger.info(`Skipping bundle ${bundle.id} due to idempotency`);
                    continue;
                }
                const simulationResult = await (0, simulator_js_1.dryRun)(bundle, clients);
                if (!simulationResult.ok) {
                    logger_js_1.logger.warn(`Simulation failed for bundle ${bundle.id}: ${simulationResult.reason}`);
                    continue;
                }
                const result = await (0, retry_js_1.withExponentialBackoff)(() => (0, executor_js_1.execute)(bundle, clients, configObj.mockMode), policy_js_1.Policy.RETRY_MAX_ATTEMPTS, policy_js_1.Policy.RETRY_BASE_DELAY_MS, `bundle-${bundle.id}`);
                (0, ledger_js_1.recordExecutionResult)(db, bundle, result);
                if (result.success) {
                    logger_js_1.logger.info(`Successfully executed bundle ${bundle.id}: claimed $${result.claimedUsd.toFixed(2)}`);
                }
                else {
                    logger_js_1.logger.error(`Bundle execution failed ${bundle.id}: ${result.error}`);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Failed to execute bundle ${bundle.id}`, error);
            }
        }
    }
    catch (error) {
        logger_js_1.logger.error('Discovery and claims cycle failed', error);
        throw error; // Let outer handler catch for fatal logging if needed
    }
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    logger_js_1.logger.info('Cross-Protocol Dust Collector Bot starting...');
    const configObj = loadConfig();
    logger_js_1.logger.info('Configuration loaded', {
        mockMode: configObj.mockMode,
        dbPath: configObj.database.path
    });
    // Validate recipient configuration for non-mock mode
    try {
        (0, addresses_js_1.validateClaimRecipients)(configObj.mockMode);
        if (!configObj.mockMode) {
            logger_js_1.logger.info('✅ Claim recipient validation passed for production mode');
        }
    }
    catch (error) {
        logger_js_1.logger.fatal('❌ Claim recipient validation failed:', error);
        process.exit(1);
    }
    // Validate sJOE integration configuration for non-mock mode
    if (!configObj.mockMode) {
        try {
            const { env } = await Promise.resolve().then(() => __importStar(require('../config/env.js')));
            if (!env.traderJoeSJoeStakingAddress) {
                throw new Error('TRADERJOE_SJOE_STAKING_ADDRESS is required for non-mock mode');
            }
            if (!env.sJoeToken) {
                throw new Error('SJOE_TOKEN_ADDRESS is required for non-mock mode');
            }
            if (!env.joeToken) {
                throw new Error('JOE_TOKEN_ADDRESS is required for non-mock mode');
            }
            logger_js_1.logger.info('✅ sJOE integration configuration validated for production mode');
        }
        catch (error) {
            logger_js_1.logger.fatal('❌ sJOE integration configuration validation failed:', error);
            process.exit(1);
        }
    }
    // Inject pricing service for payout verification
    (0, executor_js_1.injectPricingService)({
        quoteToUsd: async (chain, token, amountWei) => {
            if (chain === 'avalanche') {
                return await (0, pricing_js_1.quoteToUsd)(chain, token, amountWei);
            }
            else {
                // For other chains, placeholder implementation
                console.warn(`Pricing not implemented for chain ${chain}, returning 0`);
                return 0;
            }
        },
        getTokenDecimals: pricing_js_1.getTokenDecimals
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
    const scheduler = new scheduler_js_1.Scheduler({
        intervalMs: policy_js_1.Policy.SCHEDULE_TICK_INTERVAL_MS,
        jitterMs: policy_js_1.Policy.SCHEDULE_JITTER_MS
    });
    await scheduler.loop(async () => {
        try {
            await runDiscoveryAndClaims(configObj, clients, integrations);
        }
        catch (e) {
            logger_js_1.logger.error('Scheduled loop iteration failed', e);
        }
    });
    logger_js_1.logger.info('Bot shutdown complete');
}
// Execute if run directly
if (require.main === module) {
    main().catch((error) => {
        logger_js_1.logger.fatal('Fatal error in main()', error);
        // eslint-disable-next-line no-console
        console.error('RAW FATAL:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=run.js.map