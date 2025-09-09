#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const fs_1 = require("fs");
const path_1 = require("path");
const db_js_1 = require("../state/db.js");
const justlend_js_1 = require("../integrations/justlend.js");
const sunswap_js_1 = require("../integrations/sunswap.js");
const gmx_js_1 = require("../integrations/gmx.js");
const traderjoe_js_1 = require("../integrations/traderjoe.js");
const benqi_js_1 = require("../integrations/benqi.js");
const yieldyak_js_1 = require("../integrations/yieldyak.js");
const seeds_js_1 = require("../discovery/seeds.js");
const expanders_js_1 = require("../discovery/expanders.js");
const logger_js_1 = require("../engine/logger.js");
// Load environment variables
(0, dotenv_1.config)();
function loadConfig() {
    try {
        const configPath = (0, path_1.join)(__dirname, '../config/config.example.json');
        const configFile = (0, fs_1.readFileSync)(configPath, 'utf-8');
        const baseConfig = JSON.parse(configFile);
        // Override with environment variables
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
        logger_js_1.logger.error('Failed to load configuration:', error);
        process.exit(1);
    }
}
function getAllIntegrations() {
    return [
        justlend_js_1.justlendIntegration,
        sunswap_js_1.sunswapIntegration,
        gmx_js_1.gmxIntegration,
        traderjoe_js_1.traderJoeIntegration,
        benqi_js_1.benqiIntegration,
        yieldyak_js_1.yieldYakIntegration
    ];
}
async function runBackfill() {
    logger_js_1.logger.info('Starting backfill process...');
    const config = loadConfig();
    const db = (0, db_js_1.initDb)(config.database.path);
    (0, db_js_1.initSchema)(db);
    logger_js_1.logger.info('Database initialized for backfill');
    try {
        // Get seed wallets
        const seeds = await (0, seeds_js_1.seedWallets)();
        logger_js_1.logger.info(`Found ${seeds.length} seed wallets`);
        // Expand seed wallets to find more
        const expandedWallets = await (0, expanders_js_1.expandNeighbors)(seeds);
        const allWallets = [...seeds, ...expandedWallets];
        logger_js_1.logger.info(`Expanded to ${allWallets.length} total wallets`);
        // Upsert all wallets into database
        for (const wallet of allWallets) {
            (0, db_js_1.upsertWallet)(db, wallet);
        }
        logger_js_1.logger.info(`Stored ${allWallets.length} wallets in database`);
        // Run all integrations to discover pending rewards
        const integrations = getAllIntegrations();
        let totalRewards = 0;
        for (const integration of integrations) {
            try {
                logger_js_1.logger.info(`Running backfill for integration: ${integration.key}`);
                // Get wallets for this chain
                const chainWallets = allWallets.filter(w => w.chain === integration.chain);
                if (chainWallets.length === 0) {
                    logger_js_1.logger.info(`No wallets found for chain ${integration.chain}`);
                    continue;
                }
                // Discover additional wallets for this integration
                const discoveredWallets = await integration.discoverWallets();
                const uniqueDiscovered = discoveredWallets.filter(dw => !chainWallets.some(cw => cw.value === dw.value && cw.chain === dw.chain));
                if (uniqueDiscovered.length > 0) {
                    logger_js_1.logger.info(`Discovered ${uniqueDiscovered.length} additional wallets for ${integration.key}`);
                    // Store newly discovered wallets
                    for (const wallet of uniqueDiscovered) {
                        (0, db_js_1.upsertWallet)(db, wallet);
                    }
                }
                // Combine all wallets for this chain
                const allChainWallets = [...chainWallets, ...uniqueDiscovered];
                // Get pending rewards
                const pendingRewards = await integration.getPendingRewards(allChainWallets);
                if (pendingRewards.length > 0) {
                    // Store pending rewards in database
                    for (const reward of pendingRewards) {
                        (0, db_js_1.recordPending)(db, reward);
                    }
                    totalRewards += pendingRewards.length;
                    logger_js_1.logger.info(`Found ${pendingRewards.length} pending rewards for ${integration.key}`);
                }
                else {
                    logger_js_1.logger.info(`No pending rewards found for ${integration.key}`);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Backfill failed for integration ${integration.key}:`, error);
            }
        }
        logger_js_1.logger.info(`Backfill complete: discovered ${totalRewards} total pending rewards`);
        // Summary stats
        const summaryQuery = db.prepare(`
      SELECT 
        protocol,
        COUNT(*) as reward_count,
        SUM(amount_usd) as total_usd,
        AVG(amount_usd) as avg_usd
      FROM pending_rewards 
      WHERE is_stale = FALSE
      GROUP BY protocol
      ORDER BY total_usd DESC
    `);
        const summary = summaryQuery.all();
        if (summary.length > 0) {
            logger_js_1.logger.info('Backfill Summary by Protocol:');
            for (const row of summary) {
                logger_js_1.logger.info(`  ${row.protocol}: ${row.reward_count} rewards, $${row.total_usd.toFixed(2)} total ($${row.avg_usd.toFixed(2)} avg)`);
            }
        }
    }
    catch (error) {
        logger_js_1.logger.error('Backfill process failed:', error);
        process.exit(1);
    }
}
async function main() {
    logger_js_1.logger.info('Cross-Protocol Dust Collector Bot - Backfill Mode');
    await runBackfill();
    logger_js_1.logger.info('Backfill process completed successfully');
    process.exit(0);
}
// Run the backfill
if (require.main === module) {
    main().catch((error) => {
        logger_js_1.logger.error('Fatal error in backfill:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=backfill.js.map