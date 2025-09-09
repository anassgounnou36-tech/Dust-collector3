# Cross-Protocol Dust Collector Bot

A modular TypeScript bot that automatically discovers wallets with unclaimed protocol rewards on Tron and Avalanche C-Chain, analyzes profitability, and executes profitable claims while minimizing gas costs.

## Overview

The Cross-Protocol Dust Collector Bot helps users recover forgotten or unclaimed rewards from various DeFi protocols. It intelligently bundles multiple claims together to optimize gas efficiency and only executes trades that meet minimum profitability thresholds.

## Features

- **Multi-Chain Support**: Tron and Avalanche C-Chain
- **Protocol Integration**: JustLend, SunSwap, GMX, Trader Joe, BENQI, Yield Yak
- **Intelligent Bundling**: Groups claims by protocol and destination to minimize gas costs
- **Profitability Analysis**: Only executes profitable claims after gas cost estimation
- **Risk Management**: Quarantine system for problematic wallets, retry mechanisms
- **Comprehensive Logging**: Detailed execution logs and performance metrics
- **Mock Mode**: Safe testing without real transactions
- **Database Fallback**: Automatic fallback to in-memory database when SQLite fails (Windows/Node 22 compatibility)

## Database System

The bot uses SQLite for persistent data storage by default, with automatic fallback to an in-memory database when SQLite is unavailable (common on Windows with Node.js 22+ due to native module compatibility issues).

### Database Modes

1. **SQLite Mode (Default)**: Persistent storage using better-sqlite3
   - Data persists between application restarts
   - Optimal for production use
   - Automatically selected when better-sqlite3 is available

2. **Memory Mode (Fallback)**: In-memory storage using a SQLite-compatible implementation
   - Data is lost when application restarts
   - Used automatically when better-sqlite3 fails to load
   - Can be forced with `FORCE_MEMORY_DB=true` environment variable

### Environment Variables

- `FORCE_MEMORY_DB=true`: Force in-memory database mode (useful for testing)
- `DB_PATH`: Path to SQLite database file (ignored in memory mode)

The application will automatically detect database capability and warn when using memory mode:

```
⚠️  better-sqlite3 failed to load: ERR_DLOPEN_FAILED
⚠️  Falling back to in-memory database. Data will not persist between restarts.
```

## Requirements

- **Node.js**: 20.x or 22.x (LTS recommended)
- **Platform Support**: 
  - Linux/macOS: Full SQLite support
  - Windows: Automatic fallback to in-memory database on Node.js 22+ if SQLite fails
- **Environment**: Private keys for target chains (Avalanche, Tron)

## Installation

```bash
# Clone the repository
git clone https://github.com/anassgounnou36-tech/Dust-collector.git
cd Dust-collector

# Install dependencies
npm install

# Build the project
npm run build
```

### Windows/Node.js 22+ Notes

If you encounter `ERR_DLOPEN_FAILED` errors on Windows with Node.js 22+, the application will automatically fall back to in-memory database mode. This is expected behavior and the bot will function normally, but data won't persist between restarts.

To force memory mode for testing: `FORCE_MEMORY_DB=true npm start`

✅ **Avalanche Chain Client**: Complete implementation with Chainlink price feeds and EIP-1559 support
- `gasPrice()`: Returns maxFeePerGas with fallback to gasPrice
- `nativeUsd()`: Chainlink AVAX/USD feed integration with fallback pricing  
- `simulate()`: Transaction simulation with revert reason extraction
- `sendRaw()`: Full transaction building and execution with gas cost calculation
- Exported standalone functions for library-style usage

✅ **Pricing Engine Skeleton**: Stable token support with 30-second in-memory cache
- Support for USDC, USDT, DAI stable token pricing
- `quoteToUsd()`: Returns USD value for stable tokens, placeholder for non-stable
- Configurable token decimals mapping
- Cache implementation with TTL for performance

✅ **Gas Estimator**: Dynamic gas estimation using live chain data
- `estimateBundleUsd()`: Estimates gas costs using current chain prices
- Integration with Avalanche client `gasPrice()` and `nativeUsd()`
- Default gas limits with override support
- Sets `estGasUsd` on bundle objects

✅ **Enhanced Types**: Extended interfaces for new functionality
- `TxResult` includes chain field and status
- `PendingReward` supports optional `estGasLimit`
- Full backward compatibility maintained

⏳ **Coming Next (Phase 2)**:
- Tron chain client implementation
- Router-based pricing (Trader Joe integration)
- Advanced gas optimization strategies
- Idempotency improvements

## Architecture

```
src/
├── chains/          # Blockchain adapters (Avalanche, Tron)
├── integrations/    # Protocol-specific reward detection
├── discovery/       # Wallet discovery mechanisms
├── economics/       # Pricing, gas estimation, profitability rules
├── engine/          # Core execution engine (bundler, simulator, executor)
├── state/           # SQLite database management
├── types/           # TypeScript interfaces
├── config/          # Configuration management
└── cli/             # Command-line tools
```

## Profitability Rules

- **Cooldown Period**: Skip wallets claimed within 7 days
- **Minimum Reward**: Individual rewards must be ≥ $0.10 USD
- **Bundle Size**: 10-30 claims per bundle
- **Minimum Gross**: Bundle total must be ≥ $2.00 USD
- **Minimum Net**: Bundle profit after gas must be ≥ $1.00 USD
- **Gas Efficiency**: Automatic gas estimation and optimization

## Quick Start Examples

### Test with Synthetic GMX Mode
```bash
# Enable synthetic GMX rewards for testing
ENABLE_SYNTHETIC_GMX=true MOCK_MODE=true npm run one:cycle
```

### Development Testing with Lower Thresholds
```bash
# Use development overrides for easier testing
DEV_LOWER_THRESHOLDS=true MOCK_MODE=true npm run dev
```

### Trader Joe LP Discovery Testing
```bash
# Test Trader Joe LP discovery with factory contract
TRADERJOE_FACTORY_ADDRESS=0x8e42f2F4101563bF679975178e880FD87d3eFd4e MOCK_MODE=true npm run one:cycle
```

### Combined Testing Mode
```bash
# Enable all new features for comprehensive testing
ENABLE_SYNTHETIC_GMX=true DEV_LOWER_THRESHOLDS=true MOCK_MODE=true npm run one:cycle
```

## Environment Variables Reference

### Core Configuration
- `MOCK_MODE`: Enable mock mode for testing (boolean, default: false)
- `DB_PATH`: Database path for SQLite storage (string, default: ./data/bot.db)
- `FORCE_MEMORY_DB`: Force in-memory database (boolean, default: false)

### Blockchain Access
- `PRIVATE_KEY_AVAX`: Avalanche C-Chain private key (hex string)
- `PRIVATE_KEY_TRON`: Tron network private key (hex string)
- `PRICER_RPC_AVAX`: Avalanche RPC endpoint (URL)
- `PRICER_RPC_TRON`: Tron RPC endpoint (URL)

### Feature Flags
- `ENABLE_SYNTHETIC_GMX`: Enable synthetic GMX testing mode (boolean, default: false)
- `DEV_LOWER_THRESHOLDS`: Enable development policy overrides (boolean, default: false)

### Trader Joe Configuration
- `TRADERJOE_FACTORY_ADDRESS`: Factory contract for LP discovery (address)
- `TRADERJOE_ROUTER_ADDRESS`: Router contract address (address)
- `TRADERJOE_QUOTER_ADDRESS`: Quoter contract address (address)

### Trading Parameters
- `ROUTER_SLIPPAGE_TOLERANCE`: Default slippage tolerance (float, 0-1)
- `ROUTER_DEADLINE_MINUTES`: Transaction deadline in minutes (integer)
- `ROUTER_MAX_HOPS`: Maximum routing hops (integer, 1-3)
- `ROUTER_MIN_PROFIT_USD`: Minimum profit threshold in USD (float)

### Token Addresses
- `JOE_TOKEN`: JOE token contract address (address)
- `USDC_TOKEN`: USDC token contract address (address)
- `WAVAX_TOKEN`: Wrapped AVAX token contract address (address)

### Price Feeds
- `CHAINLINK_AVAX_USD_FEED`: AVAX/USD price feed address (address)
- `COINGECKO_API_KEY`: CoinGecko API key (string, optional)
- `DEFILLAMA_API_URL`: DeFiLlama API URL (URL)

### Logging & Debug
- `LOG_LEVEL`: Logging level (debug|info|warn|error)
- `DRY_RUN_ONLY`: Enable dry run mode (boolean)
- `TRADERJOE_DEBUG_MODE`: Enable TraderJoe debug mode (boolean)
- `TRADERJOE_VALIDATION_ENABLED`: Enable TraderJoe validation (boolean)

```
Cross-Protocol-Dust-Collector-Bot/
├── src/
│   ├── chains/           # Blockchain client adapters
│   ├── integrations/     # Protocol-specific modules
│   ├── discovery/        # Wallet discovery algorithms
│   ├── economics/        # Financial analysis modules
│   ├── engine/           # Core execution engine
│   ├── state/            # Database management
│   ├── types/            # TypeScript definitions
│   ├── config/           # Configuration files
│   └── cli/              # Command-line interfaces
├── tests/                # Test suites
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── README.md             # This file
├── LICENSE              # MIT License
└── .env.example         # Environment template
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Core Configuration
MOCK_MODE=true                    # Enable mock mode for testing
DB_PATH=./data/bot.db            # Database path for SQLite storage
FORCE_MEMORY_DB=false            # Force in-memory database

# Private keys for blockchain interactions
PRIVATE_KEY_AVAX=your_avalanche_private_key_here
PRIVATE_KEY_TRON=your_tron_private_key_here
PRIVATE_KEY=your_avalanche_private_key_here

# RPC endpoints
PRICER_RPC_AVAX=https://api.avax.network/ext/bc/C/rpc
PRICER_RPC_TRON=https://api.trongrid.io
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Feature Flags
ENABLE_SYNTHETIC_GMX=false       # Enable synthetic GMX testing mode
DEV_LOWER_THRESHOLDS=false       # Enable development policy overrides

# Trader Joe Configuration
TRADERJOE_FACTORY_ADDRESS=0x8e42f2F4101563bF679975178e880FD87d3eFd4e
TRADERJOE_ROUTER_ADDRESS=0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30
TRADERJOE_QUOTER_ADDRESS=0x4c45bbec2ff7810ef4a77ad79ed7d9b699419b5c

# Token Addresses
JOE_TOKEN=0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd
USDC_TOKEN=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
WAVAX_TOKEN=0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7

# Router Configuration
ROUTER_SLIPPAGE_TOLERANCE=0.005   # 0.5% default slippage
ROUTER_DEADLINE_MINUTES=10        # 10 minute deadline
ROUTER_MAX_HOPS=2                 # Maximum routing hops
ROUTER_MIN_PROFIT_USD=0.50        # Minimum profit threshold

# Chainlink price feeds
CHAINLINK_AVAX_USD_FEED=0x0A77230d17318075983913bC2145DB16C7366156

# Bot configuration
LOG_LEVEL=info
DRY_RUN_ONLY=true
```

### Configuration File

Edit `src/config/config.example.json` for:
- Token decimal mappings
- Stablecoin definitions
- Profitability thresholds
- Bundle size limits

## Telegram Alerts (Phase 4)

The bot supports real-time Telegram notifications for profitable trading opportunities and system status updates during Phase 4 evaluations.

### Setup

1. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Use `/newbot` command and follow instructions
   - Save the bot token from BotFather

2. **Get Your Chat ID**:
   - Start a chat with your bot
   - Send any message to the bot
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

3. **Configure Environment Variables**:
```bash
# Enable Telegram notifications
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=1234567890:ABCDefGhIJKlmnoPQRSTuvwXYZ123456789
TELEGRAM_CHAT_ID=-1001234567890

# Optional notification settings
NOTIFICATION_PROFIT_THRESHOLD=1.0      # Minimum profit USD to alert
NOTIFICATION_MIN_SCORE=70              # Minimum execution score to alert
NOTIFICATION_SUMMARY_INTERVAL=100      # Send summary every N iterations
NOTIFICATION_COOLDOWN_MS=300000        # 5-minute cooldown between similar alerts
```

### Alert Types

- **Profitable Opportunities**: Sent when high-score profitable trades are detected
- **Execution Errors**: Sent when significant evaluation errors occur (with cooldown)
- **System Status**: Sent on startup and significant system events  
- **Evaluation Summaries**: Periodic summaries of evaluation performance

### Message Format

All messages use Telegram's MarkdownV2 format with structured information including:
- Trading pair and amounts
- Profit calculations and execution scores
- Timestamps and iteration details
- Performance metrics and warnings

## Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Available Commands
```bash
npm run dev         # Development mode with hot reload
npm run build       # Compile TypeScript
npm start           # Run compiled bot (continuous mode)
npm run one:cycle   # Run single discovery and claims cycle
npm test            # Run test suite
npm run backfill    # Discover and store rewards (no execution)
npm run report      # Generate execution report
npm run phase4:loop # Run continuous Phase 4 evaluation loop
npm run phase4:demo # Run Phase 4 offline demo
```

### New Features (Option B Implementation)

#### 🧪 Synthetic GMX Testing Mode
Enable synthetic GMX reward generation for testing without real contract calls:
```bash
ENABLE_SYNTHETIC_GMX=true npm run dev
```

Features:
- Generates mock GMX staking rewards (WETH)
- Creates synthetic GLP fee rewards (AVAX)
- Returns test wallet addresses for discovery
- Builds realistic reward bundles

#### 🔧 Development Policy Overrides
Lower thresholds for easier testing and development:
```bash
DEV_LOWER_THRESHOLDS=true npm run dev
```

Overrides:
- Cooldown: 7 days → 0 days
- Min item value: $0.10 → $0.01
- Min bundle gross: $2.00 → $0.10
- Min bundle net: $1.00 → $0.05
- Min profit: $0.50 → $0.01
- Schedule interval: 60s → 30s

#### 🏭 Trader Joe LP Discovery Scaffold
Automated discovery of liquidity providers using factory contract:
- Queries TRADERJOE_FACTORY_ADDRESS for pair enumeration
- Discovers LPs across multiple trading pairs
- Removes duplicate wallet addresses
- Integrates with existing discovery pipeline

#### ⚡ Single-Cycle Execution
Run one complete cycle then exit (perfect for testing):
```bash
npm run one:cycle
```

Phases:
1. **Discovery**: Find wallets across all enabled integrations
2. **Scanning**: Detect pending rewards for discovered wallets
3. **Bundling**: Group rewards into profitable execution bundles
4. **Execution**: Simulate and execute profitable bundles

## Mock Mode

For safe testing without real transactions:

1. Set `MOCK_MODE=true` in `.env`
2. Run without providing private keys
3. Bot will simulate discoveries and executions
4. Creates realistic test data in database

Example mock execution:
```bash
MOCK_MODE=true npm run dev
```

The bot will:
- Discover sample wallets
- Find mock JustLend rewards (~$2.50 USDT)
- Create profitable bundles
- Simulate successful executions
- Record results in database

## Debug Instrumentation

### Trader Joe v2 (Legacy) Debug Features

The bot includes comprehensive debug instrumentation for Trader Joe v2 legacy protocol integration:

#### Evaluation Debug Snapshots
- **Purpose**: Capture detailed state and decision points during trade evaluation
- **Location**: `src/debug/evaluationSnapshot.ts`
- **Features**:
  - Session-based tracking of evaluation lifecycle
  - Decision point recording with conditions and thresholds
  - Calculated metrics logging (profit, gas, price impact, execution score)
  - Warning and error collection
  - Snapshot persistence to file system

#### Validation Logic
- **Purpose**: Comprehensive validation for Trader Joe v2 legacy protocol
- **Location**: `src/debug/traderJoeValidation.ts`  
- **Features**:
  - Contract address validation (router, factory, pair)
  - Token validation (decimals, addresses, liquidity)
  - Trade parameter validation (amounts, slippage, price impact)
  - Economic validation (profitability, gas efficiency, execution score)
  - Version detection (v2-legacy vs v2.1)

#### Configuration
Enable debug instrumentation by setting environment variables:
```bash
# Enable debug mode
TRADERJOE_DEBUG_MODE=true

# Enable validation
TRADERJOE_VALIDATION_ENABLED=true

# Set snapshot output directory
TRADERJOE_DEBUG_SNAPSHOT_DIR=./debug/snapshots

# Configure v2 legacy contracts
TRADERJOE_V2_LEGACY_ROUTER=0x60aE616a2155Ee3d9A68541Ba4544862310933d4
TRADERJOE_V2_LEGACY_FACTORY=0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10
```

#### Debug Output
When enabled, debug instrumentation provides:
- Detailed console logging of evaluation steps
- JSON snapshots of complete evaluation sessions
- Validation reports with warnings and recommendations
- Decision point tracking for troubleshooting

#### Analyzing Debug Data
Use the analysis utilities to examine evaluation patterns:
```typescript
import { analyzeFailedEvaluations, evaluationDebugger } from './src/debug/evaluationSnapshot.js';

// Get all snapshots
const snapshots = evaluationDebugger.getAllSnapshots();

// Analyze failure patterns
const analysis = analyzeFailedEvaluations(snapshots);
console.log('Failure reasons:', analysis.failureReasons);
console.log('Common warnings:', analysis.commonWarnings);
```

## Roadmap v1.0

### Economic Guardrails

**Baseline Profit Threshold**: `MIN_PROFIT_USD = 0.5` (configurable)
- Ensures minimum viable profit after gas costs
- Protects against unprofitable execution scenarios
- Adjustable via configuration for different market conditions

### Development Phases

#### **Phase 1: Foundation (✅ Complete)**
- [x] Multi-chain architecture (Avalanche, Tron)
- [x] Basic protocol integrations (mock mode)
- [x] SQLite state management
- [x] Core bundling and execution engine
- [x] Profitability analysis framework
- [x] TypeScript interfaces and type safety

#### **Phase 2: Chain Infrastructure**
- [x] Avalanche client with EIP-1559 support
- [x] Chainlink price feed integration
- [x] Gas estimation and cost calculation
- [ ] Tron client implementation
- [ ] Cross-chain address correlation

#### **Phase 3: Protocol Integration (🔄 In Progress)**
**Current Sub-Tranche Items:**
- [ ] JustLend real contract integration
- [ ] SunSwap liquidity pool rewards
- [ ] GMX staking and fee rewards
- [ ] Trader Joe liquidity mining
- [ ] BENQI lending rewards
- [ ] Yield Yak auto-compound rewards

#### **Phase 4: Router & Pricing Engine** ✅ **COMPLETED**
- [x] DEX router integration (Trader Joe V2.1)
- [x] Single-hop routing with dry-run capabilities
- [x] Slippage protection and deadline management
- [x] Dynamic pricing with comprehensive evaluation
- [x] Gas estimation and profitability analysis
- [x] Performance metrics and monitoring
- [x] Comprehensive test coverage
- [x] **Continuous evaluation loop with structured JSON logging**
- [x] **Transaction sender with dry-run mode**

**Phase 4 Features:**
- **Trader Joe Router**: Single-hop quote generation and evaluation
- **Slippage Protection**: Advanced slippage calculation with TTL management
- **Profitability Analysis**: Comprehensive trade evaluation including gas costs
- **Dry-Run Pipeline**: Calculate quotes and profitability without executing trades
- **Continuous Loop**: Real-time evaluation with 3-second intervals
- **Transaction Sender**: Safe transaction execution with dry-run mode
- **Metrics Collection**: Performance tracking and analysis
- **Testing Suite**: Unit, integration, and scenario-based tests

**Phase 4 Commands:**
```bash
# Run continuous evaluation loop (dry-run mode)
npm run phase4:loop

# Run offline demo
npm run phase4:demo
```

See [Phase 4 Documentation](docs/PHASE4_MINIMAL_SCOPE.md) for detailed implementation guide.

#### **Phase 5: Persistence & Reliability**
- [ ] Redis/SQLite idempotency backend
- [ ] Persistent state management
- [ ] Transaction replay protection
- [ ] Database migration system
- [ ] Backup and recovery procedures

#### **Phase 6: Advanced Discovery**
- [ ] On-chain event scanning
- [ ] Subgraph integration
- [ ] Wallet clustering algorithms
- [ ] Cross-protocol reward correlation
- [ ] Yield farming strategy detection

#### **Phase 7: Gas Optimization**
- [ ] Multicall transaction bundling
- [ ] Dynamic gas price optimization
- [ ] MEV protection strategies
- [ ] Batch execution optimization
- [ ] Gas cost prediction models

#### **Phase 8: Economic Safeguards**
- [ ] Daily gas USD ceiling enforcement
- [ ] Dynamic profitability thresholds
- [ ] Market condition adaptation
- [ ] Slippage impact analysis
- [ ] Risk-adjusted execution priority

#### **Phase 9: Monitoring & Metrics**
- [ ] Prometheus metrics export
- [ ] JSON endpoint for monitoring
- [ ] Performance analytics dashboard
- [ ] Execution success rates
- [ ] Profitability tracking

#### **Phase 10: Production Hardening**
- [ ] Error classification system
- [ ] Advanced retry mechanisms
- [ ] Circuit breaker patterns
- [ ] Health check endpoints
- [ ] Graceful degradation

#### **Phase 11: Security & Compliance**
- [ ] Formal security audit
- [ ] Rate limiting implementation
- [ ] API access controls
- [ ] Compliance checking framework
- [ ] Regulatory reporting capabilities

#### **Phase 12: Scale & Optimization**
- [ ] Multi-instance coordination
- [ ] Load balancing strategies
- [ ] Performance optimization
- [ ] Resource usage monitoring
- [ ] Horizontal scaling support

### Next Immediate Actions
1. Complete Phase 3 protocol integrations
2. Implement persistent idempotency backend (Phase 5)
3. Add multi-hop route simulation with sanity clamps (Phase 4)
4. Deploy daily gas USD ceiling enforcement (Phase 8)

## Security Notes

⚠️ **Important Security Considerations:**

- **Never commit private keys** to version control
- **Use environment variables** for sensitive configuration
- **Test thoroughly** in mock mode before live deployment
- **Monitor gas costs** to prevent excessive spending
- **Review all transactions** before signing
- **Keep private keys secure** and use hardware wallets when possible

## Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Setup
```bash
git clone <repository>
cd Cross-Protocol-Dust-Collector-Bot
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Testing
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the mock mode for understanding bot behavior
