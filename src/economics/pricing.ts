import type { Chain } from '../types/common.js';

// In-memory cache with TTL for pricing data
interface CacheEntry {
  value: number;
  timestamp: number;
}

const priceCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function getCachedPrice(key: string): number | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    priceCache.delete(key);
    return null;
  }
  
  return entry.value;
}

function setCachedPrice(key: string, value: number): void {
  priceCache.set(key, {
    value,
    timestamp: Date.now()
  });
}

// Stable token configuration - placeholder list as specified
const STABLE_TOKENS = ['USDC', 'USDT', 'DAI'];
const TOKEN_DECIMALS_MAP: Record<string, number> = {
  'USDC': 6,
  'USDT': 6,
  'DAI': 18,
  'AVAX': 18,
  'TRX': 6,
  'WETH': 18,
  'WBTC': 8,
  'JOE': 18,
  'sJOE': 18,
  'QI': 18,
  'GMX': 18
};

export function getTokenDecimals(symbol: string): number {
  return TOKEN_DECIMALS_MAP[symbol.toUpperCase()] || 18;
}

export function isStablecoin(symbol: string): boolean {
  return STABLE_TOKENS.includes(symbol.toUpperCase());
}

export async function quoteToUsd(chain: 'avalanche', token: string, amountWei: string): Promise<number> {
  // Only support avalanche chain for now as specified
  if (chain !== 'avalanche') {
    console.warn(`quoteToUsd: Chain ${chain} not supported, only 'avalanche' is implemented`);
    return 0;
  }

  const cacheKey = `${chain}:${token}`;
  
  try {
    // Extract token symbol from address mapping
    const tokenSymbol = getTokenSymbolFromAddress(token);
    
    // Check if it's a stable token
    if (STABLE_TOKENS.includes(tokenSymbol.toUpperCase())) {
      const decimals = TOKEN_DECIMALS_MAP[tokenSymbol.toUpperCase()] || 18;
      const amount = parseFloat(amountWei) / Math.pow(10, decimals);
      
      // Cache stable token price calculation
      setCachedPrice(cacheKey, amount);
      return amount;
    }

    // For non-stable tokens, placeholder TODO logic
    console.warn(`quoteToUsd: Non-stable token pricing not implemented for ${tokenSymbol} on ${chain}. Returning 0.`);
    // TODO: Implement router-based pricing (Trader Joe getAmountsOut, etc.)
    // TODO: Implement oracle-based pricing (Chainlink, etc.)
    // TODO: Implement external API pricing (CoinGecko, DeFiLlama, etc.)
    
    return 0;
  } catch (error) {
    console.error(`Failed to quote ${token} to USD on ${chain}:`, error);
    return 0;
  }
}

// Helper function to extract token symbol from address
// This is a simplified implementation - in reality, you'd need to:
// 1. Call the token contract's symbol() function
// 2. Maintain a database of known token addresses
// 3. Use third-party APIs for token metadata
function getTokenSymbolFromAddress(address: string): string {
  // Simple mapping for common addresses - this would need to be expanded
  const knownTokens: Record<string, string> = {
    // Avalanche C-Chain
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': 'USDC',
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': 'USDT',
    '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70': 'DAI',
    '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': 'WAVAX',
    '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd': 'JOE',     // JOE token
    '0x1a731B2299E22FbAC282E7094EdA41046343Cb51': 'sJOE',    // sJOE token
    
    // Tron (TRC-20)
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t': 'USDT', // USDT-TRC20
    'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8': 'USDC', // USDC-TRC20
  };

  return knownTokens[address] || 'UNKNOWN';
}

export function formatTokenAmount(amountWei: string, decimals: number): string {
  const amount = parseFloat(amountWei) / Math.pow(10, decimals);
  return amount.toFixed(6);
}

export function parseTokenAmount(amount: string, decimals: number): string {
  const parsed = parseFloat(amount) * Math.pow(10, decimals);
  return Math.floor(parsed).toString();
}