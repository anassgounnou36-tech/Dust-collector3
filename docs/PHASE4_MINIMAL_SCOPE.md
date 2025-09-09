# Phase 4 Minimal Scope: Trader Joe Router Dry-Run Pipeline

## Overview

Phase 4 implements a single-hop Trader Joe router dry-run pipeline for the Cross-Protocol Dust Collector Bot. This phase focuses on router-based pricing and profitability analysis without executing actual trades, providing the foundation for future automated arbitrage capabilities.

## Architecture

### Core Components

```
src/
├── config/
│   └── env.ts                 # Environment configuration
├── core/
│   └── slippage.ts           # Slippage protection utilities
├── routers/
│   ├── types.ts              # Router interface definitions
│   └── traderJoe/
│       ├── abi/
│       │   └── Pair.ts       # Contract ABIs
│       └── TraderJoeRouter.ts # Router implementation
├── engine/
│   ├── logger.ts             # Enhanced logging (updated)
│   └── traderJoeEvaluator.ts # Profitability evaluator
└── metrics/
    └── phase4.ts             # Performance metrics
```

### Key Features

1. **Single-Hop Routing**: Supports direct token swaps through Trader Joe V2.1 Liquidity Book
2. **Dry-Run Only**: Calculates quotes and profitability without executing trades
3. **Slippage Protection**: Advanced slippage calculation and deadline management
4. **Profitability Analysis**: Comprehensive evaluation including gas costs and price impact
5. **Metrics Collection**: Performance tracking and analysis
6. **Comprehensive Testing**: Unit, integration, and scenario-based tests

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Core Configuration
PRICER_RPC_AVAX=https://api.avax.network/ext/bc/C/rpc
MOCK_MODE=true

# Trader Joe Configuration
TRADERJOE_ROUTER_ADDRESS=0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30
TRADERJOE_FACTORY_ADDRESS=0x8e42f2F4101563bF679975178e880FD87d3eFd4e

# Router Parameters
ROUTER_SLIPPAGE_TOLERANCE=0.005    # 0.5%
ROUTER_DEADLINE_MINUTES=10
ROUTER_MIN_PROFIT_USD=0.50
```

### Validation

Environment configuration is validated on startup:

```typescript
import { validatePhase4Env } from './src/config/env.js';

try {
  validatePhase4Env();
  console.log('✅ Environment validation passed');
} catch (error) {
  console.error('❌ Environment validation failed:', error);
}
```

## Usage

### Basic Router Usage

```typescript
import { createTraderJoeRouter, AVALANCHE_TOKENS } from './src/routers/traderJoe/TraderJoeRouter.js';

const router = createTraderJoeRouter();

// Get a quote for swapping WAVAX to USDC
const quote = await router.getQuote(
  AVALANCHE_TOKENS.WAVAX,
  AVALANCHE_TOKENS.USDC,
  BigInt(10 * 1e18), // 10 WAVAX
  { tolerance: 0.005, deadlineMinutes: 10 }
);

if (quote) {
  console.log(`Quote: ${quote.outputAmount} USDC for ${quote.inputAmount} WAVAX`);
  console.log(`Price Impact: ${(quote.priceImpact * 100).toFixed(2)}%`);
  console.log(`Gas Estimate: $${quote.gasUsd.toFixed(2)}`);
}
```

### Profitability Evaluation

```typescript
import { createTraderJoeEvaluator } from './src/engine/traderJoeEvaluator.js';

const evaluator = createTraderJoeEvaluator();

const evaluation = await evaluator.evaluateTrade(
  AVALANCHE_TOKENS.WAVAX,
  AVALANCHE_TOKENS.USDC,
  BigInt(10 * 1e18)
);

console.log(`Profitable: ${evaluation.profitable}`);
console.log(`Profit: $${evaluation.profitUsd.toFixed(2)}`);
console.log(`Score: ${evaluation.executionScore.toFixed(1)}/100`);
```

### Slippage Protection

```typescript
import { protectTrade, DEFAULT_SLIPPAGE } from './src/core/slippage.js';

const protection = protectTrade(
  expectedOutputAmount,
  { tolerance: DEFAULT_SLIPPAGE.NORMAL, deadlineMinutes: 10 },
  priceImpact,
  volumeUsd,
  true // isOutput
);

console.log(`Protected amount: ${protection.protectedAmount}`);
console.log(`Deadline: ${protection.deadline}`);
console.log(`Warnings: ${protection.warnings.join(', ')}`);
```

## Running the Demo

Execute the Phase 4 offline demo to see all features in action:

```bash
npm run phase4:demo
```

The demo showcases:
- Basic quote generation
- Slippage protection scenarios
- Trade evaluation and profitability
- Amount optimization
- Common pairs analysis
- Comprehensive metrics

## Testing

### Test Structure

```
tests/traderJoe/
├── amountOut.test.ts         # Quote generation and amount calculations
├── ttlSlippage.test.ts       # Slippage protection and TTL handling
├── belowMinProfit.test.ts    # Unprofitability scenarios
└── integration.avalanche.test.ts # Network integration tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test tests/traderJoe/amountOut.test.ts
npm test tests/traderJoe/ttlSlippage.test.ts

# Run integration tests (requires RPC access)
RUN_INTEGRATION_TESTS=true npm test tests/traderJoe/integration.avalanche.test.ts
```

### Test Categories

1. **Unit Tests**: Core functionality without network dependencies
2. **Integration Tests**: Real network interactions (optional)
3. **Scenario Tests**: Specific edge cases and failure modes
4. **Performance Tests**: Response times and throughput

## API Reference

### Router Interface

```typescript
interface Router {
  getQuote(tokenIn: Token, tokenOut: Token, amountIn: bigint, slippage: SlippageConfig): Promise<Quote | null>;
  getQuotes(tokenIn: Token, tokenOut: Token, amounts: bigint[], slippage: SlippageConfig): Promise<Quote[]>;
  buildTrade(params: TradeParams): Promise<{to: string; data: string; value: string; gasLimit: bigint}>;
  getPairsForToken(token: Token): Promise<Pair[]>;
  pairExists(tokenA: Token, tokenB: Token): Promise<boolean>;
}
```

### Evaluator Interface

```typescript
interface TraderJoeEvaluator {
  evaluateTrade(tokenIn: Token, tokenOut: Token, amountIn: bigint, slippage?: SlippageConfig): Promise<RouterEvaluation>;
  evaluateAmountLevels(tokenIn: Token, tokenOut: Token, amounts: bigint[], slippage?: SlippageConfig): Promise<RouterEvaluation[]>;
  findOptimalTradeSize(tokenIn: Token, tokenOut: Token, minAmount: bigint, maxAmount: bigint, steps?: number, slippage?: SlippageConfig): Promise<{bestEvaluation: RouterEvaluation | null; allEvaluations: RouterEvaluation[]}>;
  evaluateArbitrageOpportunity(baseToken: Token, targetTokens: Token[], amount: bigint, sliprage?: SlippageConfig): Promise<{bestTarget: Token | null; bestEvaluation: RouterEvaluation | null; allEvaluations: Map<string, RouterEvaluation>}>;
}
```

## Metrics and Monitoring

### Performance Metrics

Phase 4 automatically collects comprehensive metrics:

- Quote success rates and response times
- Profitability analysis results
- Gas cost estimations
- Price impact measurements
- Router performance comparisons

### Accessing Metrics

```typescript
import { phase4Metrics, logPhase4Metrics } from './src/metrics/phase4.js';

// Log current performance summary
logPhase4Metrics();

// Get detailed metrics
const metrics = phase4Metrics.getMetrics();
console.log(`Success rate: ${(metrics.successfulQuotes / metrics.totalQuotes * 100).toFixed(1)}%`);

// Export for analysis
const exportData = phase4Metrics.exportMetrics();
```

## Error Handling

### Common Error Scenarios

1. **No Route Found**: When no trading pair exists between tokens
2. **Network Errors**: RPC connectivity issues
3. **Slippage Validation**: Invalid tolerance or deadline parameters
4. **Gas Estimation Failures**: Contract interaction problems

### Error Response Format

```typescript
interface RouterEvaluation {
  quote: Quote | null;
  profitable: boolean;
  profitUsd: number;
  gasUsd: number;
  netUsd: number;
  priceImpact: number;
  executionScore: number;
  warnings: string[];
  errors: string[];
}
```

### Handling Errors

```typescript
const evaluation = await evaluator.evaluateTrade(tokenIn, tokenOut, amount);

if (evaluation.errors.length > 0) {
  console.error('Evaluation errors:', evaluation.errors);
}

if (evaluation.warnings.length > 0) {
  console.warn('Evaluation warnings:', evaluation.warnings);
}

if (!evaluation.profitable) {
  console.log(`Trade not profitable: $${evaluation.profitUsd.toFixed(2)} profit`);
}
```

## Limitations

### Phase 4 Constraints

1. **Single-Hop Only**: Multi-hop routing not implemented
2. **Dry-Run Only**: No actual trade execution
3. **Trader Joe Only**: Single DEX integration
4. **Avalanche Only**: Single chain support
5. **Basic Price Oracles**: Simplified USD estimation

### Future Enhancements

- Multi-hop routing optimization
- Cross-DEX arbitrage analysis
- Real-time price oracle integration
- Advanced slippage modeling
- MEV protection strategies

## Troubleshooting

### Common Issues

**Environment Validation Fails**
```bash
Error: Missing required environment variables: PRICER_RPC_AVAX
```
*Solution*: Copy `.env.example` to `.env` and configure RPC URL

**Network Connectivity Issues**
```bash
Error: getaddrinfo ENOTFOUND api.avax.network
```
*Solution*: Check internet connection and RPC URL validity

**Quote Returns Null**
```bash
No route found for TOKEN1/TOKEN2
```
*Solution*: Verify tokens have sufficient liquidity on Trader Joe

**High Gas Estimates**
```bash
Warning: High gas cost: $15.23
```
*Solution*: Check network congestion or reduce trade size

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run phase4:demo
```

## Contributing

### Development Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Copy environment: `cp .env.example .env`
4. Run tests: `npm test`
5. Build project: `npm run build`

### Code Style

- TypeScript strict mode enabled
- ESLint configuration provided
- Comprehensive JSDoc documentation
- 100% test coverage goal

### Adding New Features

1. Update interfaces in `src/routers/types.ts`
2. Implement functionality with tests
3. Update documentation
4. Add demo examples
5. Submit pull request

## License

MIT License - see LICENSE file for details.