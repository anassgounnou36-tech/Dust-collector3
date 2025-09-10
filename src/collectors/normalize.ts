import type { WalletRow } from './index.js';

/**
 * Normalize wallet data and compute missing fields
 */
export function normalizeWallets(wallets: WalletRow[]): WalletRow[] {
  return wallets.map(wallet => ({
    ...wallet,
    address: wallet.address.toLowerCase(), // Normalize to lowercase
    chain: wallet.chain || 'avalanche',
    discovered_at: wallet.discovered_at || new Date().toISOString(),
    balance_tokens: wallet.balance_tokens || 0,
    balance_usd: wallet.balance_usd || 0,
  }));
}

/**
 * Remove duplicate wallet addresses (keeping the first occurrence)
 */
export function deduplicateWallets(wallets: WalletRow[]): WalletRow[] {
  const seen = new Set<string>();
  const deduplicated: WalletRow[] = [];

  for (const wallet of wallets) {
    const key = `${wallet.address}-${wallet.chain}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(wallet);
    }
  }

  console.log(`Deduplicated ${wallets.length} wallets to ${deduplicated.length} unique addresses`);
  return deduplicated;
}

/**
 * Filter wallets by minimum USD balance
 */
export function filterByMinUsd(wallets: WalletRow[], minUsd: number): WalletRow[] {
  const filtered = wallets.filter(wallet => {
    const usdValue = wallet.balance_usd || 0;
    return usdValue >= minUsd;
  });

  console.log(`Filtered ${wallets.length} wallets to ${filtered.length} above $${minUsd} threshold`);
  return filtered;
}

/**
 * Compute USD balance from token balance and price
 */
export function computeUsdBalances(
  wallets: WalletRow[], 
  tokenPriceUsd: number
): WalletRow[] {
  return wallets.map(wallet => ({
    ...wallet,
    balance_usd: wallet.balance_usd || ((wallet.balance_tokens || 0) * tokenPriceUsd),
  }));
}

/**
 * Format wallets as CSV content
 */
export function formatAsCSV(wallets: WalletRow[]): string {
  const headers = ['address', 'chain', 'source', 'balance_tokens', 'balance_usd', 'token_symbol', 'token_address', 'discovered_at'];
  const rows = [headers.join(',')];

  for (const wallet of wallets) {
    const row = [
      wallet.address,
      wallet.chain,
      wallet.source,
      wallet.balance_tokens?.toString() || '',
      wallet.balance_usd?.toString() || '',
      wallet.token_symbol || '',
      wallet.token_address || '',
      wallet.discovered_at,
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Sort wallets by USD balance (descending)
 */
export function sortByBalance(wallets: WalletRow[]): WalletRow[] {
  return [...wallets].sort((a, b) => (b.balance_usd || 0) - (a.balance_usd || 0));
}