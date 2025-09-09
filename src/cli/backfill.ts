#!/usr/bin/env node

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config, Integration } from '../types/common.js';
import { initDb, initSchema, upsertWallet, recordPending } from '../state/db.js';
import { justlendIntegration } from '../integrations/justlend.js';
import { sunswapIntegration } from '../integrations/sunswap.js';
import { gmxIntegration } from '../integrations/gmx.js';
import { traderJoeIntegration } from '../integrations/traderjoe.js';
import { benqiIntegration } from '../integrations/benqi.js';
import { yieldYakIntegration } from '../integrations/yieldyak.js';
import { seedWallets } from '../discovery/seeds.js';
import { expandNeighbors } from '../discovery/expanders.js';
import { logger } from '../engine/logger.js';

// Load environment variables
config();

function loadConfig(): Config {
  try {
    const configPath = join(__dirname, '../config/config.example.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const baseConfig = JSON.parse(configFile);
    
    // Override with environment variables
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
    logger.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

function getAllIntegrations(): Integration[] {
  return [
    justlendIntegration,
    sunswapIntegration,
    gmxIntegration,
    traderJoeIntegration,
    benqiIntegration,
    yieldYakIntegration
  ];
}

async function runBackfill(): Promise<void> {
  logger.info('Starting backfill process...');
  
  const config = loadConfig();
  const db = initDb(config.database.path);
  initSchema(db);
  
  logger.info('Database initialized for backfill');
  
  try {
    // Get seed wallets
    const seeds = await seedWallets();
    logger.info(`Found ${seeds.length} seed wallets`);
    
    // Expand seed wallets to find more
    const expandedWallets = await expandNeighbors(seeds);
    const allWallets = [...seeds, ...expandedWallets];
    
    logger.info(`Expanded to ${allWallets.length} total wallets`);
    
    // Upsert all wallets into database
    for (const wallet of allWallets) {
      upsertWallet(db, wallet);
    }
    
    logger.info(`Stored ${allWallets.length} wallets in database`);
    
    // Run all integrations to discover pending rewards
    const integrations = getAllIntegrations();
    let totalRewards = 0;
    
    for (const integration of integrations) {
      try {
        logger.info(`Running backfill for integration: ${integration.key}`);
        
        // Get wallets for this chain
        const chainWallets = allWallets.filter(w => w.chain === integration.chain);
        
        if (chainWallets.length === 0) {
          logger.info(`No wallets found for chain ${integration.chain}`);
          continue;
        }
        
        // Discover additional wallets for this integration
        const discoveredWallets = await integration.discoverWallets();
        const uniqueDiscovered = discoveredWallets.filter(dw => 
          !chainWallets.some(cw => cw.value === dw.value && cw.chain === dw.chain)
        );
        
        if (uniqueDiscovered.length > 0) {
          logger.info(`Discovered ${uniqueDiscovered.length} additional wallets for ${integration.key}`);
          
          // Store newly discovered wallets
          for (const wallet of uniqueDiscovered) {
            upsertWallet(db, wallet);
          }
        }
        
        // Combine all wallets for this chain
        const allChainWallets = [...chainWallets, ...uniqueDiscovered];
        
        // Get pending rewards
        const pendingRewards = await integration.getPendingRewards(allChainWallets);
        
        if (pendingRewards.length > 0) {
          // Store pending rewards in database
          for (const reward of pendingRewards) {
            recordPending(db, reward);
          }
          
          totalRewards += pendingRewards.length;
          logger.info(`Found ${pendingRewards.length} pending rewards for ${integration.key}`);
        } else {
          logger.info(`No pending rewards found for ${integration.key}`);
        }
        
      } catch (error) {
        logger.error(`Backfill failed for integration ${integration.key}:`, error);
      }
    }
    
    logger.info(`Backfill complete: discovered ${totalRewards} total pending rewards`);
    
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
    
    const summary = summaryQuery.all() as any[];
    
    if (summary.length > 0) {
      logger.info('Backfill Summary by Protocol:');
      for (const row of summary) {
        logger.info(`  ${row.protocol}: ${row.reward_count} rewards, $${row.total_usd.toFixed(2)} total ($${row.avg_usd.toFixed(2)} avg)`);
      }
    }
    
  } catch (error) {
    logger.error('Backfill process failed:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  logger.info('Cross-Protocol Dust Collector Bot - Backfill Mode');
  
  await runBackfill();
  
  logger.info('Backfill process completed successfully');
  process.exit(0);
}

// Run the backfill
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error in backfill:', error);
    process.exit(1);
  });
}