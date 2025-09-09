# GMX Avalanche CLI Documentation

A production-ready command-line interface for discovering and claiming GMX rewards on Avalanche C-Chain.

## Prerequisites

1. **Node.js**: Version 20.0.0 or higher
2. **Package Manager**: npm or pnpm
3. **Funded AVAX Account**: For gas fees when executing transactions
4. **Controlled Wallet**: With access to private key for claiming rewards

## Environment Setup

Create a `.env` file in your project root with the following configuration:

### Required Variables

```bash
# Core GMX Configuration
ENABLE_SYNTHETIC_GMX=false                      # Set to false for real mode
DEFAULT_CLAIM_RECIPIENT_AVAX=0xYourEOARecipient # Your controlled wallet
WALLET_SCAN_AVAX=0xWallet1,0xWallet2           # Wallets to scan (comma-separated)
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc # Avalanche RPC endpoint
```

### Optional Variables

```bash
# Private key (only required for --execute mode)
PRIVATE_KEY=0x...                               # Your wallet's private key

# GMX Configuration
GMX_MIN_USD=5.0                                # Minimum USD value threshold
```

### Variable Explanations

- **`ENABLE_SYNTHETIC_GMX`**: Set to `false` for real blockchain operations. When `true`, uses mock data for testing.
- **`DEFAULT_CLAIM_RECIPIENT_AVAX`**: The Avalanche address where claimed rewards will be sent. Must be a wallet you control.
- **`WALLET_SCAN_AVAX`**: Comma-separated list of wallet addresses to scan for pending GMX rewards. No spaces around commas.
- **`AVAX_RPC_URL`**: Avalanche C-Chain RPC endpoint. The default public endpoint is sufficient for most users.
- **`PRIVATE_KEY`**: Your wallet's private key (with 0x prefix). Only required when using `--execute` to broadcast transactions.

## Usage

### 1. Dry Run - Discover Wallets and Scan Rewards

```bash
npm run gmx:scan
```

This command will:
- Discover configured wallets from `WALLET_SCAN_AVAX`
- Scan each wallet for pending GMX rewards (esGMX and fee rewards)
- Display detailed information about found rewards
- Show total USD value of pending rewards
- **No transactions are sent**

### 2. Dry Run - Build Claim Bundles

```bash
npm run gmx:collect
```

This command will:
- Discover wallets and scan for rewards
- Build optimized claim bundles for efficient gas usage
- Show bundle details including gas estimates
- Display encoded calldata for transactions
- **No transactions are sent**

### 3. Live Execution - Execute Claim Transactions

```bash
npm run gmx:collect -- --execute
```

⚠️ **WARNING**: This will broadcast real transactions to the Avalanche blockchain.

This command will:
- Perform all steps from the dry run
- Execute transactions using your `PRIVATE_KEY`
- Broadcast claim transactions to the blockchain
- Display transaction hashes and gas costs
- Show execution summary with success/failure counts

## Example Output

### Scan Output
```
🔍 GMX Avalanche Scanner
========================

📍 Discovering wallets...
✅ Found 2 wallet(s) to scan:
   1. 0x1234...5678 (avalanche)
   2. 0xabcd...ef90 (avalanche)

💰 Scanning for pending rewards...
✅ Found 3 pending reward(s):

   1. GMX Reward:
      • Token: 0xFf1489227BbAAC61a9209A08929E4c2a526DdD17 (avalanche)
      • Amount: 2500000000000000000 wei
      • USD Value: $62.50
      • Wallet: 0x1234...5678
      • Tracker: gmx-es-gmx-0x1234...5678-1234567890

💎 Total pending value: $125.75 USD
```

### Collect Output (Dry Run)
```
⚡ GMX Avalanche Collector (DRY-RUN)
================================

📦 Building claim bundles...
✅ Created 1 claim bundle(s):

   Bundle 1:
   • ID: gmx-bundle-1234567890
   • Protocol: GMX
   • Chain: avalanche
   • Recipient: 0x1234...5678
   • Items: 2 reward(s)
   • Total Value: $125.75
   • Est. Gas Cost: $1.25
   • Net Profit: $124.50
   • Contract: 0x82147C5A7E850eA4E28155DF107F2590fD4ba327
   • Call Data: 0x48cd4cb1000000000000000000000000000000000000...

💡 Dry-run complete. Add --execute to broadcast transactions
```

### Collect Output (Live Execution)
```
⚡ GMX Avalanche Collector (EXECUTION)
================================
🚨 LIVE EXECUTION MODE - Transactions will be broadcast to the blockchain

🚀 Executing transactions...

📤 Executing bundle 1/1...
✅ Transaction successful!
   • Hash: 0xabc123...def789
   • Gas Used: 285000
   • Gas Cost: $1.14

📊 Execution Summary:
   • Successful: 1/1
   • Failed: 0/1
🎉 Rewards claimed successfully!
```

## Operational Tips

### Frequency
- **Development/Testing**: Run scans frequently to monitor rewards
- **Production**: Consider running 1-2 times per day or when significant rewards accumulate
- **Gas Optimization**: Wait for multiple rewards to accumulate for more efficient bundling

### Gas Considerations
- **Network Congestion**: Gas prices can vary significantly on Avalanche
- **Bundle Size**: Larger bundles are more gas-efficient per reward
- **Minimum Thresholds**: Ensure rewards exceed gas costs (check `GMX_MIN_USD` setting)

### Safe Wallet Practices
- **Private Key Security**: Never commit your private key to version control
- **Environment Files**: Add `.env` to your `.gitignore` file
- **Hardware Wallets**: Consider using hardware wallet integration for production
- **Test First**: Always run dry-run mode before executing transactions

### Monitoring and Alerts
- **Transaction Monitoring**: Keep track of transaction hashes for record-keeping
- **Failed Transactions**: Investigate failures - they may indicate configuration issues
- **Reward Tracking**: Monitor claimed amounts vs. expected amounts

## Troubleshooting

### Common Issues

1. **"AVAX_RPC_URL is required"**
   - Solution: Set `AVAX_RPC_URL` in your `.env` file

2. **"DEFAULT_CLAIM_RECIPIENT_AVAX is required"**
   - Solution: Set your controlled wallet address in `DEFAULT_CLAIM_RECIPIENT_AVAX`

3. **"WALLET_SCAN_AVAX is required"**
   - Solution: Set comma-separated wallet addresses to scan

4. **"PRIVATE_KEY is required for --execute mode"**
   - Solution: Set your private key in `.env` or run without `--execute` for dry-run

5. **"No pending rewards found"**
   - Check if wallets have GMX staking positions
   - Verify reward accumulation period
   - Ensure wallets have been active in GMX protocol

6. **Transaction failures**
   - Check wallet has sufficient AVAX for gas
   - Verify network connectivity
   - Check if rewards were already claimed

### RPC Endpoint Issues
- **Rate Limiting**: Public endpoints may have rate limits
- **Alternative Endpoints**: Consider using Infura, Alchemy, or other providers
- **Network Issues**: Check Avalanche network status

### Debug Mode
For additional debugging information, you can examine the underlying integration:
- The CLI uses the existing `gmxIntegration` from `src/integrations/gmx.ts`
- Check console output for detailed contract interaction logs
- Verify wallet addresses are properly formatted (with 0x prefix)

## Security Considerations

- **Private Keys**: Store securely and never share
- **Environment Variables**: Use `.env` files and never commit secrets
- **Network Security**: Use HTTPS RPC endpoints
- **Wallet Validation**: Ensure recipient addresses are controlled by you
- **Amount Verification**: Always verify claimed amounts match expectations

## Support

For issues specific to this CLI:
1. Check your environment configuration
2. Verify wallet balances and positions
3. Test with synthetic mode first (`ENABLE_SYNTHETIC_GMX=true`)
4. Review transaction history on Avalanche explorer

For GMX protocol questions, refer to the official GMX documentation and community channels.