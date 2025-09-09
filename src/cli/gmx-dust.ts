#!/usr/bin/env node

import { config } from 'dotenv';
import { AvalancheClient } from '../chains/avalanche.js';
import { gmxDustIntegration } from '../integrations/gmx-dust.js';
import { env } from '../config/env.js';

// Load environment variables once at startup
config();

/**
 * Production-ready GMX Dust Collection CLI for Avalanche
 * Only collects loose ERC20 balances - no staking/unstaking/claimable calls
 */
class GMXDustCLI {
  private provider: AvalancheClient | null = null;

  constructor() {
    this.validateEnvironment();
    this.initializeProvider();
  }

  private validateEnvironment(): void {
    // Check required environment variables
    if (!env.avalancheRpcUrl) {
      console.error('❌ Error: AVAX_RPC_URL is required');
      console.error('   Set AVAX_RPC_URL in your .env file');
      process.exit(1);
    }

    if (!env.defaultClaimRecipientAvax) {
      console.error('❌ Error: DEFAULT_CLAIM_RECIPIENT_AVAX is required');
      console.error('   Set DEFAULT_CLAIM_RECIPIENT_AVAX to your controlled wallet address');
      process.exit(1);
    }

    console.log('✅ Environment validation passed');
  }

  private initializeProvider(): void {
    // Initialize provider (read-only)
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
    console.log('\n🧹 GMX Dust Collection Scanner');
    console.log('==============================');
    console.log('Scanning for loose ERC20 token balances (no staking rewards)');

    try {
      // Discover wallets
      console.log('\n📍 Discovering wallets...');
      const wallets = await gmxDustIntegration.discoverWallets();
      console.log(`✅ Found ${wallets.length} wallet(s) to scan:`);
      wallets.forEach((wallet, i) => {
        console.log(`   ${i + 1}. ${wallet.value} (${wallet.chain})`);
      });

      if (wallets.length === 0) {
        console.log('ℹ️  No wallets configured for scanning');
        console.log('   Set WALLET_SCAN_AVAX with comma-separated addresses');
        return;
      }

      // Display token configuration
      console.log('\n🪙 Token Configuration:');
      const dustTokens = env.gmxDustTokens ? 
        env.gmxDustTokens.split(',').map(addr => addr.trim()) : 
        ['GMX', 'USDC', 'WETH.e', 'WAVAX'];
      console.log(`   • Scanning tokens: ${dustTokens.length} configured`);
      console.log(`   • Minimum USD value: $${env.gmxItemMinUsd}`);
      console.log(`   • AVAX price (for gas calc): $${env.avaxPriceUsd}`);
      if (env.gmxDustTokens) {
        console.log(`   • Custom tokens: ${env.gmxDustTokens}`);
      } else {
        console.log(`   • Using default GMX token set`);
      }

      // Scan for token balances
      console.log('\n💰 Scanning for token balances...');
      const rewards = await gmxDustIntegration.getPendingRewards(wallets);
      
      if (rewards.length === 0) {
        console.log('ℹ️  No qualifying token balances found');
        console.log(`   (balances below $${env.gmxItemMinUsd} threshold are ignored)`);
        return;
      }

      console.log(`✅ Found ${rewards.length} qualifying token balance(s):`);
      
      let totalUsd = 0;
      rewards.forEach((reward, i) => {
        const tokenSymbol = reward.id.split('-')[2] || 'TOKEN';
        const amountTokens = Number(reward.amountWei) / Math.pow(10, 18); // Simplified for display
        
        console.log(`\n   ${i + 1}. ${tokenSymbol} Balance:`);
        console.log(`      • Token: ${reward.token.value}`);
        console.log(`      • Amount: ${amountTokens.toFixed(6)} ${tokenSymbol}`);
        console.log(`      • USD Value: $${reward.amountUsd.toFixed(2)}`);
        console.log(`      • Wallet: ${reward.wallet.value}`);
        totalUsd += reward.amountUsd;
      });

      console.log(`\n💎 Total dust value: $${totalUsd.toFixed(2)} USD`);
      console.log(`\n🎯 Ready to collect! Run with 'collect' command to transfer to recipient`);

    } catch (error) {
      console.error('❌ Error during scan:', error);
      process.exit(1);
    }
  }

  async collect(execute: boolean = false): Promise<void> {
    const mode = execute ? 'EXECUTION' : 'DRY-RUN';
    console.log(`\n⚡ GMX Dust Collector (${mode})`);
    console.log('=============================');
    console.log('Collecting loose ERC20 balances only (no staking operations)');

    if (execute) {
      this.validateExecutionEnvironment();
      console.log('🚨 LIVE EXECUTION MODE - Transactions will be broadcast to the blockchain');
    } else {
      console.log('🧪 DRY-RUN MODE - No transactions will be sent');
    }

    try {
      // Discover wallets and token balances
      console.log('\n📍 Discovering wallets and token balances...');
      const wallets = await gmxDustIntegration.discoverWallets();
      const rewards = await gmxDustIntegration.getPendingRewards(wallets);

      if (rewards.length === 0) {
        console.log('ℹ️  No qualifying token balances to collect');
        console.log(`   (balances below $${env.gmxItemMinUsd} threshold are ignored)`);
        return;
      }

      console.log(`✅ Found ${rewards.length} token balance(s) across ${wallets.length} wallet(s)`);

      // Show recipient configuration
      console.log(`\n📤 Transfer Configuration:`);
      console.log(`   • Recipient: ${env.defaultClaimRecipientAvax}`);
      console.log(`   • Transfer method: ERC20 transfer() calls`);
      console.log(`   • Gas estimation: ~65,000 gas per token`);

      // Build transfer bundles
      console.log('\n📦 Building transfer bundles...');
      const bundles = await gmxDustIntegration.buildBundle(rewards);

      if (bundles.length === 0) {
        console.log('ℹ️  No profitable transfers to execute');
        return;
      }

      console.log(`✅ Created ${bundles.length} transfer bundle(s):`);

      // Show bundle details
      for (const [index, bundle] of bundles.entries()) {
        const tokenSymbol = bundle.id.includes('GMX') ? 'GMX' : 
                           bundle.id.includes('USDC') ? 'USDC' :
                           bundle.id.includes('WETH') ? 'WETH.e' :
                           bundle.id.includes('WAVAX') ? 'WAVAX' : 'TOKEN';
        
        console.log(`\n   Bundle ${index + 1} (${tokenSymbol}):`);
        console.log(`   • Token Contract: ${bundle.contractAddress}`);
        console.log(`   • Balances: ${bundle.items.length} wallet(s)`);
        console.log(`   • Total Value: $${bundle.totalUsd.toFixed(2)}`);
        console.log(`   • Est. Gas Cost: $${bundle.estGasUsd.toFixed(2)}`);
        console.log(`   • Net Value: $${bundle.netUsd.toFixed(2)}`);
        console.log(`   • Recipient: ${bundle.claimTo.value}`);
        
        if (!execute) {
          console.log(`   • Action: transfer() to recipient`);
        }
      }

      // Execute transactions if in execution mode
      if (execute) {
        console.log('\n🚀 Executing transfers...');
        
        let successCount = 0;
        let failCount = 0;
        let totalTransferred = 0;

        for (const [index, bundle] of bundles.entries()) {
          try {
            const tokenSymbol = bundle.id.includes('GMX') ? 'GMX' : 
                               bundle.id.includes('USDC') ? 'USDC' :
                               bundle.id.includes('WETH') ? 'WETH.e' :
                               bundle.id.includes('WAVAX') ? 'WAVAX' : 'TOKEN';
            
            console.log(`\n📤 Executing ${tokenSymbol} transfer ${index + 1}/${bundles.length}...`);
            
            const result = await this.provider!.sendRaw(bundle);
            
            if (result.success) {
              successCount++;
              totalTransferred += bundle.totalUsd;
              console.log(`✅ GMX Dust: transferred $${bundle.totalUsd.toFixed(2)} ${tokenSymbol} to ${bundle.claimTo.value}`);
              console.log(`   • Hash: ${result.txHash || 'N/A'}`);
              console.log(`   • Gas Used: ${result.gasUsed || 'N/A'}`);
              console.log(`   • Gas Cost: $${result.gasUsd?.toFixed(4) || 'N/A'}`);
            } else {
              failCount++;
              console.log(`❌ Transfer failed: ${result.error}`);
            }
          } catch (error) {
            failCount++;
            console.log(`❌ Execution error for bundle ${index + 1}:`, error);
          }
        }

        console.log(`\n📊 Transfer Summary:`);
        console.log(`   • Successful: ${successCount}/${bundles.length}`);
        console.log(`   • Failed: ${failCount}/${bundles.length}`);
        console.log(`   • Total Transferred: $${totalTransferred.toFixed(2)}`);
        
        if (successCount > 0) {
          console.log('🎉 Dust collection completed successfully!');
        }
      } else {
        const totalValue = bundles.reduce((sum, b) => sum + b.totalUsd, 0);
        const totalGas = bundles.reduce((sum, b) => sum + b.estGasUsd, 0);
        const totalNet = bundles.reduce((sum, b) => sum + b.netUsd, 0);
        
        console.log(`\n💡 Dry-run Summary:`);
        console.log(`   • Would transfer: $${totalValue.toFixed(2)} in ${bundles.length} transactions`);
        console.log(`   • Estimated gas: $${totalGas.toFixed(2)}`);
        console.log(`   • Net benefit: $${totalNet.toFixed(2)}`);
        console.log(`\n💡 Add --execute to broadcast transactions`);
      }

    } catch (error) {
      console.error('❌ Error during collect:', error);
      process.exit(1);
    }
  }

  public printUsage(): void {
    console.log('\nGMX Dust Collection CLI - Collect loose ERC20 balances (Avalanche)');
    console.log('\nUsage:');
    console.log('  npm run gmx:dust scan                # Discover wallets and list token balances (dry run)');
    console.log('  npm run gmx:dust collect            # Build transfer bundles (dry run)');
    console.log('  npm run gmx:dust collect --execute  # Execute ERC20 transfers');
    console.log('\nRequired Environment Variables:');
    console.log('  • DEFAULT_CLAIM_RECIPIENT_AVAX      # Your controlled wallet address (where tokens go)');
    console.log('  • AVAX_RPC_URL                     # Avalanche RPC endpoint');
    console.log('  • PRIVATE_KEY                      # Only required for --execute');
    console.log('\nOptional Environment Variables:');
    console.log('  • WALLET_SCAN_AVAX                 # Comma-separated addresses to scan (defaults to recipient)');
    console.log('  • GMX_DUST_TOKENS                  # Custom token addresses (defaults to GMX,USDC,WETH.e,WAVAX)');
    console.log('  • GMX_ITEM_MIN_USD                 # Minimum USD value per token (default: 0.50)');
    console.log('  • AVAX_PRICE_USD                   # AVAX price for gas calculations (default: 40.0)');
    console.log('  • <TOKEN>_PRICE_USD                # Per-token USD prices (e.g., GMX_PRICE_USD=25.0)');
    console.log('\nExample:');
    console.log('  AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc \\');
    console.log('  DEFAULT_CLAIM_RECIPIENT_AVAX=0xYourAddress \\');
    console.log('  WALLET_SCAN_AVAX=0xWallet1,0xWallet2 \\');
    console.log('  GMX_ITEM_MIN_USD=1.0 \\');
    console.log('  npm run gmx:dust scan');
    console.log('\nSafety:');
    console.log('  • Only operates on loose ERC20 balances (no staking/unstaking)');
    console.log('  • Gas-only risk - no capital risk');
    console.log('  • Dry-run mode available for testing');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const hasExecuteFlag = args.includes('--execute');

  const cli = new GMXDustCLI();

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