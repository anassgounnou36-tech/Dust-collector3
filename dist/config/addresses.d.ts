import type { Address, Chain } from '../types/common.js';
/**
 * Check if an address is a placeholder that should not be used in production.
 */
export declare function isPlaceholderAddress(address: Address): boolean;
/**
 * Check if an address looks like a seed or test address that should be blocked in production.
 * This includes patterns like 0x1234..., 0x2345..., 0x3456..., 0x4567..., 0x5678...
 */
export declare function looksLikeSeedOrTestAddress(address: Address): boolean;
/**
 * Check if a recipient address is allowed in non-mock mode.
 * This enforces the allowlist and blocks dangerous patterns.
 */
export declare function isAllowedRecipientNonMock(address: Address): boolean;
/**
 * Get the default claim recipient for a chain from environment variables.
 * Returns null if not configured.
 */
export declare function getDefaultClaimRecipient(chain: Chain): Address | null;
/**
 * Validate that required claim recipients are configured for non-mock mode.
 */
export declare function validateClaimRecipients(mockMode: boolean): void;
//# sourceMappingURL=addresses.d.ts.map