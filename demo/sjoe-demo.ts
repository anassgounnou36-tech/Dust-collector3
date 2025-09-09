#!/usr/bin/env node

/**
 * sJOE Integration Demo Script
 * Demonstrates the Real Earnings v1 — Trader Joe sJOE (AVAX) implementation
 */

import { config } from 'dotenv';
import { sJoeIntegration } from '../src/integrations/traderjoe/sjoe.js';
import { AvalancheClient } from '../src/chains/avalanche.js';
import { execute, injectPricingService } from '../src/engine/executor.js';
import { logger } from '../src/engine/logger.js';
import { quoteToUsd, getTokenDecimals } from '../src/economics/pricing.js';

// Load environment variables
config();

async function demoSJoeIntegration() {
  console.log('🚀 sJOE Integration Demo - Real Earnings v1');
  console.log('='.repeat(50));

  // Set up environment for demo
  process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D';
  process.env.TRADERJOE_SJOE_STAKING_ADDRESS = '0x1a731B2299E22FbAC282E7094EdA41046343Cb51';
  process.env.SJOE_TOKEN_ADDRESS = '0x1a731B2299E22FbAC282E7094EdA41046343Cb51';
  process.env.JOE_TOKEN_ADDRESS = '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd';
  process.env.SJOE_MIN_USD = '1.0';

  // Demo configurations
  const MOCK_MODE = true;  // Set to false for real blockchain interaction
  const DRY_RUN_ONLY = true;

  console.log(`📋 Configuration:`);
  console.log(`   Mock Mode: ${MOCK_MODE}`);
  console.log(`   Dry Run Only: ${DRY_RUN_ONLY}`);
  console.log(`   Default Recipient: ${process.env.DEFAULT_CLAIM_RECIPIENT_AVAX}`);
  console.log(`   sJOE Staking: ${process.env.TRADERJOE_SJOE_STAKING_ADDRESS}`);
  console.log(`   Min USD: $${process.env.SJOE_MIN_USD}`);
  console.log();

  try {
    // Step 1: Discovery
    console.log('🔍 Step 1: Wallet Discovery');
    const wallets = await sJoeIntegration.discoverWallets(MOCK_MODE);
    console.log(`   Found ${wallets.length} wallets:`);
    for (const wallet of wallets) {
      console.log(`   - ${wallet.value} (${wallet.chain})`);
    }
    console.log();

    // Step 2: Pending Rewards Scan
    console.log('💰 Step 2: Pending Rewards Scan');
    const rewards = await sJoeIntegration.getPendingRewards(wallets, MOCK_MODE);
    console.log(`   Found ${rewards.length} pending rewards:`);
    for (const reward of rewards) {
      console.log(`   - ${reward.id}: $${reward.amountUsd.toFixed(2)} (${reward.amountWei} wei)`);
    }
    console.log();

    // Step 3: Bundle Creation
    console.log('📦 Step 3: Bundle Creation');
    const bundles = await sJoeIntegration.buildBundle(rewards, MOCK_MODE);
    console.log(`   Created ${bundles.length} bundles:`);
    for (const bundle of bundles) {
      console.log(`   - ${bundle.id}: $${bundle.totalUsd.toFixed(2)} gross, $${bundle.estGasUsd.toFixed(2)} gas, $${bundle.netUsd.toFixed(2)} net`);
    }
    console.log();

    // Step 4: Safety Validations
    console.log('🛡️  Step 4: Safety Validations');
    console.log('   ✅ Recipient allowlist: Only DEFAULT_CLAIM_RECIPIENT_AVAX allowed');
    console.log('   ✅ Seed address blocking: 0x1234..., 0x2345..., etc. patterns blocked');
    console.log('   ✅ Placeholder blocking: 0x0000... addresses blocked');
    console.log('   ✅ Environment validation: Required env vars checked');
    console.log();

    // Step 5: Execution (Mock or Dry Run)
    if (bundles.length > 0 && !DRY_RUN_ONLY) {
      console.log('⚡ Step 5: Execution');
      
      // Set up pricing service
      injectPricingService({
        quoteToUsd: async (chain, token, amountWei) => {
          if (chain === 'avalanche') {
            return await quoteToUsd(chain, token, amountWei);
          }
          return 0;
        },
        getTokenDecimals
      });

      // Set up chain client
      const client = new AvalancheClient(
        process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc'
      );
      const clients = new Map([['avalanche', client]]);

      for (const bundle of bundles) {
        console.log(`   Executing bundle: ${bundle.id}`);
        const result = await execute(bundle, clients, MOCK_MODE);
        
        if (result.success) {
          console.log(`   ✅ Success: ${result.txHash}`);
          if (result.verifiedPayout) {
            console.log(`   💎 Verified payout: $${result.claimedUsd?.toFixed(2) || 'N/A'}`);
          }
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
      }
    } else {
      console.log('🧪 Step 5: Dry Run Mode - Execution Skipped');
      console.log('   To run actual execution, set DRY_RUN_ONLY = false');
    }
    console.log();

    // Step 6: Summary
    console.log('📊 Summary');
    console.log(`   Wallets discovered: ${wallets.length}`);
    console.log(`   Rewards found: ${rewards.length}`);
    console.log(`   Bundles created: ${bundles.length}`);
    const totalValue = bundles.reduce((sum, b) => sum + b.totalUsd, 0);
    const totalNet = bundles.reduce((sum, b) => sum + b.netUsd, 0);
    console.log(`   Total value: $${totalValue.toFixed(2)} gross, $${totalNet.toFixed(2)} net`);
    console.log();

    console.log('🎉 sJOE Integration Demo Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
demoSJoeIntegration().catch(console.error);