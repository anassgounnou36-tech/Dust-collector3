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
exports.injectPricingService = injectPricingService;
exports.execute = execute;
exports.executeSequential = executeSequential;
exports.executeBatch = executeBatch;
exports.aggregateExecutionResults = aggregateExecutionResults;
const logger_js_1 = require("./logger.js");
const addresses_js_1 = require("../config/addresses.js");
const verifyPayout_js_1 = require("./verifyPayout.js");
// Global pricing service instance for injection
let pricingService;
/**
 * Inject pricing service for payout verification and gas calculations
 */
function injectPricingService(service) {
    pricingService = service;
    logger_js_1.logger.info('Pricing service injected for payout verification');
}
/**
 * Enhanced recipient validation with strict checks for non-mock mode
 */
async function validateRecipient(bundle, client, mockMode) {
    if (mockMode) {
        return; // No validation in mock mode
    }
    // Check for placeholder addresses
    if ((0, addresses_js_1.isPlaceholderAddress)(bundle.claimTo)) {
        throw new Error(`Cannot execute bundle with placeholder recipient ${bundle.claimTo.value} in non-mock mode`);
    }
    // Check for seed/test address patterns
    if ((0, addresses_js_1.looksLikeSeedOrTestAddress)(bundle.claimTo)) {
        throw new Error(`Cannot execute bundle with seed/test recipient ${bundle.claimTo.value} in non-mock mode`);
    }
    // Check allowlist for non-mock mode
    if (!(0, addresses_js_1.isAllowedRecipientNonMock)(bundle.claimTo)) {
        throw new Error(`Recipient ${bundle.claimTo.value} not allowed in non-mock mode`);
    }
}
/**
 * Validate contract destination has bytecode (not EOA) for non-mock mode
 */
async function validateContractDestination(contractAddress, client, mockMode) {
    if (mockMode || !client || !client.getCode) {
        return; // Skip validation in mock mode, if no client, or if getCode not available
    }
    try {
        // Get contract bytecode
        const code = await client.getCode(contractAddress);
        if (!code || code === '0x' || code === '0x0') {
            throw new Error(`EOA_DESTINATION_BLOCKED: ${contractAddress} has no bytecode`);
        }
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('EOA_DESTINATION_BLOCKED')) {
            throw error; // Re-throw our specific error
        }
        // For other errors (like network issues), log warning but don't fail
        logger_js_1.logger.warn(`Could not verify contract bytecode for ${contractAddress}:`, error);
    }
}
async function execute(bundle, clients, mockMode = false) {
    try {
        const client = clients.get(bundle.chain);
        if (!client) {
            const error = `No client configured for chain: ${bundle.chain}`;
            logger_js_1.logger.error(`Execution failed for bundle ${bundle.id}: ${error}`);
            return {
                success: false,
                error,
                claimedUsd: 0,
                chain: bundle.chain,
                verifiedPayout: false
            };
        }
        // Validate recipient before execution
        await validateRecipient(bundle, client, mockMode);
        // Validate contract destination for sJOE bundles
        if (bundle.protocol === 'traderjoe' && !mockMode) {
            const { env } = await Promise.resolve().then(() => __importStar(require('../config/env.js')));
            if (env.traderJoeSJoeStakingAddress) {
                await validateContractDestination(env.traderJoeSJoeStakingAddress, client, mockMode);
            }
        }
        logger_js_1.logger.info(`Executing bundle ${bundle.id} with ${bundle.items.length} items worth $${bundle.totalUsd.toFixed(2)}`);
        const result = await client.sendRaw(bundle);
        // Post-execution payout verification
        let verifiedResult = result;
        if (result.success && result.txHash) {
            verifiedResult = await performPayoutVerification(result, bundle, mockMode);
        }
        if (verifiedResult.success) {
            logger_js_1.logger.bundleExecuted(bundle.id, true, verifiedResult.txHash);
            // Enhanced profit summary for sJOE claims
            if (bundle.protocol === 'traderjoe' && verifiedResult.txHash) {
                const claimedUsd = verifiedResult.claimedUsd || bundle.totalUsd;
                const gasUsd = verifiedResult.gasUsd || bundle.estGasUsd;
                const netUsd = claimedUsd - gasUsd;
                const verified = verifiedResult.verifiedPayout === true;
                logger_js_1.logger.verifiedPayoutSummary('sJOE', claimedUsd, gasUsd, netUsd, verifiedResult.txHash, verified);
            }
        }
        else {
            logger_js_1.logger.bundleExecuted(bundle.id, false, undefined, verifiedResult.error);
        }
        return verifiedResult;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_js_1.logger.error(`Execution error for bundle ${bundle.id}:`, errorMessage);
        return {
            success: false,
            error: `Execution error: ${errorMessage}`,
            claimedUsd: 0,
            chain: bundle.chain,
            verifiedPayout: false
        };
    }
}
/**
 * Perform post-execution payout verification
 */
async function performPayoutVerification(result, bundle, mockMode) {
    try {
        // In mock mode, skip verification but still set verified flag
        if (mockMode) {
            return {
                ...result,
                verifiedPayout: true
            };
        }
        // Get transaction receipt (this would need to be implemented per chain)
        // For now, we'll simulate this since we don't have the full receipt structure
        const txReceipt = await getTransactionReceipt(result.txHash, result.chain);
        if (!txReceipt || !txReceipt.logs) {
            logger_js_1.logger.warn(`Could not get transaction receipt for ${result.txHash}`);
            return {
                ...result,
                verifiedPayout: false,
                error: result.error || 'Could not verify payout - no transaction receipt'
            };
        }
        // Verify transfers to expected recipient
        const verification = await (0, verifyPayout_js_1.verifyPayout)(result.txHash, txReceipt.logs, bundle.claimTo, pricingService);
        if (!verification.verified) {
            // In non-mock mode, fail if no verified payout
            return {
                ...result,
                success: false,
                verifiedPayout: false,
                error: verification.error || 'NO_VERIFIED_PAYOUT'
            };
        }
        // Calculate gas cost in USD
        let gasUsd = result.gasUsd || 0;
        if (result.gasUsed && pricingService) {
            try {
                // This is simplified - real implementation would get gas price and native token price
                gasUsd = await calculateGasUsd(result.gasUsed, result.chain, pricingService);
            }
            catch (error) {
                logger_js_1.logger.warn(`Failed to calculate gas USD for ${result.txHash}:`, error);
            }
        }
        // Return enhanced result with verified payout data
        return {
            ...result,
            claimedUsd: verification.totalUsd, // Use actual verified amount
            gasUsd,
            verifiedPayout: true
        };
    }
    catch (error) {
        logger_js_1.logger.error(`Payout verification failed for ${result.txHash}:`, error);
        return {
            ...result,
            verifiedPayout: false,
            error: result.error || `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
/**
 * Get transaction receipt for different chains
 */
async function getTransactionReceipt(txHash, chain) {
    try {
        if (chain === 'avalanche') {
            // Use ethers to get transaction receipt
            const { ethers } = await Promise.resolve().then(() => __importStar(require('ethers')));
            const { env } = await Promise.resolve().then(() => __importStar(require('../config/env.js')));
            const provider = new ethers.JsonRpcProvider(env.avalancheRpcUrl);
            const receipt = await provider.getTransactionReceipt(txHash);
            if (!receipt) {
                logger_js_1.logger.warn(`Transaction receipt not found for ${txHash} on ${chain}`);
                return null;
            }
            return {
                status: receipt.status,
                logs: receipt.logs.map(log => ({
                    address: log.address,
                    topics: log.topics,
                    data: log.data,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    logIndex: log.index
                }))
            };
        }
        else {
            logger_js_1.logger.warn(`Transaction receipt retrieval not implemented for chain ${chain}`);
            return null;
        }
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to get transaction receipt for ${txHash} on ${chain}:`, error);
        return null;
    }
}
/**
 * Calculate gas cost in USD
 */
async function calculateGasUsd(gasUsed, chain, pricing) {
    try {
        if (chain === 'avalanche') {
            // Get current AVAX price
            const { AvalancheClient } = await Promise.resolve().then(() => __importStar(require('../chains/avalanche.js')));
            const { env } = await Promise.resolve().then(() => __importStar(require('../config/env.js')));
            // Create a temporary client to get current gas price and native USD price
            const client = new AvalancheClient(env.avalancheRpcUrl);
            const gasPrice = await client.gasPrice();
            const avaxUsd = await client.nativeUsd();
            // Calculate gas cost
            const gasCostWei = BigInt(gasUsed) * gasPrice;
            const gasCostAvax = Number(gasCostWei) / 1e18;
            const gasCostUsd = gasCostAvax * avaxUsd;
            return gasCostUsd;
        }
        else {
            logger_js_1.logger.warn(`Gas USD calculation not implemented for chain ${chain}`);
            return 0;
        }
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to calculate gas USD for ${gasUsed} on ${chain}:`, error);
        return 0;
    }
}
async function executeSequential(bundles, clients, mockMode = false) {
    const results = [];
    // Execute bundles sequentially to avoid nonce conflicts and better error handling
    for (const bundle of bundles) {
        const result = await execute(bundle, clients, mockMode);
        results.push(result);
        // Add small delay between executions
        if (bundles.indexOf(bundle) < bundles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return results;
}
async function executeBatch(bundles, clients, batchSize = 3, mockMode = false) {
    const results = [];
    // Process bundles in batches to balance speed and reliability
    for (let i = 0; i < bundles.length; i += batchSize) {
        const batch = bundles.slice(i, i + batchSize);
        // Execute batch in parallel
        const batchPromises = batch.map(bundle => execute(bundle, clients, mockMode));
        const batchResults = await Promise.allSettled(batchPromises);
        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const bundle = batch[j];
            if (!bundle)
                continue;
            if (result.status === 'fulfilled') {
                results.push(result.value);
            }
            else {
                logger_js_1.logger.error(`Execution promise rejected for bundle ${bundle.id}:`, result.reason);
                results.push({
                    success: false,
                    error: `Promise rejection: ${result.reason}`,
                    claimedUsd: 0,
                    chain: bundle.chain
                });
            }
        }
        // Add delay between batches
        if (i + batchSize < bundles.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return results;
}
function aggregateExecutionResults(results) {
    let successCount = 0;
    let failureCount = 0;
    let totalClaimedUsd = 0;
    let totalGasUsd = 0;
    let verifiedPayoutCount = 0;
    for (const result of results) {
        if (result.success) {
            successCount++;
            totalClaimedUsd += result.claimedUsd;
            if (result.gasUsd) {
                totalGasUsd += result.gasUsd;
            }
        }
        else {
            failureCount++;
        }
        if (result.verifiedPayout) {
            verifiedPayoutCount++;
        }
    }
    const netUsd = totalClaimedUsd - totalGasUsd;
    const successRate = results.length > 0 ? successCount / results.length : 0;
    return {
        successCount,
        failureCount,
        totalClaimedUsd,
        totalGasUsd,
        netUsd,
        successRate,
        verifiedPayoutCount
    };
}
//# sourceMappingURL=executor.js.map