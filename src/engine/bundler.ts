import { v4 as uuidv4 } from 'uuid';
import type { PendingReward, ClaimBundle } from '../types/common.js';
import { estimateBundleGasUsd } from '../economics/gas.js';

export function groupByContract(items: PendingReward[]): ClaimBundle[] {
  // Group rewards by (chain, protocol, claimTo) as specified in the requirements
  const groups = new Map<string, PendingReward[]>();
  
  for (const item of items) {
    const key = `${item.wallet.chain}:${item.protocol}:${item.claimTo.value}`;
    const existing = groups.get(key);
    
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const bundles: ClaimBundle[] = [];
  
  for (const [key, groupedItems] of groups) {
    const [chain, protocol] = key.split(':');
    const firstItem = groupedItems[0];
    
    if (!firstItem) continue;

    const totalUsd = groupedItems.reduce((sum, item) => sum + item.amountUsd, 0);
    const bundleId = uuidv4();
    
    const bundle: ClaimBundle = {
      id: bundleId,
      chain: firstItem.wallet.chain,
      protocol,
      claimTo: firstItem.claimTo,
      items: groupedItems,
      totalUsd,
      estGasUsd: 0, // Will be set below
      netUsd: 0     // Will be calculated after gas estimation
    };

    // Estimate gas cost for this bundle
    const estGasUsd = estimateBundleGasUsd(bundle, bundle.chain);
    
    // Create final bundle with gas estimation
    const finalBundle: ClaimBundle = {
      ...bundle,
      estGasUsd,
      netUsd: totalUsd - estGasUsd
    };

    bundles.push(finalBundle);
  }

  return bundles;
}

export function splitLargeBundles(bundles: ClaimBundle[], maxSize: number): ClaimBundle[] {
  const result: ClaimBundle[] = [];
  
  for (const bundle of bundles) {
    if (bundle.items.length <= maxSize) {
      result.push(bundle);
      continue;
    }

    // Split bundle into smaller chunks
    const chunks: PendingReward[][] = [];
    for (let i = 0; i < bundle.items.length; i += maxSize) {
      chunks.push(bundle.items.slice(i, i + maxSize));
    }

    for (const chunk of chunks) {
      const totalUsd = chunk.reduce((sum, item) => sum + item.amountUsd, 0);
      const chunkBundleId = uuidv4();
      
      const chunkBundle: ClaimBundle = {
        id: chunkBundleId,
        chain: bundle.chain,
        protocol: bundle.protocol,
        claimTo: bundle.claimTo,
        items: chunk,
        totalUsd,
        estGasUsd: 0,
        netUsd: 0
      };

      const estGasUsd = estimateBundleGasUsd(chunkBundle, chunkBundle.chain);
      
      const finalChunkBundle: ClaimBundle = {
        ...chunkBundle,
        estGasUsd,
        netUsd: totalUsd - estGasUsd
      };

      result.push(finalChunkBundle);
    }
  }

  return result;
}

export function mergeBundles(bundles: ClaimBundle[], minSize: number): ClaimBundle[] {
  // Group small bundles by (chain, protocol, claimTo) for potential merging
  const smallBundles = bundles.filter(bundle => bundle.items.length < minSize);
  const largeBundles = bundles.filter(bundle => bundle.items.length >= minSize);
  
  const mergeGroups = new Map<string, ClaimBundle[]>();
  
  for (const bundle of smallBundles) {
    const key = `${bundle.chain}:${bundle.protocol}:${bundle.claimTo.value}`;
    const existing = mergeGroups.get(key);
    
    if (existing) {
      existing.push(bundle);
    } else {
      mergeGroups.set(key, [bundle]);
    }
  }

  const mergedBundles: ClaimBundle[] = [];
  
  for (const [, groupBundles] of mergeGroups) {
    const allItems = groupBundles.flatMap(bundle => bundle.items);
    
    if (allItems.length >= minSize) {
      // Create merged bundle
      const firstBundle = groupBundles[0];
      if (!firstBundle) continue;
      
      const totalUsd = allItems.reduce((sum, item) => sum + item.amountUsd, 0);
      const mergedBundleId = uuidv4();
      
      const mergedBundle: ClaimBundle = {
        id: mergedBundleId,
        chain: firstBundle.chain,
        protocol: firstBundle.protocol,
        claimTo: firstBundle.claimTo,
        items: allItems,
        totalUsd,
        estGasUsd: 0,
        netUsd: 0
      };

      const estGasUsd = estimateBundleGasUsd(mergedBundle, mergedBundle.chain);
      
      const finalMergedBundle: ClaimBundle = {
        ...mergedBundle,
        estGasUsd,
        netUsd: totalUsd - estGasUsd
      };

      mergedBundles.push(finalMergedBundle);
    } else {
      // Keep as separate small bundles
      mergedBundles.push(...groupBundles);
    }
  }

  return [...largeBundles, ...mergedBundles];
}