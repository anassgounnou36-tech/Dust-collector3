"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupByContract = groupByContract;
exports.splitLargeBundles = splitLargeBundles;
exports.mergeBundles = mergeBundles;
const uuid_1 = require("uuid");
const gas_js_1 = require("../economics/gas.js");
function groupByContract(items) {
    // Group rewards by (chain, protocol, claimTo) as specified in the requirements
    const groups = new Map();
    for (const item of items) {
        const key = `${item.wallet.chain}:${item.protocol}:${item.claimTo.value}`;
        const existing = groups.get(key);
        if (existing) {
            existing.push(item);
        }
        else {
            groups.set(key, [item]);
        }
    }
    const bundles = [];
    for (const [key, groupedItems] of groups) {
        const [chain, protocol] = key.split(':');
        const firstItem = groupedItems[0];
        if (!firstItem)
            continue;
        const totalUsd = groupedItems.reduce((sum, item) => sum + item.amountUsd, 0);
        const bundleId = (0, uuid_1.v4)();
        const bundle = {
            id: bundleId,
            chain: firstItem.wallet.chain,
            protocol,
            claimTo: firstItem.claimTo,
            items: groupedItems,
            totalUsd,
            estGasUsd: 0, // Will be set below
            netUsd: 0 // Will be calculated after gas estimation
        };
        // Estimate gas cost for this bundle
        const estGasUsd = (0, gas_js_1.estimateBundleGasUsd)(bundle, bundle.chain);
        // Create final bundle with gas estimation
        const finalBundle = {
            ...bundle,
            estGasUsd,
            netUsd: totalUsd - estGasUsd
        };
        bundles.push(finalBundle);
    }
    return bundles;
}
function splitLargeBundles(bundles, maxSize) {
    const result = [];
    for (const bundle of bundles) {
        if (bundle.items.length <= maxSize) {
            result.push(bundle);
            continue;
        }
        // Split bundle into smaller chunks
        const chunks = [];
        for (let i = 0; i < bundle.items.length; i += maxSize) {
            chunks.push(bundle.items.slice(i, i + maxSize));
        }
        for (const chunk of chunks) {
            const totalUsd = chunk.reduce((sum, item) => sum + item.amountUsd, 0);
            const chunkBundleId = (0, uuid_1.v4)();
            const chunkBundle = {
                id: chunkBundleId,
                chain: bundle.chain,
                protocol: bundle.protocol,
                claimTo: bundle.claimTo,
                items: chunk,
                totalUsd,
                estGasUsd: 0,
                netUsd: 0
            };
            const estGasUsd = (0, gas_js_1.estimateBundleGasUsd)(chunkBundle, chunkBundle.chain);
            const finalChunkBundle = {
                ...chunkBundle,
                estGasUsd,
                netUsd: totalUsd - estGasUsd
            };
            result.push(finalChunkBundle);
        }
    }
    return result;
}
function mergeBundles(bundles, minSize) {
    // Group small bundles by (chain, protocol, claimTo) for potential merging
    const smallBundles = bundles.filter(bundle => bundle.items.length < minSize);
    const largeBundles = bundles.filter(bundle => bundle.items.length >= minSize);
    const mergeGroups = new Map();
    for (const bundle of smallBundles) {
        const key = `${bundle.chain}:${bundle.protocol}:${bundle.claimTo.value}`;
        const existing = mergeGroups.get(key);
        if (existing) {
            existing.push(bundle);
        }
        else {
            mergeGroups.set(key, [bundle]);
        }
    }
    const mergedBundles = [];
    for (const [, groupBundles] of mergeGroups) {
        const allItems = groupBundles.flatMap(bundle => bundle.items);
        if (allItems.length >= minSize) {
            // Create merged bundle
            const firstBundle = groupBundles[0];
            if (!firstBundle)
                continue;
            const totalUsd = allItems.reduce((sum, item) => sum + item.amountUsd, 0);
            const mergedBundleId = (0, uuid_1.v4)();
            const mergedBundle = {
                id: mergedBundleId,
                chain: firstBundle.chain,
                protocol: firstBundle.protocol,
                claimTo: firstBundle.claimTo,
                items: allItems,
                totalUsd,
                estGasUsd: 0,
                netUsd: 0
            };
            const estGasUsd = (0, gas_js_1.estimateBundleGasUsd)(mergedBundle, mergedBundle.chain);
            const finalMergedBundle = {
                ...mergedBundle,
                estGasUsd,
                netUsd: totalUsd - estGasUsd
            };
            mergedBundles.push(finalMergedBundle);
        }
        else {
            // Keep as separate small bundles
            mergedBundles.push(...groupBundles);
        }
    }
    return [...largeBundles, ...mergedBundles];
}
//# sourceMappingURL=bundler.js.map