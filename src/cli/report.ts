#!/usr/bin/env node

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config } from '../types/common.js';
import { initDb } from '../state/db.js';
import { getExecutionSummary } from '../engine/ledger.js';
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatPercentage(ratio: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(ratio);
}

async function generateReport(hoursBack: number = 24): Promise<void> {
  logger.info(`Generating execution report for last ${hoursBack} hours...`);
  
  const config = loadConfig();
  const db = initDb(config.database.path);
  
  try {
    const summary = getExecutionSummary(db, hoursBack);
    
    console.log('\n' + '='.repeat(80));
    console.log(`  CROSS-PROTOCOL DUST COLLECTOR BOT - EXECUTION REPORT`);
    console.log(`  Last ${hoursBack} Hours`);
    console.log('='.repeat(80));
    
    // Overall Summary
    console.log('\n📊 OVERALL SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Executions:      ${summary.totalExecutions.toLocaleString()}`);
    console.log(`✅ Successful:          ${summary.successfulExecutions.toLocaleString()}`);
    console.log(`❌ Failed:              ${summary.failedExecutions.toLocaleString()}`);
    console.log(`Success Rate:          ${formatPercentage(summary.successRate)}`);
    
    // Financial Summary
    console.log('\n💰 FINANCIAL SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Claimed:         ${formatCurrency(summary.totalClaimedUsd)}`);
    console.log(`Total Gas Costs:       ${formatCurrency(summary.totalGasUsd)}`);
    console.log(`Net Profit:            ${formatCurrency(summary.netUsd)}`);
    
    if (summary.totalClaimedUsd > 0) {
      const gasRatio = summary.totalGasUsd / summary.totalClaimedUsd;
      console.log(`Gas Efficiency:        ${formatPercentage(1 - gasRatio)} (${formatPercentage(gasRatio)} gas overhead)`);
    }
    
    // Protocol Breakdown
    if (summary.protocolBreakdown.length > 0) {
      console.log('\n🔗 PROTOCOL BREAKDOWN');
      console.log('-'.repeat(80));
      console.log('Protocol'.padEnd(15) + 'Executions'.padEnd(12) + 'Claimed'.padEnd(12) + 'Gas'.padEnd(12) + 'Net'.padEnd(12) + 'Efficiency');
      console.log('-'.repeat(80));
      
      for (const protocol of summary.protocolBreakdown) {
        const efficiency = protocol.claimedUsd > 0 
          ? 1 - (protocol.gasUsd / protocol.claimedUsd)
          : 0;
        
        console.log(
          protocol.protocol.padEnd(15) +
          protocol.executions.toString().padEnd(12) +
          formatCurrency(protocol.claimedUsd).padEnd(12) +
          formatCurrency(protocol.gasUsd).padEnd(12) +
          formatCurrency(protocol.netUsd).padEnd(12) +
          formatPercentage(efficiency)
        );
      }
    }
    
    // Additional Database Stats
    const additionalStatsQuery = db.prepare(`
      SELECT 
        COUNT(DISTINCT wallet_address || '|' || wallet_chain) as unique_wallets,
        COUNT(*) as total_pending_rewards,
        SUM(CASE WHEN is_stale = FALSE THEN 1 ELSE 0 END) as active_rewards,
        SUM(CASE WHEN is_stale = FALSE THEN amount_usd ELSE 0 END) as active_rewards_usd
      FROM pending_rewards
    `);
    
    const dbStats = additionalStatsQuery.get() as any;
    
    console.log('\n📈 DATABASE STATS');
    console.log('-'.repeat(40));
    console.log(`Unique Wallets:        ${dbStats.unique_wallets?.toLocaleString() || 0}`);
    console.log(`Total Rewards Found:   ${dbStats.total_pending_rewards?.toLocaleString() || 0}`);
    console.log(`Active Rewards:        ${dbStats.active_rewards?.toLocaleString() || 0}`);
    console.log(`Active Rewards Value:  ${formatCurrency(dbStats.active_rewards_usd || 0)}`);
    
    // Recent Activity
    const recentActivityQuery = db.prepare(`
      SELECT 
        executed_at,
        protocol,
        total_usd,
        success,
        tx_hash
      FROM executions 
      WHERE executed_at > datetime('now', '-${hoursBack} hours')
      ORDER BY executed_at DESC
      LIMIT 10
    `);
    
    const recentActivity = recentActivityQuery.all() as any[];
    
    if (recentActivity.length > 0) {
      console.log('\n🕒 RECENT ACTIVITY (Last 10)');
      console.log('-'.repeat(80));
      console.log('Time'.padEnd(20) + 'Protocol'.padEnd(15) + 'Value'.padEnd(12) + 'Status'.padEnd(10) + 'TX Hash');
      console.log('-'.repeat(80));
      
      for (const activity of recentActivity) {
        const time = new Date(activity.executed_at).toLocaleString();
        const status = activity.success ? '✅ Success' : '❌ Failed';
        const txHash = activity.tx_hash ? activity.tx_hash.substring(0, 16) + '...' : 'N/A';
        
        console.log(
          time.padEnd(20) +
          activity.protocol.padEnd(15) +
          formatCurrency(activity.total_usd).padEnd(12) +
          status.padEnd(10) +
          txHash
        );
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`Report generated at: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    logger.error('Failed to generate report:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let hoursBack = 24;
  
  // Parse command line arguments
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10);
    if (!isNaN(parsed) && parsed > 0) {
      hoursBack = parsed;
    } else {
      console.error('Invalid hours argument. Using default of 24 hours.');
    }
  }
  
  await generateReport(hoursBack);
}

// Run the report
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error in report:', error);
    process.exit(1);
  });
}