import type { Integration, Address, PendingReward, ClaimBundle } from '../types/common.js';
import { env } from '../config/env.js';
import { getDefaultClaimRecipient, isAllowedRecipientNonMock } from '../config/addresses.js';
import { ethers } from 'ethers';

/**
 * ERC20 ABI subset for token operations (dust collection)
 */
const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)'
] as const;

/**
 * Default GMX dust collection tokens on Avalanche
 */
const DEFAULT_DUST_TOKENS = {
  GMX: '0x62edc0692BD897D2295872a9FFCac5425011c661',
  USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  'WETH.e': '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  WAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'
} as const;

/**
 * Token metadata with fallback pricing
 */
interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  priceUsd: number;
}

/**
 * Get list of tokens to scan for dust collection
 */
function getDustTokens(): string[] {
  if (env.gmxDustTokens) {
    // Parse comma-separated addresses from env
    return env.gmxDustTokens
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
  }
  
  // Use default tokens
  return Object.values(DEFAULT_DUST_TOKENS);
}

/**
 * Get price for a token symbol (simple env-based lookup)
 */
function getTokenPrice(symbol: string): number {
  // Check for per-token price environment variables
  const envVar = `${symbol.toUpperCase()}_PRICE_USD`;
  const envPrice = process.env[envVar];
  if (envPrice) {
    const price = parseFloat(envPrice);
    if (!isNaN(price) && price > 0) {
      return price;
    }
  }
  
  // Fallback prices for common tokens
  const fallbackPrices: Record<string, number> = {
    'GMX': 25.0,      // ~$25 per GMX
    'USDC': 1.0,      // ~$1 per USDC
    'WETH.e': 3000.0, // ~$3000 per WETH
    'WAVAX': env.avaxPriceUsd, // Use env AVAX price
    'WETH': 3000.0,   // ~$3000 per WETH (alternative name)
    'AVAX': env.avaxPriceUsd  // Use env AVAX price
  };
  
  return fallbackPrices[symbol.toUpperCase()] || 0;
}

/**
 * Fetch token metadata (symbol, decimals) from contract
 */
async function getTokenInfo(tokenAddress: string, provider: ethers.JsonRpcProvider): Promise<TokenInfo> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const [symbol, decimals] = await Promise.all([
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18)
    ]);
    
    const priceUsd = getTokenPrice(symbol);
    
    return {
      address: tokenAddress,
      symbol,
      decimals: Number(decimals),
      priceUsd
    };
  } catch (error) {
    console.warn(`Failed to get token info for ${tokenAddress}:`, error);
    return {
      address: tokenAddress,
      symbol: 'UNKNOWN',
      decimals: 18,
      priceUsd: 0
    };
  }
}

/**
 * Check token balance for a wallet
 */
async function getTokenBalance(
  tokenAddress: string, 
  walletAddress: string, 
  provider: ethers.JsonRpcProvider
): Promise<bigint> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    // Ensure addresses are properly checksummed
    const checksummedWallet = ethers.getAddress(walletAddress);
    const balance = await contract.balanceOf(checksummedWallet);
    return BigInt(balance.toString());
  } catch (error) {
    console.warn(`Failed to get balance for ${tokenAddress} on ${walletAddress}:`, error);
    return BigInt(0);
  }
}

/**
 * Create ERC20 transfer call data
 */
function encodeTransferCall(recipient: string, amount: bigint): string {
  try {
    const iface = new ethers.Interface(ERC20_ABI);
    // Ensure recipient address is properly checksummed
    const checksummedRecipient = ethers.getAddress(recipient);
    return iface.encodeFunctionData('transfer', [checksummedRecipient, amount]);
  } catch (error) {
    console.warn('Failed to encode transfer call:', error);
    return '0x';
  }
}

export const gmxDustIntegration: Integration = {
  key: 'gmx-dust',
  chain: 'avalanche',

  async discoverWallets(): Promise<Address[]> {
    console.log('GMX Dust: Starting wallet discovery...');
    
    if (env.walletScanAvax) {
      // Parse comma-separated wallet addresses from WALLET_SCAN_AVAX
      const walletAddresses = env.walletScanAvax
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);
      
      if (walletAddresses.length > 0) {
        const wallets = walletAddresses.map(addr => ({
          value: addr,
          chain: 'avalanche' as const
        }));
        console.log(`GMX Dust: Using ${wallets.length} configured wallets from WALLET_SCAN_AVAX`);
        return wallets;
      }
    }
    
    // Fallback to default recipient
    const defaultRecipient = getDefaultClaimRecipient('avalanche');
    if (!defaultRecipient) {
      console.warn('No default claim recipient configured for Avalanche');
      return [];
    }
    
    console.log(`GMX Dust: Using configured wallet: ${defaultRecipient.value}`);
    return [defaultRecipient];
  },

  async getPendingRewards(wallets: Address[]): Promise<PendingReward[]> {
    console.log(`GMX Dust: Scanning token balances for ${wallets.length} wallets...`);
    
    if (!env.avalancheRpcUrl) {
      console.warn('Avalanche RPC URL not configured');
      return [];
    }

    // Mock mode for testing/demo
    if (env.mockMode) {
      console.log('GMX Dust: Using mock mode for testing');
      const rewards: PendingReward[] = [];
      const now = new Date();

      for (const wallet of wallets) {
        // Mock some dust balances
        rewards.push({
          id: `gmx-dust-GMX-${wallet.value}-${Date.now()}`,
          wallet,
          protocol: 'gmx-dust',
          token: { value: DEFAULT_DUST_TOKENS.GMX, chain: 'avalanche' },
          amountWei: '50000000000000000', // 0.05 GMX
          amountUsd: 1.25, // 0.05 * $25
          claimTo: wallet,
          discoveredAt: now,
          estGasLimit: 65000,
          isSynthetic: true
        });

        rewards.push({
          id: `gmx-dust-USDC-${wallet.value}-${Date.now() + 1}`,
          wallet,
          protocol: 'gmx-dust',
          token: { value: DEFAULT_DUST_TOKENS.USDC, chain: 'avalanche' },
          amountWei: '750000', // 0.75 USDC (6 decimals)
          amountUsd: 0.75,
          claimTo: wallet,
          discoveredAt: now,
          estGasLimit: 65000,
          isSynthetic: true
        });
      }

      return rewards.filter(r => r.amountUsd >= env.gmxItemMinUsd);
    }

    const provider = new ethers.JsonRpcProvider(env.avalancheRpcUrl);
    const dustTokens = getDustTokens();
    const rewards: PendingReward[] = [];
    
    console.log(`GMX Dust: Checking ${dustTokens.length} tokens: ${dustTokens.map(addr => addr.slice(0, 8) + '...').join(', ')}`);

    try {
      // Get token metadata for all tokens
      const tokenInfos = await Promise.all(
        dustTokens.map(tokenAddress => getTokenInfo(tokenAddress, provider))
      );

      // Scan each wallet
      for (const wallet of wallets) {
        console.log(`GMX Dust: Scanning wallet ${wallet.value}...`);
        
        for (const tokenInfo of tokenInfos) {
          try {
            const balance = await getTokenBalance(tokenInfo.address, wallet.value, provider);
            
            if (balance > BigInt(0)) {
              // Calculate USD value
              const amountTokens = Number(balance) / Math.pow(10, tokenInfo.decimals);
              const amountUsd = amountTokens * tokenInfo.priceUsd;
              
              console.log(`GMX Dust: Found ${amountTokens.toFixed(6)} ${tokenInfo.symbol} ($${amountUsd.toFixed(2)}) in ${wallet.value}`);
              
              // Filter by minimum USD value
              if (amountUsd >= env.gmxItemMinUsd) {
                rewards.push({
                  id: `gmx-dust-${tokenInfo.symbol}-${wallet.value}-${Date.now()}`,
                  wallet,
                  protocol: 'gmx-dust',
                  token: { value: tokenInfo.address, chain: 'avalanche' },
                  amountWei: balance.toString(),
                  amountUsd,
                  claimTo: wallet,
                  discoveredAt: new Date(),
                  estGasLimit: 65000 // Standard ERC20 transfer gas limit
                });
                
                console.log(`✅ GMX Dust: Qualified ${tokenInfo.symbol} worth $${amountUsd.toFixed(2)} (above $${env.gmxItemMinUsd} threshold)`);
              } else {
                console.log(`⏭️  GMX Dust: Skipped ${tokenInfo.symbol} worth $${amountUsd.toFixed(2)} (below $${env.gmxItemMinUsd} threshold)`);
              }
            }
          } catch (error) {
            console.warn(`Failed to check ${tokenInfo.symbol} balance for ${wallet.value}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan GMX dust tokens:', error);
    }

    console.log(`GMX Dust: Found ${rewards.length} qualified token balances`);
    return rewards;
  },

  async buildBundle(rewards: PendingReward[]): Promise<ClaimBundle[]> {
    if (rewards.length === 0) {
      return [];
    }
    
    console.log(`GMX Dust: Building transfer bundles for ${rewards.length} token balances...`);
    
    // Validate recipients in non-mock mode
    for (const reward of rewards) {
      if (!env.mockMode && !isAllowedRecipientNonMock(reward.claimTo)) {
        throw new Error(`Invalid recipient ${reward.claimTo.value} not allowed in non-mock mode`);
      }
    }
    
    const defaultRecipient = getDefaultClaimRecipient('avalanche');
    if (!defaultRecipient) {
      throw new Error('No default claim recipient configured for Avalanche');
    }
    
    // Group rewards by token address (each token transfer needs separate transaction)
    const bundleMap = new Map<string, PendingReward[]>();
    
    for (const reward of rewards) {
      const key = reward.token.value;
      if (!bundleMap.has(key)) {
        bundleMap.set(key, []);
      }
      bundleMap.get(key)!.push(reward);
    }
    
    const bundles: ClaimBundle[] = [];
    
    for (const [tokenAddress, tokenRewards] of bundleMap) {
      // Sum up all balances for this token across wallets
      const totalBalance = tokenRewards.reduce((sum, r) => sum + BigInt(r.amountWei), BigInt(0));
      const totalUsd = tokenRewards.reduce((sum, r) => sum + r.amountUsd, 0);
      
      // Estimate gas cost (25 gwei * 65000 gas * AVAX price)
      const estimatedGasPrice = 25e9; // 25 gwei
      const gasLimit = 65000;
      const gasCostAvax = (gasLimit * estimatedGasPrice) / 1e18;
      const estGasUsd = gasCostAvax * env.avaxPriceUsd;
      const netUsd = Math.max(0, totalUsd - estGasUsd);
      
      // Get token symbol for logging
      const tokenSymbol = tokenRewards[0].id.includes('GMX') ? 'GMX' : 
                         tokenRewards[0].id.includes('USDC') ? 'USDC' :
                         tokenRewards[0].id.includes('WETH') ? 'WETH.e' :
                         tokenRewards[0].id.includes('WAVAX') ? 'WAVAX' : 'TOKEN';
      
      // Create transfer call data
      const callData = encodeTransferCall(defaultRecipient.value, totalBalance);
      
      const bundle: ClaimBundle = {
        id: `gmx-dust-${tokenSymbol}-${Date.now()}`,
        chain: 'avalanche',
        protocol: 'gmx-dust',
        claimTo: defaultRecipient,
        items: tokenRewards,
        totalUsd,
        estGasUsd,
        netUsd,
        contractAddress: tokenAddress, // Target is the token contract
        callData,
        value: 0 // No ETH/AVAX value needed for ERC20 transfers
      };
      
      bundles.push(bundle);
      console.log(`GMX Dust: Created ${tokenSymbol} transfer bundle: ${tokenRewards.length} balances, $${totalUsd.toFixed(2)} total, $${estGasUsd.toFixed(2)} gas, $${netUsd.toFixed(2)} net`);
    }
    
    console.log(`GMX Dust: Created ${bundles.length} transfer bundles`);
    return bundles;
  }
};