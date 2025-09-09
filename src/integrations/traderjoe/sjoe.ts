import type { Integration, Address, PendingReward, ClaimBundle } from '../../types/common.js';
import { env } from '../../config/env.js';
import { getDefaultClaimRecipient, isAllowedRecipientNonMock } from '../../config/addresses.js';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Trader Joe sJOE Staking Integration
 * Real earnings from sJOE staking on Avalanche C-Chain
 */

// Load staking contract ABI
let stakingAbi: any[] = [];
try {
  const abiPath = join(process.cwd(), env.traderJoeSJoeStakingAbiPath);
  stakingAbi = JSON.parse(readFileSync(abiPath, 'utf8'));
} catch (error) {
  console.warn('Failed to load sJOE staking ABI:', error);
}

/**
 * Discover wallets for sJOE rewards
 * In MVP: Only use the configured default claim recipient
 */
async function discoverSJoeWallets(mockMode: boolean): Promise<Address[]> {
  console.log('TraderJoe sJOE: Starting wallet discovery...');
  
  if (!mockMode) {
    // In non-mock mode, only use the configured default recipient
    const defaultRecipient = getDefaultClaimRecipient('avalanche');
    if (!defaultRecipient) {
      console.warn('No default claim recipient configured for Avalanche');
      return [];
    }
    
    console.log(`TraderJoe sJOE: Using configured wallet: ${defaultRecipient.value}`);
    return [defaultRecipient];
  } else {
    // In mock mode, use a test wallet
    return [{
      value: '0x1234567890123456789012345678901234567890',
      chain: 'avalanche'
    }];
  }
}

/**
 * Get pending sJOE rewards for wallets
 */
async function getSJoePendingRewards(wallets: Address[], mockMode: boolean): Promise<PendingReward[]> {
  console.log(`TraderJoe sJOE: Scanning rewards for ${wallets.length} wallets...`);
  
  if (mockMode) {
    // Mock implementation
    return wallets.map((wallet, index) => ({
      id: `traderjoe-sjoe-${wallet.value}-${Date.now()}-${index}`,
      wallet,
      protocol: 'traderjoe',
      token: {
        value: env.sJoeToken,
        chain: 'avalanche'
      },
      amountWei: (BigInt(2) * BigInt(10) ** BigInt(18)).toString(), // 2 sJOE
      amountUsd: 5.0, // $5 worth
      claimTo: wallet,
      discoveredAt: new Date(),
      lastClaimAt: undefined
    }));
  }
  
  // Real implementation
  const rewards: PendingReward[] = [];
  
  if (!env.traderJoeSJoeStakingAddress) {
    console.warn('TraderJoe sJOE staking address not configured');
    return rewards;
  }
  
  if (!env.avalancheRpcUrl) {
    console.warn('Avalanche RPC URL not configured');
    return rewards;
  }
  
  try {
    const provider = new ethers.JsonRpcProvider(env.avalancheRpcUrl);
    const stakingContract = new ethers.Contract(
      env.traderJoeSJoeStakingAddress,
      stakingAbi,
      provider
    );
    
    for (const wallet of wallets) {
      try {
        // Call pendingReward function (configurable function name)
        const pendingAmount = await stakingContract.pendingReward(wallet.value);
        const amountWei = pendingAmount.toString();
        
        if (BigInt(amountWei) === BigInt(0)) {
          continue; // Skip zero rewards
        }
        
        // Price the reward in USD (simplified pricing)
        // In a real implementation, this would use a pricing service
        const tokenDecimals = 18; // sJOE has 18 decimals
        const amountTokens = Number(BigInt(amountWei)) / Math.pow(10, tokenDecimals);
        const estimatedPricePerToken = 2.5; // Placeholder price
        const amountUsd = amountTokens * estimatedPricePerToken;
        
        // Apply minimum thresholds
        if (amountUsd < Math.max(env.sJoeMinUsd, 1.0)) {
          console.log(`Skipping small reward: ${amountUsd.toFixed(2)} USD < ${Math.max(env.sJoeMinUsd, 1.0)} USD`);
          continue;
        }
        
        const reward: PendingReward = {
          id: `traderjoe-sjoe-${wallet.value}-${Date.now()}`,
          wallet,
          protocol: 'traderjoe',
          token: {
            value: env.sJoeToken,
            chain: 'avalanche'
          },
          amountWei,
          amountUsd,
          claimTo: wallet,
          discoveredAt: new Date(),
          lastClaimAt: undefined
        };
        
        rewards.push(reward);
        console.log(`Found sJOE reward: ${amountUsd.toFixed(2)} USD for ${wallet.value}`);
        
      } catch (error) {
        console.warn(`Failed to check sJOE rewards for ${wallet.value}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Failed to scan sJOE rewards:', error);
  }
  
  return rewards;
}

/**
 * Encode harvest or getReward function call for sJOE staking
 */
function encodeHarvestCall(functionName: 'harvest' | 'getReward' = 'harvest'): string {
  try {
    if (stakingAbi.length === 0) {
      console.warn('sJOE staking ABI not loaded, using fallback function selector');
      // Fallback function selectors if ABI is not available
      if (functionName === 'harvest') {
        return '0x4641257d'; // harvest() function selector
      } else {
        return '0x3d18b912'; // getReward() function selector  
      }
    }
    
    // Create interface from loaded ABI
    const iface = new ethers.Interface(stakingAbi);
    
    // Encode the function call
    const callData = iface.encodeFunctionData(functionName, []);
    console.log(`TraderJoe sJOE: Encoded ${functionName}() call: ${callData}`);
    
    return callData;
  } catch (error) {
    console.warn(`Failed to encode ${functionName}() call:`, error);
    // Return fallback selector
    return functionName === 'harvest' ? '0x4641257d' : '0x3d18b912';
  }
}

/**
 * Build claim bundles for sJOE rewards
 */
async function buildSJoeClaimBundles(rewards: PendingReward[], mockMode: boolean): Promise<ClaimBundle[]> {
  if (rewards.length === 0) {
    return [];
  }
  
  console.log(`TraderJoe sJOE: Building claim bundles for ${rewards.length} rewards...`);
  
  // Validate recipients in non-mock mode
  if (!mockMode) {
    for (const reward of rewards) {
      if (!isAllowedRecipientNonMock(reward.claimTo)) {
        throw new Error(`Invalid recipient ${reward.claimTo.value} not allowed in non-mock mode`);
      }
    }
  }
  
  // Group by recipient (should be only one in practice)
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
    const firstReward = groupedRewards[0];
    const totalUsd = groupedRewards.reduce((sum, r) => sum + r.amountUsd, 0);
    
    // Estimate gas cost (simplified)
    const estGasUsd = 2.5; // Estimated $2.50 for claim transaction
    const netUsd = Math.max(0, totalUsd - estGasUsd);
    
    // Get contract address (fallback to configured default for mock mode)
    const contractAddress = env.traderJoeSJoeStakingAddress || 
      (mockMode ? '0x1a731B2299E22FbAC282E7094EdA41046343Cb51' : undefined);
    
    // Get configurable harvest function name (default to 'harvest')
    // Read directly from process.env to support runtime configuration changes
    const harvestFunction = (process.env.SJOE_HARVEST_FUNCTION === 'getReward') ? 'getReward' : 'harvest';
    const callData = encodeHarvestCall(harvestFunction as 'harvest' | 'getReward');
    
    const bundle: ClaimBundle = {
      id: `traderjoe-sjoe-bundle-${Date.now()}`,
      chain: 'avalanche',
      protocol: 'traderjoe',
      claimTo: firstReward.claimTo,
      items: groupedRewards,
      totalUsd,
      estGasUsd,
      netUsd,
      contractAddress,
      callData,
      value: 0  // No ETH/AVAX value needed for harvest calls
    };
    
    bundles.push(bundle);
    console.log(`TraderJoe sJOE: Created bundle with ${harvestFunction}() call to ${contractAddress}`);
  }
  
  console.log(`TraderJoe sJOE: Created ${bundles.length} claim bundles`);
  return bundles;
}

/**
 * sJOE Integration Export
 */
export const sJoeIntegration: Integration = {
  key: 'traderjoe-sjoe',
  chain: 'avalanche',

  async discoverWallets(mockMode: boolean = false): Promise<Address[]> {
    return await discoverSJoeWallets(mockMode);
  },

  async getPendingRewards(wallets: Address[], mockMode: boolean = false): Promise<PendingReward[]> {
    return await getSJoePendingRewards(wallets, mockMode);
  },

  async buildBundle(rewards: PendingReward[], mockMode: boolean = false): Promise<ClaimBundle[]> {
    return await buildSJoeClaimBundles(rewards, mockMode);
  }
};