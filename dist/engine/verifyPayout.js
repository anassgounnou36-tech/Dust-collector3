"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTransferEvents = parseTransferEvents;
exports.verifyPayout = verifyPayout;
/**
 * Parse ERC20/TRC20 Transfer events from transaction receipt logs.
 * This is a simplified implementation that looks for Transfer event signatures.
 */
function parseTransferEvents(txHash, logs, chain) {
    const transfers = [];
    // ERC20 Transfer event signature: Transfer(address,address,uint256)
    // Keccak256 hash: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        // Check if this is a Transfer event
        if (!log.topics || log.topics.length !== 3 || log.topics[0] !== TRANSFER_TOPIC) {
            continue;
        }
        try {
            // Parse transfer parameters
            const from = `0x${log.topics[1].slice(-40)}`; // Remove padding
            const to = `0x${log.topics[2].slice(-40)}`; // Remove padding
            const amountWei = BigInt(log.data || '0x0').toString();
            // For Tron, convert addresses to proper format if needed
            const fromAddress = chain === 'tron' ? convertTronAddress(from) : from;
            const toAddress = chain === 'tron' ? convertTronAddress(to) : to;
            transfers.push({
                tokenAddress: log.address,
                from: fromAddress,
                to: toAddress,
                amountWei,
                txHash,
                logIndex: i
            });
        }
        catch (error) {
            console.warn(`Failed to parse transfer event at log index ${i}:`, error);
        }
    }
    return transfers;
}
/**
 * Convert Tron address format (simplified - in real implementation would use TronWeb)
 */
function convertTronAddress(hexAddress) {
    // This is a placeholder - real implementation would use TronWeb.address.fromHex()
    // For now, just return as-is since the test environment may not have proper Tron address conversion
    return hexAddress;
}
/**
 * Verify that transfers occurred to the expected recipient and compute realized USD value.
 */
async function verifyPayout(txHash, logs, expectedRecipient, pricingService) {
    try {
        // Parse all transfer events from the transaction
        const transfers = parseTransferEvents(txHash, logs, expectedRecipient.chain);
        // Filter transfers that went to the expected recipient
        const recipientTransfers = transfers.filter(transfer => transfer.to.toLowerCase() === expectedRecipient.value.toLowerCase());
        if (recipientTransfers.length === 0) {
            return {
                verified: false,
                transfers: [],
                totalUsd: 0,
                error: 'No transfers found to expected recipient'
            };
        }
        // Compute total USD value if pricing service is available
        let totalUsd = 0;
        if (pricingService) {
            for (const transfer of recipientTransfers) {
                try {
                    const usdValue = await pricingService.quoteToUsd(expectedRecipient.chain, transfer.tokenAddress, transfer.amountWei);
                    totalUsd += usdValue;
                }
                catch (error) {
                    console.warn(`Failed to price transfer ${transfer.tokenAddress}:`, error);
                    // Continue without failing the entire verification
                }
            }
        }
        return {
            verified: true,
            transfers: recipientTransfers,
            totalUsd
        };
    }
    catch (error) {
        return {
            verified: false,
            transfers: [],
            totalUsd: 0,
            error: error instanceof Error ? error.message : 'Unknown verification error'
        };
    }
}
//# sourceMappingURL=verifyPayout.js.map