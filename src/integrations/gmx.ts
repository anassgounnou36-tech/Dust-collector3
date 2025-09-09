import type { Integration, Address, PendingReward, ClaimBundle } from '../types/common.js';
import { env } from '../config/env.js';
import { getDefaultClaimRecipient, isAllowedRecipientNonMock } from '../config/addresses.js';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load GMX RewardRouterV2 ABI
let rewardRouterAbi: any[] = [];
try {
  const abiPath = join(process.cwd(), env.gmxRewardRouterV2AbiPath);
  rewardRouterAbi = JSON.parse(readFileSync(abiPath, 'utf8'));
} catch (error) {
  console.warn('Failed to load GMX RewardRouterV2 ABI:', error);
}

/**
 * Estimate gas cost based on reward types
 */
function estimateGasCost(esGmxRewards: PendingReward[], feeRewards: PendingReward[]): number {
  // Base gas cost varies by operation type
  let baseGas = 200000; // Default gas limit
  
  if (esGmxRewards.length > 0 && feeRewards.length > 0) {
    baseGas = 350000; // Compound operation
  } else if (esGmxRewards.length > 0) {
    baseGas = 250000; // Claim esGMX
  } else {
    baseGas = 200000; // Claim fees only
  }
  
  // Estimate gas price and cost in USD
  const estimatedGasPrice = 25e9; // 25 gwei
  const gasUsd = (baseGas * estimatedGasPrice * 40) / 1e18; // ~$40 per AVAX
  
  return gasUsd;
}

/**
 * Encode compound call for claiming both esGMX and fees
 */
function encodeCompoundCall(): string {
  try {
    if (rewardRouterAbi.length === 0) {
      console.warn('GMX RewardRouter ABI not loaded, using fallback function selector');
      return '0xf69e2046'; // compound() function selector
    }
    
    const iface = new ethers.Interface(rewardRouterAbi);
    const callData = iface.encodeFunctionData('compound', []);
    console.log(`GMX: Encoded compound() call: ${callData}`);
    return callData;
  } catch (error) {
    console.warn('Failed to encode compound() call:', error);
    return '0xf69e2046'; // Fallback selector
  }
}

/**
 * Encode claimEsGmx call
 */
function encodeClaimEsGmxCall(): string {
  try {
    if (rewardRouterAbi.length === 0) {
      console.warn('GMX RewardRouter ABI not loaded, using fallback function selector');
      return '0x5fe7bde9'; // claimEsGmx() function selector
    }
    
    const iface = new ethers.Interface(rewardRouterAbi);
    const callData = iface.encodeFunctionData('claimEsGmx', []);
    console.log(`GMX: Encoded claimEsGmx() call: ${callData}`);
    return callData;
  } catch (error) {
    console.warn('Failed to encode claimEsGmx() call:', error);
    return '0x5fe7bde9'; // Fallback selector
  }
}

/**
 * Encode claimFees call
 */
function encodeClaimFeesCall(): string {
  try {
    if (rewardRouterAbi.length === 0) {
      console.warn('GMX RewardRouter ABI not loaded, using fallback function selector');
      return '0xd294f093'; // claimFees() function selector
    }
    
    const iface = new ethers.Interface(rewardRouterAbi);
    const callData = iface.encodeFunctionData('claimFees', []);
    console.log(`GMX: Encoded claimFees() call: ${callData}`);
    return callData;
  } catch (error) {
    console.warn('Failed to encode claimFees() call:', error);
    return '0xd294f093'; // Fallback selector
  }
}

export const gmxIntegration: Integration = {
  key: 'gmx',
  chain: 'avalanche',

  async discoverWallets(): Promise<Address[]> {
    if (env.enableSyntheticGmx) {
      // Synthetic mode: return test wallets with GMX-like data
      console.log('GMX: Using synthetic mode for wallet discovery');
      return [
        { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' },
        { value: '0x2222222222222222222222222222222222222222', chain: 'avalanche' },
        { value: '0x3333333333333333333333333333333333333333', chain: 'avalanche' },
      ];
    }

    // Real implementation: Use configured default recipient
    console.log('GMX: Starting real wallet discovery...');
    const defaultRecipient = getDefaultClaimRecipient('avalanche');
    if (!defaultRecipient) {
      console.warn('No default claim recipient configured for Avalanche');
      return [];
    }
    
    console.log(`GMX: Using configured wallet: ${defaultRecipient.value}`);
    return [defaultRecipient];
  },

  async getPendingRewards(wallets: Address[]): Promise<PendingReward[]> {
    if (env.enableSyntheticGmx) {
      // Synthetic mode: return mock GMX rewards
      console.log(`GMX: Using synthetic mode for reward scanning (${wallets.length} wallets)`);
      
      const mockRewards: PendingReward[] = [];
      const now = new Date();

      for (const wallet of wallets) {
        // Mock staked GMX rewards (WETH)
        mockRewards.push({
          id: `gmx-staking-${wallet.value}`,
          wallet,
          protocol: 'gmx',
          token: { value: GMX_CONTRACTS.WETH, chain: 'avalanche' },
          amountWei: '1250000000000000000', // 1.25 WETH
          amountUsd: 3.75, // ~$3000 * 1.25
          claimTo: wallet,
          discoveredAt: now,
          estGasLimit: 180000
        });

        // Mock GLP fee rewards (AVAX)
        mockRewards.push({
          id: `gmx-glp-fees-${wallet.value}`,
          wallet,
          protocol: 'gmx',
          token: { value: GMX_CONTRACTS.WAVAX, chain: 'avalanche' },
          amountWei: '5500000000000000000', // 5.5 AVAX
          amountUsd: 2.20, // ~$40 * 5.5
          claimTo: wallet,
          discoveredAt: now,
          estGasLimit: 160000
        });
      }

      return mockRewards;
    }

    // Real implementation
    console.log(`GMX: Scanning real rewards for ${wallets.length} wallets...`);
    const rewards: PendingReward[] = [];
    
    if (!env.avalancheRpcUrl) {
      console.warn('Avalanche RPC URL not configured');
      return rewards;
    }

    try {
      const provider = new ethers.JsonRpcProvider(env.avalancheRpcUrl);
      const rewardRouter = new ethers.Contract(
        GMX_CONTRACTS.REWARD_ROUTER_V2,
        rewardRouterAbi,
        provider
      );
      
      for (const wallet of wallets) {
        try {
          const now = new Date();
          
          // Check claimable esGMX rewards
          let claimableEsGmx = BigInt(0);
          try {
            claimableEsGmx = await rewardRouter.claimableEsGmx(wallet.value);
          } catch (error) {
            console.warn(`Failed to get claimable esGMX for ${wallet.value}:`, error);
          }
          
          if (claimableEsGmx > BigInt(0)) {
            // Price esGMX (simplified - in real implementation would use pricing service)
            const esGmxDecimals = 18;
            const amountTokens = Number(claimableEsGmx) / Math.pow(10, esGmxDecimals);
            const estimatedPricePerToken = 25.0; // Placeholder price ~$25 per GMX
            const amountUsd = amountTokens * estimatedPricePerToken;
            
            if (amountUsd >= env.gmxMinUsd) {
              rewards.push({
                id: `gmx-es-gmx-${wallet.value}-${Date.now()}`,
                wallet,
                protocol: 'gmx',
                token: { value: GMX_CONTRACTS.ES_GMX_TOKEN, chain: 'avalanche' },
                amountWei: claimableEsGmx.toString(),
                amountUsd,
                claimTo: wallet,
                discoveredAt: now,
                estGasLimit: 200000
              });
              console.log(`Found esGMX reward: ${amountUsd.toFixed(2)} USD for ${wallet.value}`);
            }
          }
          
          // Check claimable fee rewards (WETH from GMX staking)
          let claimableFeeGmx = BigInt(0);
          try {
            claimableFeeGmx = await rewardRouter.claimableFeeGmx(wallet.value);
          } catch (error) {
            console.warn(`Failed to get claimable fee GMX for ${wallet.value}:`, error);
          }
          
          if (claimableFeeGmx > BigInt(0)) {
            // Price WETH fee rewards
            const wethDecimals = 18;
            const amountTokens = Number(claimableFeeGmx) / Math.pow(10, wethDecimals);
            const estimatedPricePerToken = 3000.0; // Placeholder price ~$3000 per WETH
            const amountUsd = amountTokens * estimatedPricePerToken;
            
            if (amountUsd >= env.gmxMinUsd) {
              rewards.push({
                id: `gmx-fee-weth-${wallet.value}-${Date.now()}`,
                wallet,
                protocol: 'gmx',
                token: { value: GMX_CONTRACTS.WETH, chain: 'avalanche' },
                amountWei: claimableFeeGmx.toString(),
                amountUsd,
                claimTo: wallet,
                discoveredAt: now,
                estGasLimit: 180000
              });
              console.log(`Found WETH fee reward: ${amountUsd.toFixed(2)} USD for ${wallet.value}`);
            }
          }
          
          // Check claimable GLP fee rewards (AVAX)
          let claimableFeeGlp = BigInt(0);
          try {
            claimableFeeGlp = await rewardRouter.claimableFeeGlp(wallet.value);
          } catch (error) {
            console.warn(`Failed to get claimable fee GLP for ${wallet.value}:`, error);
          }
          
          if (claimableFeeGlp > BigInt(0)) {
            // Price AVAX fee rewards
            const avaxDecimals = 18;
            const amountTokens = Number(claimableFeeGlp) / Math.pow(10, avaxDecimals);
            const estimatedPricePerToken = 40.0; // Placeholder price ~$40 per AVAX
            const amountUsd = amountTokens * estimatedPricePerToken;
            
            if (amountUsd >= env.gmxMinUsd) {
              rewards.push({
                id: `gmx-fee-avax-${wallet.value}-${Date.now()}`,
                wallet,
                protocol: 'gmx',
                token: { value: GMX_CONTRACTS.WAVAX, chain: 'avalanche' },
                amountWei: claimableFeeGlp.toString(),
                amountUsd,
                claimTo: wallet,
                discoveredAt: now,
                estGasLimit: 160000
              });
              console.log(`Found AVAX fee reward: ${amountUsd.toFixed(2)} USD for ${wallet.value}`);
            }
          }
          
        } catch (error) {
          console.warn(`Failed to check GMX rewards for ${wallet.value}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Failed to scan GMX rewards:', error);
    }

    console.log(`GMX: Found ${rewards.length} claimable rewards`);
    return rewards;
  },

  async buildBundle(rewards: PendingReward[]): Promise<ClaimBundle[]> {
    if (env.enableSyntheticGmx) {
      // Synthetic mode: create mock bundles
      console.log(`GMX: Using synthetic mode for bundle building (${rewards.length} rewards)`);
      
      if (rewards.length === 0) return [];

      const bundle: ClaimBundle = {
        id: `gmx-bundle-${Date.now()}`,
        chain: 'avalanche',
        protocol: 'gmx',
        claimTo: rewards[0].claimTo,
        items: rewards,
        totalUsd: rewards.reduce((sum, r) => sum + r.amountUsd, 0),
        estGasUsd: 0.25, // Mock gas estimate
        netUsd: rewards.reduce((sum, r) => sum + r.amountUsd, 0) - 0.25
      };

      return [bundle];
    }

    // Real implementation
    if (rewards.length === 0) {
      return [];
    }
    
    console.log(`GMX: Building real claim bundles for ${rewards.length} rewards...`);
    
    // Validate recipients in non-synthetic mode
    for (const reward of rewards) {
      if (!isAllowedRecipientNonMock(reward.claimTo)) {
        throw new Error(`Invalid recipient ${reward.claimTo.value} not allowed in non-mock mode`);
      }
    }
    
    // Group rewards by type and recipient
    const bundleMap = new Map<string, PendingReward[]>();
    
    for (const reward of rewards) {
      const key = `${reward.claimTo.value}-${reward.claimTo.chain}`;
      if (!bundleMap.has(key)) {
        bundleMap.set(key, []);
      }
      bundleMap.get(key)!.push(reward);
    }
    
    const bundles: ClaimBundle[] = [];
    
    for (const [recipientKey, groupedRewards] of bundleMap) {
      // Separate rewards by type to determine the best claiming strategy
      const esGmxRewards = groupedRewards.filter(r => r.id.includes('es-gmx'));
      const feeRewards = groupedRewards.filter(r => r.id.includes('fee-'));
      
      const firstReward = groupedRewards[0];
      const totalUsd = groupedRewards.reduce((sum, r) => sum + r.amountUsd, 0);
      
      // Estimate gas cost for the bundle
      const estGasUsd = estimateGasCost(esGmxRewards, feeRewards);
      const netUsd = Math.max(0, totalUsd - estGasUsd);
      
      // Determine the best claiming strategy
      let callData: string;
      let contractAddress: string = GMX_CONTRACTS.REWARD_ROUTER_V2;
      
      if (esGmxRewards.length > 0 && feeRewards.length > 0) {
        // Both esGMX and fees - use compound for best efficiency
        callData = encodeCompoundCall();
      } else if (esGmxRewards.length > 0) {
        // Only esGMX rewards
        callData = encodeClaimEsGmxCall();
      } else {
        // Only fee rewards
        callData = encodeClaimFeesCall();
      }
      
      const bundle: ClaimBundle = {
        id: `gmx-bundle-${Date.now()}`,
        chain: 'avalanche',
        protocol: 'gmx',
        claimTo: firstReward.claimTo,
        items: groupedRewards,
        totalUsd,
        estGasUsd,
        netUsd,
        contractAddress,
        callData,
        value: 0 // No ETH/AVAX value needed for GMX claims
      };
      
      bundles.push(bundle);
      console.log(`GMX: Created bundle with ${groupedRewards.length} rewards, estimated gas: $${estGasUsd.toFixed(2)}`);
    }
    
    console.log(`GMX: Created ${bundles.length} claim bundles`);
    return bundles;
  }
};

// GMX contract addresses on Avalanche (Real addresses)
export const GMX_CONTRACTS = {
  // Core contracts
  GMX_TOKEN: '0x62edc0692BD897D2295872a9FFCac5425011c661',
  GLP_TOKEN: '0x01234567890123456789012345678901234567890', // GLP address
  ES_GMX_TOKEN: '0xFf1489227BbAAC61a9209A08929E4c2a526DdD17', // Escrowed GMX
  
  // Main router for claiming rewards
  REWARD_ROUTER_V2: '0x82147C5A7E850eA4E28155DF107F2590fD4ba327', // RewardRouterV2
  
  // Staking contracts
  STAKED_GMX: '0x2bD10f8E93B3669b6d42E74eEedC65dd8D6dC0c4',
  STAKED_GLP: '0x9e295B5B976a184B14aD8cd72413aD846C299660',
  
  // Reward contracts
  FEE_GLP_TRACKER: '0x4e971a87900b931fF39d1Aad67697F49835400b6',
  FEE_GMX_TRACKER: '0xd2D1162512F927a7e282Ef43a362659E4F2a728F',
  STAKED_GMX_TRACKER: '0x908C4D94D34924765f1eDc22A1DD098397c59dD4',
  STAKED_GLP_TRACKER: '0x1aDDD80E6039594eE970E5872D247bf0414C8903',
  
  // Reward tokens
  WETH: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  WAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'
} as const;