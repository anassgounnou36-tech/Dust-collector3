# GMX Integration Documentation

## Overview

The GMX integration provides real reward discovery and claim bundling for GMX RewardRouterV2 on Avalanche C-Chain. It discovers pending esGMX and fee rewards, calculates USD values, and creates optimized claim bundles.

## Features

- **Real Reward Discovery**: Scans pending esGMX rewards and fee rewards (WETH and AVAX) from GMX staking
- **USD Pricing**: Estimates USD values of discovered rewards for filtering and prioritization  
- **Bundle Creation**: Creates optimized claim bundles with appropriate contract calls
- **Safety Checks**: Validates recipients and enforces minimum thresholds
- **Filters**: Applies minimum USD thresholds to avoid claiming dust rewards
- **Fallback Support**: Graceful handling of ABI loading errors with fallback function selectors

## Contract Addresses (Avalanche)

```typescript
const GMX_CONTRACTS = {
  // Core contracts
  GMX_TOKEN: '0x62edc0692BD897D2295872a9FFCac5425011c661',
  ES_GMX_TOKEN: '0xFf1489227BbAAC61a9209A08929E4c2a526DdD17',
  
  // Main router for claiming rewards
  REWARD_ROUTER_V2: '0x82147C5A7E850eA4E28155DF107F2590fD4ba327',
  
  // Tracking contracts
  STAKED_GMX_TRACKER: '0x908C4D94D34924765f1eDc22A1DD098397c59dD4',
  STAKED_GLP_TRACKER: '0x1aDDD80E6039594eE970E5872D247bf0414C8903',
  FEE_GMX_TRACKER: '0xd2D1162512F927a7e282Ef43a362659E4F2a728F',
  FEE_GLP_TRACKER: '0x4e971a87900b931fF39d1Aad67697F49835400b6',
  
  // Reward tokens
  WETH: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  WAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'
};
```

## Reward Types

### esGMX Rewards
- **Source**: Staked GMX positions
- **Token**: Escrowed GMX (ES_GMX_TOKEN)
- **Function**: `claimableEsGmx(address)`
- **Claim**: `claimEsGmx()` or `compound()`

### GMX Fee Rewards (WETH)
- **Source**: GMX staking fees
- **Token**: WETH  
- **Function**: `claimableFeeGmx(address)`
- **Claim**: `claimFees()` or `compound()`

### GLP Fee Rewards (AVAX)
- **Source**: GLP staking fees
- **Token**: WAVAX
- **Function**: `claimableFeeGlp(address)`
- **Claim**: `claimFees()` or `compound()`

## Configuration

### Environment Variables

```bash
# GMX specific configuration
GMX_MIN_USD=5.0                                    # Minimum reward value in USD
GMX_REWARD_ROUTER_V2_ABI_PATH=./abi/gmx_reward_router_v2.json

# Required for real mode
DEFAULT_CLAIM_RECIPIENT_AVAX=0x742d35Cc6634C0532925a3b8D4b65ED2b2C8B7F5
PRICER_RPC_AVAX=https://api.avax.network/ext/bc/C/rpc

# Feature flags
ENABLE_SYNTHETIC_GMX=false                         # Use real mode by default
```

### Minimum Thresholds

- **Default minimum USD**: $5.00 (configurable via `GMX_MIN_USD`)
- **Gas estimates**: 200k-350k gas depending on operation type
- **Policy compliance**: Follows `PROTOCOL_POLICIES.gmx` configuration

## Claim Strategies

The integration automatically selects the optimal claiming strategy:

### 1. Compound Strategy
- **When**: Both esGMX and fee rewards available
- **Function**: `compound()`
- **Gas**: ~350k gas
- **Benefits**: Most efficient for mixed rewards

### 2. Claim esGMX Strategy  
- **When**: Only esGMX rewards available
- **Function**: `claimEsGmx()`
- **Gas**: ~250k gas
- **Benefits**: Targeted esGMX claiming

### 3. Claim Fees Strategy
- **When**: Only fee rewards available
- **Function**: `claimFees()`  
- **Gas**: ~200k gas
- **Benefits**: Efficient fee claiming

## Usage Examples

### Real Mode Discovery
```typescript
// Discover wallets (uses configured default recipient)
const wallets = await gmxIntegration.discoverWallets();

// Scan for pending rewards
const rewards = await gmxIntegration.getPendingRewards(wallets);

// Create claim bundles
const bundles = await gmxIntegration.buildBundle(rewards);
```

### Synthetic Mode Testing
```typescript
// Enable synthetic mode
process.env.ENABLE_SYNTHETIC_GMX = 'true';

// Returns mock wallets and rewards for testing
const wallets = await gmxIntegration.discoverWallets();
const rewards = await gmxIntegration.getPendingRewards(wallets);
```

## Error Handling

### Network Errors
- RPC connection failures are caught and logged
- Contract call errors are handled gracefully
- Returns empty arrays on network issues

### Address Validation
- Enforces checksum address format
- Validates recipients against allowlist in real mode
- Rejects placeholder/test addresses

### ABI Loading
- Graceful fallback to function selectors if ABI fails to load
- Warns about ABI issues but continues execution
- Uses pre-computed function selectors for core operations

## Gas Estimation

Gas costs are estimated based on operation type:

```typescript
function estimateGasCost(esGmxRewards, feeRewards): number {
  let baseGas = 200000; // Default
  
  if (esGmxRewards.length > 0 && feeRewards.length > 0) {
    baseGas = 350000; // Compound operation
  } else if (esGmxRewards.length > 0) {
    baseGas = 250000; // Claim esGMX
  }
  
  // Convert to USD using current gas price and AVAX price
  const gasUsd = (baseGas * 25e9 * 40) / 1e18; // ~$40 AVAX, 25 gwei
  return gasUsd;
}
```

## Safety Features

### Recipient Validation
- Only allows configured default recipients in real mode
- Blocks placeholder addresses (0x0000...)
- Blocks seed/test patterns (0x1234..., 0xabcd...)

### Threshold Filtering
- Filters rewards below minimum USD value
- Ensures profitable execution after gas costs
- Prevents dust reward claims

### Bundle Validation
- Validates all rewards have same recipient
- Checks contract addresses are valid
- Ensures proper call data encoding

## Testing

### Real Mode Tests
```bash
npm run test:run -- tests/gmx-real-mode.test.ts
```

### Synthetic Mode Tests  
```bash
npm run test:run -- tests/synthetic-gmx.test.ts
```

### Integration Tests
```bash
npm run test:run -- tests/
```

## Troubleshooting

### Common Issues

1. **No rewards found**
   - Check if wallet has GMX/GLP positions
   - Verify minimum USD threshold configuration
   - Ensure RPC URL is accessible

2. **Invalid recipient errors**
   - Set `DEFAULT_CLAIM_RECIPIENT_AVAX` environment variable
   - Use checksum address format
   - Avoid test/placeholder addresses

3. **ABI loading errors**
   - Check ABI file path configuration
   - Ensure file is readable
   - Falls back to function selectors automatically

4. **Network errors**
   - Verify RPC URL is correct and accessible
   - Check network connectivity
   - Consider using alternative RPC endpoints

### Debug Logging

The integration provides detailed console logging:
- Wallet discovery progress
- Reward scanning results  
- Bundle creation details
- Error messages with context

## Architecture

### Integration Interface
```typescript
interface Integration {
  key: 'gmx';
  chain: 'avalanche';
  discoverWallets(): Promise<Address[]>;
  getPendingRewards(wallets: Address[]): Promise<PendingReward[]>;
  buildBundle(rewards: PendingReward[]): Promise<ClaimBundle[]>;
}
```

### Bundle Structure
```typescript
interface ClaimBundle {
  id: string;                    // Unique bundle ID
  chain: 'avalanche';           // Target chain
  protocol: 'gmx';              // Protocol identifier
  claimTo: Address;             // Recipient address
  items: PendingReward[];       // Rewards to claim
  totalUsd: number;             // Total USD value
  estGasUsd: number;            // Estimated gas cost
  netUsd: number;               // Net profit after gas
  contractAddress: string;      // RewardRouterV2 address
  callData: string;             // Encoded function call
  value: 0;                     // ETH/AVAX to send (always 0)
}
```

## Future Enhancements

- **Advanced Pricing**: Integration with real-time price feeds
- **Multi-Wallet Support**: Batch operations across multiple wallets
- **Compound Optimization**: Intelligent timing for compound operations
- **MEV Protection**: Bundle privacy and front-running protection
- **Analytics**: Reward tracking and performance metrics