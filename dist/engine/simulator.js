"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dryRun = dryRun;
exports.simulateMultiple = simulateMultiple;
exports.aggregateSimulationResults = aggregateSimulationResults;
const logger_js_1 = require("./logger.js");
async function dryRun(bundle, clients) {
    try {
        const client = clients.get(bundle.chain);
        if (!client) {
            return {
                bundleId: bundle.id,
                ok: false,
                reason: `No client configured for chain: ${bundle.chain}`
            };
        }
        logger_js_1.logger.debug(`Simulating bundle ${bundle.id} on ${bundle.chain}`);
        const result = await client.simulate(bundle);
        if (!result.ok) {
            logger_js_1.logger.debug(`Simulation failed for bundle ${bundle.id}: ${result.reason}`);
            return {
                bundleId: bundle.id,
                ...result
            };
        }
        logger_js_1.logger.debug(`Simulation successful for bundle ${bundle.id}`);
        return {
            bundleId: bundle.id,
            ok: true,
            gasEstimate: bundle.estGasUsd
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_js_1.logger.error(`Simulation error for bundle ${bundle.id}:`, errorMessage);
        return {
            bundleId: bundle.id,
            ok: false,
            reason: `Simulation error: ${errorMessage}`
        };
    }
}
async function simulateMultiple(bundles, clients) {
    const results = [];
    // Run simulations in parallel for better performance
    const promises = bundles.map(bundle => dryRun(bundle, clients));
    const simulationResults = await Promise.allSettled(promises);
    for (let i = 0; i < simulationResults.length; i++) {
        const result = simulationResults[i];
        const bundle = bundles[i];
        if (!bundle)
            continue;
        if (result.status === 'fulfilled') {
            results.push(result.value);
        }
        else {
            logger_js_1.logger.error(`Simulation promise rejected for bundle ${bundle.id}:`, result.reason);
            results.push({
                bundleId: bundle.id,
                ok: false,
                reason: `Promise rejection: ${result.reason}`
            });
        }
    }
    return results;
}
function aggregateSimulationResults(results) {
    let successCount = 0;
    let failureCount = 0;
    let totalGasEstimate = 0;
    const failureReasons = [];
    for (const result of results) {
        if (result.ok) {
            successCount++;
            if (result.gasEstimate) {
                totalGasEstimate += result.gasEstimate;
            }
        }
        else {
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
//# sourceMappingURL=simulator.js.map