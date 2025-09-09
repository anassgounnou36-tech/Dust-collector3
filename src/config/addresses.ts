import type { Address, Chain } from '../types/common.js';

/**
 * Placeholder addresses used during development and testing.
 * These must be replaced with real addresses in production.
 */
const PLACEHOLDER_ADDRESSES: Record<Chain, string> = {
  avalanche: '0x0000000000000000000000000000000000000000',
  tron: 'T0000000000000000000000000000000000000000'
};

/**
 * Check if an address is a placeholder that should not be used in production.
 */
export function isPlaceholderAddress(address: Address): boolean {
  const placeholder = PLACEHOLDER_ADDRESSES[address.chain];
  return address.value.toLowerCase() === placeholder.toLowerCase();
}

/**
 * Check if an address looks like a seed or test address that should be blocked in production.
 * This includes patterns like 0x1234..., 0x2345..., 0x3456..., 0x4567..., 0x5678...
 */
export function looksLikeSeedOrTestAddress(address: Address): boolean {
  const value = address.value.toLowerCase();
  
  // Check for seed patterns (0x1234..., 0x2345..., etc.)
  const seedPatterns = [
    /^0x1234/,
    /^0x2345/,
    /^0x3456/,
    /^0x4567/,
    /^0x5678/,
    /^0x0123/,
    /^0x9876/,
    /^0xabcd/,
    /^0xdead/,
    /^0xbeef/
  ];
  
  for (const pattern of seedPatterns) {
    if (pattern.test(value)) {
      return true;
    }
  }
  
  // Check for test patterns
  if (value.includes('test') || value.includes('seed') || value.includes('demo')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a recipient address is allowed in non-mock mode.
 * This enforces the allowlist and blocks dangerous patterns.
 */
export function isAllowedRecipientNonMock(address: Address): boolean {
  // Block placeholder addresses
  if (isPlaceholderAddress(address)) {
    return false;
  }
  
  // Block seed/test addresses
  if (looksLikeSeedOrTestAddress(address)) {
    return false;
  }
  
  // Check against the configured default recipient for the chain
  const defaultRecipient = getDefaultClaimRecipient(address.chain);
  if (!defaultRecipient) {
    return false; // No default recipient configured for this chain
  }
  
  // Only allow the configured default recipient
  return address.value.toLowerCase() === defaultRecipient.value.toLowerCase();
}

/**
 * Get the default claim recipient for a chain from environment variables.
 * Returns null if not configured.
 */
export function getDefaultClaimRecipient(chain: Chain): Address | null {
  const envVar = chain === 'avalanche' 
    ? process.env.DEFAULT_CLAIM_RECIPIENT_AVAX
    : process.env.DEFAULT_CLAIM_RECIPIENT_TRON;
    
  if (!envVar) {
    return null;
  }
  
  return {
    value: envVar,
    chain
  };
}

/**
 * Validate that required claim recipients are configured for non-mock mode.
 */
export function validateClaimRecipients(mockMode: boolean): void {
  if (mockMode) {
    return; // No validation needed in mock mode
  }
  
  const missingChains: Chain[] = [];
  
  if (!process.env.DEFAULT_CLAIM_RECIPIENT_AVAX) {
    missingChains.push('avalanche');
  }
  
  // TRON is optional - only validate if we actually have TRON integrations running
  // This is a more flexible approach than requiring it always
  
  if (missingChains.length > 0) {
    throw new Error(
      `Missing required environment variables for non-mock mode: ${
        missingChains.map(chain => 
          chain === 'avalanche' ? 'DEFAULT_CLAIM_RECIPIENT_AVAX' : 'DEFAULT_CLAIM_RECIPIENT_TRON'
        ).join(', ')
      }`
    );
  }
}