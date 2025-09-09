import type { Address, Chain } from '../types/common.js';
/**
 * Represents a verified ERC20/TRC20 transfer event
 */
export interface VerifiedTransfer {
    readonly tokenAddress: string;
    readonly from: string;
    readonly to: string;
    readonly amountWei: string;
    readonly txHash: string;
    readonly logIndex: number;
}
/**
 * Interface for pricing service to resolve token values
 */
export interface PricingService {
    quoteToUsd(chain: Chain, tokenAddress: string, amountWei: string): Promise<number>;
    getTokenDecimals(symbol: string): number;
}
/**
 * Parse ERC20/TRC20 Transfer events from transaction receipt logs.
 * This is a simplified implementation that looks for Transfer event signatures.
 */
export declare function parseTransferEvents(txHash: string, logs: any[], chain: Chain): VerifiedTransfer[];
/**
 * Verify that transfers occurred to the expected recipient and compute realized USD value.
 */
export declare function verifyPayout(txHash: string, logs: any[], expectedRecipient: Address, pricingService?: PricingService): Promise<{
    verified: boolean;
    transfers: VerifiedTransfer[];
    totalUsd: number;
    error?: string;
}>;
//# sourceMappingURL=verifyPayout.d.ts.map