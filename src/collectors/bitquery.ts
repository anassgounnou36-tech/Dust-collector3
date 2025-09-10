import type { WalletCollector, WalletRow, CollectorConfig } from './index.js';

/**
 * Bitquery GraphQL collector for token transfers and balances
 * Uses GraphQL API to aggregate transfer data by receiver
 */
export class BitqueryCollector implements WalletCollector {
  name = 'bitquery';
  private apiKey: string;
  private endpoint = 'https://graphql.bitquery.io/';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('BITQUERY_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  async collect(tokenAddress: string, config?: CollectorConfig): Promise<WalletRow[]> {
    const { limit = 5000, rateLimit = 10 } = config || {};
    const wallets: WalletRow[] = [];

    console.log(`Bitquery: Fetching token holders for ${tokenAddress} on Avalanche`);

    try {
      // GraphQL query to get token transfer receivers aggregated by address
      const query = `
        query GetTokenHolders($tokenAddress: String!, $limit: Int!) {
          ethereum(network: avalanche) {
            transfers(
              currency: {is: $tokenAddress}
              options: {limit: $limit}
            ) {
              receiver {
                address
              }
              amount(aggregate: sum)
              count(uniq: transactions)
            }
          }
        }
      `;

      const variables = {
        tokenAddress: tokenAddress.toLowerCase(),
        limit,
      };

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (response.status === 429) {
        // Rate limited
        throw new Error('Bitquery API rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`Bitquery API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.errors) {
        throw new Error(`Bitquery GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const transfers = data.data?.ethereum?.transfers || [];

      for (const transfer of transfers) {
        if (wallets.length >= limit) break;

        const address = transfer.receiver?.address;
        if (!address) continue;

        // Note: This is aggregated transfer amount, not current balance
        // Real implementation might need additional balance queries
        const transferAmount = parseFloat(transfer.amount || '0');

        wallets.push({
          address,
          chain: 'avalanche',
          source: 'bitquery',
          balance_tokens: transferAmount, // This is transfer amount, not balance
          token_address: tokenAddress,
          discovered_at: new Date().toISOString(),
        });
      }

      console.log(`Bitquery: Collected ${wallets.length} wallet addresses from transfers`);

      // Rate limiting
      if (rateLimit > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 / rateLimit));
      }

      return wallets;

    } catch (error) {
      console.error('Bitquery API error:', error);
      throw error;
    }
  }
}