# Real Earnings v1 — Trader Joe sJOE (AVAX) + Production Finalization

## Overview

This implementation provides real on-chain earnings via Trader Joe sJOE staking on Avalanche C-Chain with production-ready safety features and verified payout tracking.

## Key Features

### 🔒 Production Safety
- **Zero mock leakage in non-mock mode**: No seed wallets, no synthetic rewards, no EOA destinations
- **Strict recipient allowlist**: Only `DEFAULT_CLAIM_RECIPIENT_AVAX` allowed in production
- **Seed/test address blocking**: Patterns like 0x1234..., 0x2345..., 0x3456... are blocked
- **Contract validation**: Ensures transaction destinations have bytecode (not EOAs)
- **Environment validation**: Required configuration checked on startup

### 💰 Real Earnings Integration
- **sJOE staking rewards**: Direct integration with Trader Joe sJOE staking contract
- **Configurable reward functions**: Support for `pendingReward`, `harvest`, `getReward`
- **USD threshold filtering**: Configurable minimum USD value (`SJOE_MIN_USD`)
- **Real contract calls**: Uses actual Avalanche RPC for reward discovery

### 📊 Verified Payouts
- **Receipt verification**: Parses ERC20 Transfer logs from transaction receipts
- **Real USD calculation**: Uses current AVAX price and gas costs
- **Profit tracking**: Computes `claimedUsd`, `gasUsd`, `netUsd`
- **Database persistence**: Stores execution transfers and verified payout data

### 🛡️ Enhanced Logging
- **Profit summaries**: `✅ sJOE claim: gross $X.XX | gas $Y.YY | net $Z.ZZ | tx <hash> | verified=yes`
- **Safety logging**: Clear indication of validation failures and security blocks

## Configuration

### Environment Variables

```bash
# Required for production (non-mock mode)
DEFAULT_CLAIM_RECIPIENT_AVAX=0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D
TRADERJOE_SJOE_STAKING_ADDRESS=0x1a731B2299E22FbAC282E7094EdA41046343Cb51

# Token addresses
SJOE_TOKEN_ADDRESS=0x1a731B2299E22FbAC282E7094EdA41046343Cb51
JOE_TOKEN_ADDRESS=0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd

# Configuration
SJOE_MIN_USD=1.0
TRADERJOE_SJOE_STAKING_ABI_PATH=./abi/traderjoe_sjoe_staking.json
SJOE_HARVEST_FUNCTION=harvest  # or 'getReward'

# Chain configuration
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
PRIVATE_KEY_AVAX=<your-private-key>  # For execution
```

### Database Schema

The implementation uses the existing migration `006_verified_transfers.sql` which adds:

- `execution_transfers` table for storing verified transfer events
- Enhanced `executions` table with `verified_payout`, `claimed_usd`, `gas_usd`, `net_usd` columns

## Usage

### 1. Dry Run (Recommended First)

```bash
# Set environment
export MOCK_MODE=false
export DRY_RUN_ONLY=true
export DEFAULT_CLAIM_RECIPIENT_AVAX=0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D

# Run discovery and validation
npm run dev
```

### 2. Live Execution

```bash
# Set environment for live execution
export MOCK_MODE=false
export DRY_RUN_ONLY=false
export DEFAULT_CLAIM_RECIPIENT_AVAX=0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D
export PRIVATE_KEY_AVAX=<your-private-key>

# Run live execution
npm run dev
```

### 3. Demo Script

```bash
# Run interactive demo
npx tsx demo/sjoe-demo.ts
```

## Safety Validations

### Startup Validations (Non-Mock Mode)
- ✅ `DEFAULT_CLAIM_RECIPIENT_AVAX` must be configured
- ✅ `TRADERJOE_SJOE_STAKING_ADDRESS` must be configured
- ✅ Token addresses must be configured

### Runtime Validations
- ✅ Recipients must match `DEFAULT_CLAIM_RECIPIENT_AVAX` exactly
- ✅ No placeholder addresses (0x0000...)
- ✅ No seed/test patterns (0x1234..., 0x2345..., etc.)
- ✅ Contract destinations must have bytecode
- ✅ No synthetic rewards in non-mock mode
- ✅ No seed wallet discovery in non-mock mode

### Post-Execution Validations
- ✅ Transaction receipt must be available
- ✅ Must contain ≥1 ERC20 Transfer to `DEFAULT_CLAIM_RECIPIENT_AVAX`
- ✅ Failed verification marks execution as `NO_VERIFIED_PAYOUT`

## Integration Details

### Discovery
- Uses only `DEFAULT_CLAIM_RECIPIENT_AVAX` wallet in production
- Calls `pendingReward(address)` on sJOE staking contract
- Filters rewards by `SJOE_MIN_USD` threshold

### Execution
- Single claim transaction to `TRADERJOE_SJOE_STAKING_ADDRESS`
- Encodes configurable claim function (harvest/getReward)
- Configurable via `SJOE_HARVEST_FUNCTION` environment variable
- Supports both `harvest()` and `getReward()` function calls
- Enforces recipient validation before execution
- Validates contract bytecode exists
- Generates proper transaction calldata with function selectors

#### Harvest Function Configuration
```bash
# Use harvest() function (default)
export SJOE_HARVEST_FUNCTION=harvest

# Use getReward() function
export SJOE_HARVEST_FUNCTION=getReward
```

**Function Selectors:**
- `harvest()`: `0x4641257d`
- `getReward()`: `0x3d18b912`

### Verification
- Parses transaction receipt logs for ERC20 Transfer events
- Calculates real gas cost using current prices
- Computes net profit after gas costs
- Persists verified transfer data to database

## Testing

### Test Coverage
- ✅ Safety tests (invalid recipients, missing env vars)
- ✅ Discovery tests (zero vs positive rewards)
- ✅ Bundle creation and validation
- ✅ Execution success/failure scenarios
- ✅ Address validation patterns
- ✅ Migration schema tests
- ✅ Harvest function encoding (harvest vs getReward)
- ✅ Transaction data generation and calldata
- ✅ Function selector validation
- ✅ Runtime configuration changes

### Run Tests
```bash
# All tests
npm test

# Specific test suites
npm test tests/integrations/traderjoe/sjoe.test.ts
npm test tests/config/enhanced-addresses.test.ts
npm test tests/executor/recipientGuard.test.ts
npm test tests/sjoe-harvest.test.ts  # New harvest logic tests
```

## Profit Summary Format

Successful sJOE claims produce profit summaries in the format:

```
✅ sJOE claim: gross $5.25 | gas $2.10 | net $3.15 | tx 0xabc123... | verified=yes
```

Failed or unverified claims:
```
❌ sJOE claim: gross $0.00 | gas $2.10 | net $-2.10 | tx 0xdef456... | verified=no
```

## Security Features

### Address Pattern Blocking
The implementation blocks these dangerous patterns in non-mock mode:
- `0x1234...` - Common test pattern
- `0x2345...` - Sequential test pattern  
- `0x3456...` - Sequential test pattern
- `0x4567...` - Sequential test pattern
- `0x5678...` - Sequential test pattern
- `0x0123...` - Sequential test pattern
- `0x9876...` - Reverse pattern
- `0xabcd...` - Hex pattern
- `0xdead...` - Dead beef pattern
- `0xbeef...` - Dead beef pattern
- Any address containing "test", "seed", "demo"

### Allowlist Enforcement
In non-mock mode, only the exact address configured in `DEFAULT_CLAIM_RECIPIENT_AVAX` is allowed as a recipient. All other addresses are rejected.

### Contract Validation
Before execution, the system validates that the destination address has contract bytecode, preventing accidental transfers to EOAs.

## Next Steps

This implementation provides the foundation for:
- GMX Rewards (AVAX) integration with same verification pipeline
- Multi-wallet support expansion
- Additional DeFi protocol integrations

The verification pipeline and safety features established here can be reused for future integrations.