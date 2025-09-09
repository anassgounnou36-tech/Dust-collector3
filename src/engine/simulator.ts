import type { ClaimBundle, ChainClient, SimulationResult } from '../types/common.js';
import { logger } from './logger.js';

export interface BundleSimulationResult extends SimulationResult {
  readonly bundleId: string;
  readonly gasEstimate?: number;
}

export async function dryRun(
  bundle: ClaimBundle, 
  clients: Map<string, ChainClient>
): Promise<BundleSimulationResult> {
  try {
    const client = clients.get(bundle.chain);
    
    if (!client) {
      return {
        bundleId: bundle.id,
        ok: false,
        reason: `No client configured for chain: ${bundle.chain}`
      };
    }

    logger.debug(`Simulating bundle ${bundle.id} on ${bundle.chain}`);
    
    const result = await client.simulate(bundle);
    
    if (!result.ok) {
      logger.debug(`Simulation failed for bundle ${bundle.id}: ${result.reason}`);
      return {
        bundleId: bundle.id,
        ...result
      };
    }

    logger.debug(`Simulation successful for bundle ${bundle.id}`);
    
    return {
      bundleId: bundle.id,
      ok: true,
      gasEstimate: bundle.estGasUsd
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Simulation error for bundle ${bundle.id}:`, errorMessage);
    
    return {
      bundleId: bundle.id,
      ok: false,
      reason: `Simulation error: ${errorMessage}`
    };
  }
}

export async function simulateMultiple(
  bundles: ClaimBundle[], 
  clients: Map<string, ChainClient>
): Promise<BundleSimulationResult[]> {
  const results: BundleSimulationResult[] = [];
  
  // Run simulations in parallel for better performance
  const promises = bundles.map(bundle => dryRun(bundle, clients));
  const simulationResults = await Promise.allSettled(promises);
  
  for (let i = 0; i < simulationResults.length; i++) {
    const result = simulationResults[i];
    const bundle = bundles[i];
    
    if (!bundle) continue;
    
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      logger.error(`Simulation promise rejected for bundle ${bundle.id}:`, result.reason);
      results.push({
        bundleId: bundle.id,
        ok: false,
        reason: `Promise rejection: ${result.reason}`
      });
    }
  }
  
  return results;
}

export function aggregateSimulationResults(results: BundleSimulationResult[]): {
  successCount: number;
  failureCount: number;
  totalGasEstimate: number;
  failureReasons: string[];
} {
  let successCount = 0;
  let failureCount = 0;
  let totalGasEstimate = 0;
  const failureReasons: string[] = [];
  
  for (const result of results) {
    if (result.ok) {
      successCount++;
      if (result.gasEstimate) {
        totalGasEstimate += result.gasEstimate;
      }
    } else {
      failureCount++;
      if (result.reason) {
        failureReasons.push(result.reason);
      }
    }
  }
  
  return {
    successCount,
    failureCount,
    totalGasEstimate,
    failureReasons
  };
}