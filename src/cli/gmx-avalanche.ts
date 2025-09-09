#!/usr/bin/env node

import { config } from 'dotenv';
import { AvalancheClient } from '../chains/avalanche.js';
import { gmxIntegration } from '../integrations/gmx.js';
import { env } from '../config/env.js';

// Load environment variables once at startup
config();

/**
 * Production-ready GMX Avalanche CLI for discovering and claiming rewards
 */
class GMXAvalancheCLI {
  private provider: AvalancheClient | null = null;

  constructor() {
    this.validateEnvironment();
    this.initializeProvider();
  }

  private validateEnvironment(): void {
    // Check required environment variables
    if (!env.avalancheRpcUrl) {
      console.error('❌ Error: AVAX_RPC_URL is required for scan and collect operations');
      console.error('   Set AVAX_RPC_URL in your .env file');
      process.exit(1);
    }

    if (!env.defaultClaimRecipientAvax) {
      console.error('❌ Error: DEFAULT_CLAIM_RECIPIENT_AVAX is required');
      console.error('   Set DEFAULT_CLAIM_RECIPIENT_AVAX to your controlled wallet address');
      process.exit(1);
    }

    if (!env.walletScanAvax) {
      console.error('❌ Error: WALLET_SCAN_AVAX is required');
      console.error('   Set WALLET_SCAN_AVAX to comma-separated wallet addresses to scan');
      process.exit(1);
    }

    // Validate synthetic mode setting
    if (env.enableSyntheticGmx) {
      console.warn('⚠️  Warning: ENABLE_SYNTHETIC_GMX=true detected');
      console.warn('   This will use mock data for testing. Set ENABLE_SYNTHETIC_GMX=false for real mode');
    } else {
      console.log('✅ Real mode enabled (ENABLE_SYNTHETIC_GMX=false)');
    }
  }

  private initializeProvider(): void {
    // Initialize provider
    this.provider = new AvalancheClient(env.avalancheRpcUrl!);
    console.log(`🔗 Connected to Avalanche RPC: ${env.avalancheRpcUrl}`);
  }

  private validateExecutionEnvironment(): void {
    if (!env.avalanchePrivateKey) {
      console.error('❌ Error: PRIVATE_KEY is required for --execute mode');
      console.error('   Set PRIVATE_KEY in your .env file, or run without --execute for dry-run');
      process.exit(1);
    }

    // Re-initialize provider with wallet for execution
    this.provider = new AvalancheClient(env.avalancheRpcUrl!, env.avalanchePrivateKey);
    console.log('🔑 Wallet initialized for transaction execution');
  }

  async scan(): Promise<void> {
    console.log('\n🔍 GMX Avalanche Scanner');
    console.log('========================');

    try {
      // Discover wallets
      console.log('\n📍 Discovering wallets...');
      const wallets = await gmxIntegration.discoverWallets();
      console.log(`✅ Found ${wallets.length} wallet(s) to scan:`);
      wallets.forEach((wallet, i) => {
        console.log(`   ${i + 1}. ${wallet.value} (${wallet.chain})`);
      });

      if (wallets.length === 0) {
        console.log('ℹ️  No wallets configured for scanning');
        return;
      }

      // Scan for pending rewards
      console.log('\n💰 Scanning for pending rewards...');
      const rewards = await gmxIntegration.getPendingRewards(wallets);
      
      if (rewards.length === 0) {
        console.log('ℹ️  No pending rewards found');
        return;
      }

      console.log(`✅ Found ${rewards.length} pending reward(s):`);
      
      let totalUsd = 0;
      rewards.forEach((reward, i) => {
        console.log(`\n   ${i + 1}. ${reward.protocol.toUpperCase()} Reward:`);
        console.log(`      • Token: ${reward.token.value} (${reward.token.chain})`);
        console.log(`      • Amount: ${reward.amountWei} wei`);
        console.log(`      • USD Value: $${reward.amountUsd.toFixed(2)}`);
        console.log(`      • Wallet: ${reward.wallet.value}`);
        console.log(`      • Tracker: ${reward.id}`);
        totalUsd += reward.amountUsd;
      });

      console.log(`\n💎 Total pending value: $${totalUsd.toFixed(2)} USD`);
      console.log(`\n🎯 Ready to collect! Run with 'collect' command to build claim bundles`);

    } catch (error) {
      console.error('❌ Error during scan:', error);
      process.exit(1);
    }
  }

  async collect(execute: boolean = false): Promise<void> {
    const mode = execute ? 'EXECUTION' : 'DRY-RUN';
    console.log(`\n⚡ GMX Avalanche Collector (${mode})`);
    console.log('================================');

    if (execute) {
      this.validateExecutionEnvironment();
      console.log('🚨 LIVE EXECUTION MODE - Transactions will be broadcast to the blockchain');
    } else {
      console.log('🧪 DRY-RUN MODE - No transactions will be sent');
    }

    try {
      // Discover wallets and rewards
      console.log('\n📍 Discovering wallets and rewards...');
      const wallets = await gmxIntegration.discoverWallets();
      const rewards = await gmxIntegration.getPendingRewards(wallets);

      if (rewards.length === 0) {
        console.log('ℹ️  No pending rewards to collect');
        return;
      }

      console.log(`✅ Found ${rewards.length} reward(s) across ${wallets.length} wallet(s)`);

      // Build claim bundles
      console.log('\n📦 Building claim bundles...');
      const bundles = await gmxIntegration.buildBundle(rewards);

      if (bundles.length === 0) {
        console.log('ℹ️  No profitable bundles to execute');
        return;
      }

      console.log(`✅ Created ${bundles.length} claim bundle(s):`);

      // Show bundle details
      for (const [index, bundle] of bundles.entries()) {
        console.log(`\n   Bundle ${index + 1}:`);
        console.log(`   • ID: ${bundle.id}`);
        console.log(`   • Protocol: ${bundle.protocol.toUpperCase()}`);
        console.log(`   • Chain: ${bundle.chain}`);
        console.log(`   • Recipient: ${bundle.claimTo.value}`);
        console.log(`   • Items: ${bundle.items.length} reward(s)`);
        console.log(`   • Total Value: $${bundle.totalUsd.toFixed(2)}`);
        console.log(`   • Est. Gas Cost: $${bundle.estGasUsd.toFixed(2)}`);
        console.log(`   • Net Profit: $${bundle.netUsd.toFixed(2)}`);
        console.log(`   • Contract: ${bundle.contractAddress}`);
        
        if (bundle.callData && !execute) {
          console.log(`   • Call Data: ${bundle.callData.slice(0, 42)}...`);
        }
      }

      // Execute transactions if in execution mode
      if (execute) {
        console.log('\n🚀 Executing transactions...');
        
        let successCount = 0;
        let failCount = 0;

        for (const [index, bundle] of bundles.entries()) {
          try {
            console.log(`\n📤 Executing bundle ${index + 1}/${bundles.length}...`);
            
            const result = await this.provider!.sendRaw(bundle);
            
            if (result.success) {
              successCount++;
              console.log(`✅ Transaction successful!`);
              console.log(`   • Hash: ${result.txHash || 'N/A'}`);
              console.log(`   • Gas Used: ${result.gasUsed || 'N/A'}`);
              console.log(`   • Gas Cost: $${result.gasUsd?.toFixed(4) || 'N/A'}`);
            } else {
              failCount++;
              console.log(`❌ Transaction failed: ${result.error}`);
            }
          } catch (error) {
            failCount++;
            console.log(`❌ Execution error for bundle ${index + 1}:`, error);
          }
        }

        console.log(`\n📊 Execution Summary:`);
        console.log(`   • Successful: ${successCount}/${bundles.length}`);
        console.log(`   • Failed: ${failCount}/${bundles.length}`);
        
        if (successCount > 0) {
          console.log('🎉 Rewards claimed successfully!');
        }
      } else {
        console.log('\n💡 Dry-run complete. Add --execute to broadcast transactions');
      }

    } catch (error) {
      console.error('❌ Error during collect:', error);
      process.exit(1);
    }
  }

  public printUsage(): void {
    console.log('\nGMX Avalanche CLI - Production-ready reward scanner and collector');
    console.log('\nUsage:');
    console.log('  npm run gmx:scan                    # Discover wallets and list pending rewards (dry run)');
    console.log('  npm run gmx:collect                 # Build claim bundles (dry run)');
    console.log('  npm run gmx:collect -- --execute   # Build and execute claim transactions');
    console.log('\nRequired Environment Variables:');
    console.log('  • ENABLE_SYNTHETIC_GMX=false       # Required for real mode');
    console.log('  • DEFAULT_CLAIM_RECIPIENT_AVAX      # Your controlled wallet address');
    console.log('  • WALLET_SCAN_AVAX                 # Comma-separated addresses to scan');
    console.log('  • AVAX_RPC_URL                     # Avalanche RPC endpoint');
    console.log('  • PRIVATE_KEY                      # Only required for --execute');
    console.log('\nExample:');
    console.log('  AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc \\');
    console.log('  DEFAULT_CLAIM_RECIPIENT_AVAX=0xYourAddress \\');
    console.log('  WALLET_SCAN_AVAX=0xWallet1,0xWallet2 \\');
    console.log('  npm run gmx:scan');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const hasExecuteFlag = args.includes('--execute');

  const cli = new GMXAvalancheCLI();

  switch (command) {
    case 'scan':
      await cli.scan();
      break;
    case 'collect':
      await cli.collect(hasExecuteFlag);
      break;
    case 'help':
    case '--help':
    case '-h':
      cli.printUsage();
      break;
    default:
      console.error('❌ Invalid command:', command);
      cli.printUsage();
      process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}