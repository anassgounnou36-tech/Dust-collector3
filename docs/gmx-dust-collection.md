# GMX Dust Collection v2 - Multi-Source Wallet Discovery

## Overview

The GMX Dust Collection feature implements a comprehensive wallet discovery and scanning system for Avalanche that **only** discovers and transfers loose ERC20 balances held by wallets. This is completely separate from the existing GMX staking integration and does not perform any staking/unstaking operations or claimable reward calls.

## New Features in v2

- **Multi-Source Wallet Discovery**: Fetch wallet addresses from Covalent, Bitquery, SnowTrace APIs, or local files
- **Batched Wallet Scanner**: Process large wallet lists with throttling, retries, and rate limiting
- **Enhanced CLI**: New `wallets:fetch` command for wallet discovery and improved `gmx:dust` with file support
- **Production Safety**: Dry-run by default, explicit confirmation required for live execution
- **Comprehensive Testing**: Unit tests, integration tests, and E2E smoke tests

## Key Features

- **Zero Staking Operations**: Only scans loose ERC20 token balances via `balanceOf()` calls
- **Gas-Only Risk**: No capital risk, only gas costs for transactions
- **Configurable Tokens**: Default set (GMX, USDC, WETH.e, WAVAX) with override support
- **USD Filtering**: Only processes tokens above minimum USD threshold
- **Dry-Run Mode**: Safe testing without broadcasting transactions
- **Mock Mode**: Testing with synthetic data

## Wallet Discovery Pipeline

### Step 1: Fetch Wallets from Multiple Sources

Use the new `wallets:fetch` CLI to discover wallet addresses from public APIs:

```bash
# Fetch from all configured sources (requires API keys)
npm run wallets:fetch

# Fetch from specific source
npm run wallets:fetch -- --source covalent --limit 1000

# Use custom token address
npm run wallets:fetch -- --token 0x62edc0692BD897D2295872a9FFCac5425011c661 --output ./my-wallets.csv

# Import from local file
npm run wallets:fetch -- --source file --file=./my-wallet-list.csv
```

### Step 2: Scan Wallets for GMX Dust

Use the enhanced `gmx:dust` CLI to scan discovered wallets:

```bash
# Scan wallets from generated CSV file
npm run gmx:dust scan -- --wallets-file ./data/wallets.csv

# Collect (dry-run) from discovered wallets
npm run gmx:dust collect -- --wallets-file ./data/wallets.csv

# Execute actual transfers (requires private key and confirmation)
npm run gmx:dust collect --execute -- --wallets-file ./data/wallets.csv
```

### Step 3: Review Results

Check the accepted wallets file for qualifying candidates:

```bash
cat ./data/accepted-wallets.csv
```

## API Key Setup

### Required Environment Variables

Add these to your `.env` file:

```bash
# API keys for wallet discovery (at least one required)
COVALENT_API_KEY=ckey_abc123...
BITQUERY_API_KEY=BQYabc123...
SNOWTRACE_API_KEY=ABC123...

# Fetch configuration
WALLET_FETCH_PAGE_SIZE=1000
WALLET_FETCH_LIMIT=5000
WALLET_FETCH_CONCURRENCY=4

# Rate limiting
RPC_CONCURRENCY=8
RPC_RATE_LIMIT=10

# File paths
DEFAULT_WALLETS_FILE=./data/wallets.csv
ACCEPTED_WALLETS_FILE=./data/accepted-wallets.csv

# Safety (recommended)
DRY_RUN_ONLY=true
```

### Obtaining API Keys

1. **Covalent API Key**:
   - Visit [Covalent API](https://www.covalenthq.com/platform/auth/register/)
   - Register for free tier (100k requests/month)
   - Copy API key to `COVALENT_API_KEY`

2. **Bitquery API Key**:
   - Visit [Bitquery](https://bitquery.io/)
   - Sign up for GraphQL API access
   - Copy API key to `BITQUERY_API_KEY`

3. **SnowTrace API Key**:
   - Visit [SnowTrace](https://snowtrace.io/apis)
   - Register for free API key
   - Copy API key to `SNOWTRACE_API_KEY`

### Basic Commands

```bash
# Scan for dust balances (dry-run)
npm run gmx:dust scan

# Build transfer bundles (dry-run) 
npm run gmx:dust collect

# Execute transfers (live transactions)
npm run gmx:dust collect --execute

# Show help
npm run gmx:dust help
```

### Environment Configuration

#### Required Variables

```bash
DEFAULT_CLAIM_RECIPIENT_AVAX=0xYourControlledWallet  # Where tokens will be transferred
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc   # Avalanche RPC endpoint
PRIVATE_KEY=0xYourPrivateKey                         # Only required for --execute
```

#### Optional Variables

```bash
# Wallet Discovery
WALLET_SCAN_AVAX=0xWallet1,0xWallet2,0xWallet3      # Comma-separated addresses to scan

# Token Configuration  
GMX_DUST_TOKENS=0xToken1,0xToken2,0xToken3          # Custom token addresses (overrides defaults)
GMX_ITEM_MIN_USD=0.50                               # Minimum USD value per token (default: 0.50)

# Pricing
AVAX_PRICE_USD=40.0                                 # AVAX price for gas calculations (default: 40.0)
GMX_PRICE_USD=25.0                                  # Per-token USD prices
USDC_PRICE_USD=1.0
WETH_PRICE_USD=3000.0
WAVAX_PRICE_USD=40.0

# Testing
MOCK_MODE=true                                      # Use synthetic test data
```

### Default Tokens

When `GMX_DUST_TOKENS` is not specified, these tokens are scanned:

| Token | Address | Symbol |
|-------|---------|--------|
| GMX | `0x62edc0692BD897D2295872a9FFCac5425011c661` | GMX |
| USDC | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | USDC |
| WETH.e | `0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB` | WETH.e |
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` | WAVAX |

## Examples

### Basic Scan
```bash
DEFAULT_CLAIM_RECIPIENT_AVAX=0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5 \
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc \
npm run gmx:dust scan
```

### Custom Token Set
```bash
DEFAULT_CLAIM_RECIPIENT_AVAX=0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5 \
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc \
GMX_DUST_TOKENS=0x62edc0692BD897D2295872a9FFCac5425011c661,0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E \
GMX_ITEM_MIN_USD=1.0 \
npm run gmx:dust scan
```

### Mock Mode Testing
```bash
MOCK_MODE=true \
DEFAULT_CLAIM_RECIPIENT_AVAX=0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5 \
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc \
npm run gmx:dust collect
```

### Live Execution
```bash
DEFAULT_CLAIM_RECIPIENT_AVAX=0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5 \
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc \
PRIVATE_KEY=0xYourPrivateKey \
npm run gmx:dust collect --execute
```

## Safety Features

- **Dry-Run Default**: All operations are dry-run by default unless `--execute` is specified
- **Mock Mode**: Use `MOCK_MODE=true` for safe testing with synthetic data
- **Gas Estimation**: Shows estimated gas costs and net profit before execution
- **Address Validation**: Validates recipient addresses in non-mock mode
- **No Staking Risk**: Only operates on loose token balances, never touches staking

## Output Examples

### Scan Output
```
🧹 GMX Dust Collection Scanner
==============================
Scanning for loose ERC20 token balances (no staking rewards)

📍 Discovering wallets...
✅ Found 2 wallet(s) to scan:
   1. 0x1111111111111111111111111111111111111111 (avalanche)
   2. 0x2222222222222222222222222222222222222222 (avalanche)

🪙 Token Configuration:
   • Scanning tokens: 4 configured
   • Minimum USD value: $0.5
   • AVAX price (for gas calc): $40
   • Using default GMX token set

💰 Scanning for token balances...
✅ Found 2 qualifying token balance(s):

   1. GMX Balance:
      • Token: 0x62edc0692BD897D2295872a9FFCac5425011c661
      • Amount: 0.050000 GMX
      • USD Value: $1.25
      • Wallet: 0x1111111111111111111111111111111111111111

   2. USDC Balance:
      • Token: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
      • Amount: 0.750000 USDC  
      • USD Value: $0.75
      • Wallet: 0x2222222222222222222222222222222222222222

💎 Total dust value: $2.00 USD
🎯 Ready to collect! Run with 'collect' command to transfer to recipient
```

### Collect Output (Dry-Run)
```
⚡ GMX Dust Collector (DRY-RUN)
=============================
Collecting loose ERC20 balances only (no staking operations)
🧪 DRY-RUN MODE - No transactions will be sent

📦 Building transfer bundles...
✅ Created 2 transfer bundle(s):

   Bundle 1 (GMX):
   • Token Contract: 0x62edc0692BD897D2295872a9FFCac5425011c661
   • Balances: 1 wallet(s)
   • Total Value: $1.25
   • Est. Gas Cost: $0.07
   • Net Value: $1.19
   • Recipient: 0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5
   • Action: transfer() to recipient

💡 Dry-run Summary:
   • Would transfer: $2.00 in 2 transactions  
   • Estimated gas: $0.13
   • Net benefit: $1.87

💡 Add --execute to broadcast transactions
```

### Live Execution Output
```
⚡ GMX Dust Collector (EXECUTION)
=============================
🚨 LIVE EXECUTION MODE - Transactions will be broadcast to the blockchain

🚀 Executing transfers...

📤 Executing GMX transfer 1/2...
✅ GMX Dust: transferred $1.25 GMX to 0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5
   • Hash: 0xabc123...
   • Gas Used: 65,000
   • Gas Cost: $0.065

📊 Transfer Summary:
   • Successful: 2/2
   • Failed: 0/2  
   • Total Transferred: $2.00
🎉 Dust collection completed successfully!
```

## Relationship to Existing GMX Integration

The dust collection feature is completely separate from the existing GMX staking integration:

- **Existing GMX Integration**: Handles staking rewards via `claimable()` calls and `handleRewards()`
- **New Dust Integration**: Only handles loose ERC20 balances via `balanceOf()` and `transfer()`

### Disabling Staking Integration

To disable the staking integration (as required), set:

```bash
ENABLE_GMX_STAKING=false
```

This will cause the original GMX integration to skip all staking operations and direct users to use the dust collection feature instead.

## Technical Details

### Token Balance Detection
- Uses ERC20 `balanceOf(address)` to check token balances
- Fetches token metadata via `symbol()` and `decimals()` calls
- No interaction with staking contracts or reward trackers

### Transfer Mechanism  
- Uses ERC20 `transfer(address,uint256)` to move tokens
- Each token type requires a separate transaction
- Transfers entire balance of each token to the configured recipient

### Gas Estimation
- Uses 65,000 gas limit per ERC20 transfer (standard)
- Calculates USD cost based on 25 gwei gas price and AVAX price
- Shows net profit after gas costs

### Pricing
- Per-token USD prices from environment variables
- Fallback to hardcoded estimates if env vars not set
- Unknown tokens show as $0.00 value and are included in logs for transparency