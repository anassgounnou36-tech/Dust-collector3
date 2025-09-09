import Database from 'better-sqlite3';
import type { ClaimBundle, TxResult } from '../types/common.js';
import { recordExecution, markClaimed, upsertWallet } from '../state/db.js';
import { logger } from './logger.js';

export function recordExecutionResult(
  db: Database.Database,
  bundle: ClaimBundle,
  result: TxResult
): void {
  try {
    // Record the execution in the database
    recordExecution(db, bundle, result);
    
    if (result.success) {
      // Mark all rewards in the bundle as claimed
      const rewardIds = bundle.items.map(item => item.id);
      markClaimed(db, rewardIds);
      
      // Update wallet last claim timestamps
      const uniqueWallets = new Set();
      for (const item of bundle.items) {
        const walletKey = `${item.wallet.chain}:${item.wallet.value}`;
        if (!uniqueWallets.has(walletKey)) {
          uniqueWallets.add(walletKey);
          updateWalletLastClaim(db, item.wallet, new Date());
        }
      }
      
      logger.info(`Successfully recorded execution for bundle ${bundle.id} with ${bundle.items.length} items`);
    } else {
      logger.warn(`Recorded failed execution for bundle ${bundle.id}: ${result.error}`);
    }
  } catch (error) {
    logger.error(`Failed to record execution for bundle ${bundle.id}:`, error);
    throw error;
  }
}

export function updateWalletStats(
  db: Database.Database,
  walletAddress: string,
  walletChain: string,
  claimedUsd: number
): void {
  try {
    const stmt = db.prepare(`
      UPDATE wallets 
      SET total_claimed_usd = total_claimed_usd + ?
      WHERE address = ? AND chain = ?
    `);
    
    stmt.run(claimedUsd, walletAddress, walletChain);
  } catch (error) {
    logger.error(`Failed to update wallet stats for ${walletAddress}:`, error);
  }
}

function updateWalletLastClaim(
  db: Database.Database,
  wallet: { value: string; chain: string },
  claimedAt: Date
): void {
  try {
    // Ensure wallet exists
    upsertWallet(db, wallet as any);
    
    const stmt = db.prepare(`
      UPDATE wallets 
      SET last_claim_at = ?
      WHERE address = ? AND chain = ?
    `);
    
    stmt.run(claimedAt.toISOString(), wallet.value, wallet.chain);
  } catch (error) {
    logger.error(`Failed to update last claim time for wallet ${wallet.value}:`, error);
  }
}

export function getExecutionSummary(db: Database.Database, hoursBack: number = 24): {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalClaimedUsd: number;
  totalGasUsd: number;
  netUsd: number;
  successRate: number;
  protocolBreakdown: Array<{
    protocol: string;
    executions: number;
    claimedUsd: number;
    gasUsd: number;
    netUsd: number;
  }>;
} {
  try {
    // Get overall stats
    const overallStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_executions,
        SUM(CASE WHEN success = 1 THEN COALESCE(actual_claimed_usd, total_usd) ELSE 0 END) as total_claimed_usd,
        SUM(CASE WHEN success = 1 THEN COALESCE(actual_gas_usd, est_gas_usd) ELSE 0 END) as total_gas_usd
      FROM executions 
      WHERE executed_at > datetime('now', '-${hoursBack} hours')
    `);
    
    const overall = overallStmt.get() as any;
    
    // Get protocol breakdown
    const protocolStmt = db.prepare(`
      SELECT 
        protocol,
        COUNT(*) as executions,
        SUM(CASE WHEN success = 1 THEN COALESCE(actual_claimed_usd, total_usd) ELSE 0 END) as claimed_usd,
        SUM(CASE WHEN success = 1 THEN COALESCE(actual_gas_usd, est_gas_usd) ELSE 0 END) as gas_usd
      FROM executions 
      WHERE executed_at > datetime('now', '-${hoursBack} hours')
      GROUP BY protocol
      ORDER BY claimed_usd DESC
    `);
    
    const protocolData = protocolStmt.all() as any[];
    
    const protocolBreakdown = protocolData.map(row => ({
      protocol: row.protocol,
      executions: row.executions,
      claimedUsd: row.claimed_usd || 0,
      gasUsd: row.gas_usd || 0,
      netUsd: (row.claimed_usd || 0) - (row.gas_usd || 0)
    }));
    
    const totalClaimedUsd = overall.total_claimed_usd || 0;
    const totalGasUsd = overall.total_gas_usd || 0;
    const netUsd = totalClaimedUsd - totalGasUsd;
    const successRate = overall.total_executions > 0 
      ? overall.successful_executions / overall.total_executions 
      : 0;
    
    return {
      totalExecutions: overall.total_executions || 0,
      successfulExecutions: overall.successful_executions || 0,
      failedExecutions: overall.failed_executions || 0,
      totalClaimedUsd,
      totalGasUsd,
      netUsd,
      successRate,
      protocolBreakdown
    };
  } catch (error) {
    logger.error('Failed to get execution summary:', error);
    throw error;
  }
}

export function updateBundleGasActuals(
  db: Database.Database,
  bundleId: string,
  actualGasUsd: number,
  actualClaimedUsd: number
): void {
  try {
    const stmt = db.prepare(`
      UPDATE executions 
      SET actual_gas_usd = ?, actual_claimed_usd = ?
      WHERE bundle_id = ?
    `);
    
    stmt.run(actualGasUsd, actualClaimedUsd, bundleId);
    logger.debug(`Updated gas actuals for bundle ${bundleId}: gas=${actualGasUsd}, claimed=${actualClaimedUsd}`);
  } catch (error) {
    logger.error(`Failed to update gas actuals for bundle ${bundleId}:`, error);
  }
}