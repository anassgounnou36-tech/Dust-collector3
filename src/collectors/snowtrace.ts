import type { WalletCollector, WalletRow, CollectorConfig } from './index.js';

/**
 * SnowTrace API collector as fallback
 * Uses token transfer logs to aggregate wallet addresses
 */
export class SnowTraceCollector implements WalletCollector {
  name = 'snowtrace';
  private apiKey: string;
  private baseUrl = 'https://api.snowtrace.io/api';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('SNOWTRACE_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  async collect(tokenAddress: string, config?: CollectorConfig): Promise<WalletRow[]> {
    const { limit = 5000, rateLimit = 5 } = config || {};
    const wallets: WalletRow[] = [];
    const walletSet = new Set<string>(); // Track unique addresses

    console.log(`SnowTrace: Fetching token transfer events for ${tokenAddress}`);

    try {
      // Get recent token transfer events
      const params = new URLSearchParams({
        module: 'logs',
        action: 'getLogs',
        fromBlock: '0',
        toBlock: 'latest',
        address: tokenAddress,
        topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event signature
        apikey: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (response.status === 429) {
        throw new Error('SnowTrace API rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`SnowTrace API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.status !== '1') {
        throw new Error(`SnowTrace API error: ${data.message}`);
      }

      const logs = data.result || [];
      console.log(`SnowTrace: Processing ${logs.length} transfer events`);

      for (const log of logs) {
        if (wallets.length >= limit) break;

        // Parse transfer event topics
        // topic1 = from address (padded to 32 bytes)
        // topic2 = to address (padded to 32 bytes)
        const topics = log.topics || [];
        
        if (topics.length >= 3) {
          // Extract 'to' address from topic2 (remove padding)
          const toAddress = '0x' + topics[2].slice(-40);
          
          // Skip zero address and duplicates
          if (toAddress !== '0x0000000000000000000000000000000000000000' && !walletSet.has(toAddress)) {
            walletSet.add(toAddress);
            
            wallets.push({
              address: toAddress,
              chain: 'avalanche',
              source: 'snowtrace',
              token_address: tokenAddress,
              discovered_at: new Date().toISOString(),
            });
          }
        }
      }

      console.log(`SnowTrace: Collected ${wallets.length} unique wallet addresses`);

      // Rate limiting
      if (rateLimit > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 / rateLimit));
      }

      return wallets;

    } catch (error) {
      console.error('SnowTrace API error:', error);
      throw error;
    }
  }
}