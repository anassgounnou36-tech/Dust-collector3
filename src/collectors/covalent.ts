import type { WalletCollector, WalletRow, CollectorConfig } from './index.js';

/**
 * Covalent API collector for token holders
 * Uses REST API to fetch token holders by pagination
 */
export class CovalentCollector implements WalletCollector {
  name = 'covalent';
  private apiKey: string;
  private baseUrl = 'https://api.covalenthq.com/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('COVALENT_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  async collect(tokenAddress: string, config?: CollectorConfig): Promise<WalletRow[]> {
    const { pageSize = 1000, limit = 5000, rateLimit = 10 } = config || {};
    const chainId = 43114; // Avalanche C-Chain
    const wallets: WalletRow[] = [];
    
    let pageNumber = 0;
    const maxPages = Math.ceil(limit / pageSize);

    console.log(`Covalent: Fetching token holders for ${tokenAddress} on chain ${chainId}`);

    try {
      while (pageNumber < maxPages && wallets.length < limit) {
        const url = `${this.baseUrl}/${chainId}/tokens/${tokenAddress}/token_holders/`;
        const params = new URLSearchParams({
          key: this.apiKey,
          'page-size': pageSize.toString(),
          'page-number': pageNumber.toString(),
        });

        console.log(`Covalent: Fetching page ${pageNumber + 1}...`);

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.status === 429) {
          // Rate limited - exponential backoff
          const delay = Math.min(1000 * Math.pow(2, pageNumber), 30000);
          console.log(`Covalent: Rate limited, waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry same page
        }

        if (!response.ok) {
          throw new Error(`Covalent API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();
        
        if (!data.data?.items) {
          console.log('Covalent: No more items found');
          break;
        }

        const items = data.data.items;
        const tokenDecimals = data.data.contract_decimals || 18;

        for (const item of items) {
          if (wallets.length >= limit) break;

          const balanceWei = item.balance || '0';
          const balanceTokens = parseFloat(balanceWei) / Math.pow(10, tokenDecimals);

          wallets.push({
            address: item.address,
            chain: 'avalanche',
            source: 'covalent',
            balance_wei: balanceWei,
            balance_tokens: balanceTokens,
            token_address: tokenAddress,
            discovered_at: new Date().toISOString(),
          });
        }

        console.log(`Covalent: Collected ${wallets.length} wallets so far`);

        // Rate limiting between requests
        if (rateLimit > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 / rateLimit));
        }

        pageNumber++;

        // Check if we have more pages
        if (!data.data.has_more || items.length < pageSize) {
          break;
        }
      }

      console.log(`Covalent: Collected ${wallets.length} total wallets`);
      return wallets;

    } catch (error) {
      console.error('Covalent API error:', error);
      throw error;
    }
  }
}