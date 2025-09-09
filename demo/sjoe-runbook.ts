#!/usr/bin/env node

/**
 * sJOE Integration Runbook
 * Validates complete setup and demonstrates production readiness
 */

import { config } from 'dotenv';
import { validateClaimRecipients } from '../src/config/addresses.js';
import { sJoeIntegration } from '../src/integrations/traderjoe/sjoe.js';
import { existsSync } from 'fs';
import { logger } from '../src/engine/logger.js';

// Load environment variables
config();

async function runValidationChecklist() {
  console.log('🔍 sJOE Integration Production Readiness Checklist');
  console.log('='.repeat(55));
  
  let passed = 0;
  let total = 0;
  
  const check = (condition: boolean, description: string) => {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ ${description}`);
    } else {
      console.log(`❌ ${description}`);
    }
  };

  // Environment Configuration
  console.log('\n📋 Environment Configuration:');
  check(!!process.env.DEFAULT_CLAIM_RECIPIENT_AVAX, 'DEFAULT_CLAIM_RECIPIENT_AVAX configured');
  check(!!process.env.TRADERJOE_SJOE_STAKING_ADDRESS, 'TRADERJOE_SJOE_STAKING_ADDRESS configured');
  check(!!process.env.SJOE_TOKEN_ADDRESS, 'SJOE_TOKEN_ADDRESS configured');
  check(!!process.env.JOE_TOKEN_ADDRESS, 'JOE_TOKEN_ADDRESS configured');
  check(!!process.env.SJOE_MIN_USD, 'SJOE_MIN_USD configured');
  check(!!process.env.AVALANCHE_RPC_URL || !!process.env.PRICER_RPC_AVAX, 'Avalanche RPC URL configured');

  // File Dependencies
  console.log('\n📁 File Dependencies:');
  check(existsSync('./abi/traderjoe_sjoe_staking.json'), 'sJOE staking ABI file exists');
  check(existsSync('./migrations/006_verified_transfers.sql'), 'Database migration file exists');

  // Address Validation
  console.log('\n🛡️  Address Validation:');
  try {
    validateClaimRecipients(false);
    check(true, 'Claim recipient validation passes for non-mock mode');
  } catch (error) {
    check(false, `Claim recipient validation: ${error instanceof Error ? error.message : 'Failed'}`);
  }

  // Integration Discovery
  console.log('\n🔍 Integration Discovery:');
  try {
    const wallets = await sJoeIntegration.discoverWallets(false);
    check(wallets.length > 0, `Wallet discovery successful (${wallets.length} wallets)`);
    
    if (wallets.length > 0) {
      const validAddress = wallets[0].value === process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
      check(validAddress, 'Discovered wallet matches DEFAULT_CLAIM_RECIPIENT_AVAX');
    }
  } catch (error) {
    check(false, `Wallet discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Mock Mode Testing
  console.log('\n🧪 Mock Mode Testing:');
  try {
    const mockWallets = await sJoeIntegration.discoverWallets(true);
    check(mockWallets.length > 0, 'Mock wallet discovery works');
    
    const mockRewards = await sJoeIntegration.getPendingRewards(mockWallets, true);
    check(mockRewards.length > 0, 'Mock reward discovery works');
    
    const mockBundles = await sJoeIntegration.buildBundle(mockRewards, true);
    check(mockBundles.length > 0, 'Mock bundle creation works');
  } catch (error) {
    check(false, `Mock mode testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Security Validations
  console.log('\n🔒 Security Validations:');
  
  // Test seed address blocking
  try {
    const seedWallet = { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' } as const;
    const seedReward = {
      id: 'test',
      wallet: seedWallet,
      protocol: 'traderjoe',
      token: { value: process.env.SJOE_TOKEN_ADDRESS || '', chain: 'avalanche' },
      amountWei: '1000000000000000000',
      amountUsd: 2.0,
      claimTo: seedWallet,
      discoveredAt: new Date(),
      lastClaimAt: undefined
    };
    
    let seedBlocked = false;
    try {
      await sJoeIntegration.buildBundle([seedReward], false);
    } catch (error) {
      seedBlocked = error instanceof Error && error.message.includes('not allowed in non-mock mode');
    }
    check(seedBlocked, 'Seed address patterns are blocked in non-mock mode');
  } catch (error) {
    check(false, 'Seed address blocking test failed');
  }

  // Production Readiness Summary
  console.log('\n📊 Production Readiness Summary:');
  console.log(`   Checks passed: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    console.log('\n🎉 ALL CHECKS PASSED - PRODUCTION READY!');
    console.log('\nNext steps:');
    console.log('1. Set MOCK_MODE=false DRY_RUN_ONLY=true for dry run');
    console.log('2. Set MOCK_MODE=false DRY_RUN_ONLY=false for live execution');
    console.log('3. Monitor logs for profit summaries and verified payouts');
  } else {
    console.log('\n⚠️  PRODUCTION READINESS ISSUES DETECTED');
    console.log('Please resolve the failed checks before proceeding to production.');
    process.exit(1);
  }
}

// Example configurations for reference
function showExampleConfig() {
  console.log('\n📝 Example Production Configuration:');
  console.log('```bash');
  console.log('# Required for production');
  console.log('export DEFAULT_CLAIM_RECIPIENT_AVAX=0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D');
  console.log('export TRADERJOE_SJOE_STAKING_ADDRESS=0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
  console.log('export SJOE_TOKEN_ADDRESS=0x1a731B2299E22FbAC282E7094EdA41046343Cb51');
  console.log('export JOE_TOKEN_ADDRESS=0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd');
  console.log('export SJOE_MIN_USD=1.0');
  console.log('export AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc');
  console.log('export PRIVATE_KEY_AVAX=<your-private-key>');
  console.log('```');
}

// Run the validation
runValidationChecklist()
  .then(() => showExampleConfig())
  .catch(console.error);