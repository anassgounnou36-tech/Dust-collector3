#!/usr/bin/env tsx

/**
 * Phase 4 Offline Demo - Trader Joe Router Dry-Run
 * 
 * This demo showcases the Phase 4 minimal scope implementation:
 * - Single-hop Trader Joe router integration
 * - Dry-run quote generation and evaluation
 * - Slippage protection and profitability analysis
 * - Router comparison and metrics collection
 * 
 * Run with: npm run phase4:demo
 */

import { config } from 'dotenv';
import { createTraderJoeRouter, AVALANCHE_TOKENS } from '../src/routers/traderJoe/TraderJoeRouter.js';
import { createTraderJoeEvaluator, quickEvaluate } from '../src/engine/traderJoeEvaluator.js';
import { phase4Metrics, logPhase4Metrics } from '../src/metrics/phase4.js';
import { validatePhase4Env, env } from '../src/config/env.js';
import { logger } from '../src/engine/logger.js';
import { formatSlippage, DEFAULT_SLIPPAGE, DEFAULT_TTL } from '../src/core/slippage.js';

// Load environment variables
config();

/**
 * Demo configuration
 */
const DEMO_CONFIG = {
  // Test amounts in USD equivalent
  testAmounts: [100, 500, 1000, 5000],
  
  // Token pairs to test
  testPairs: [
    ['WAVAX', 'USDC'],
    ['JOE', 'USDC'],
    ['JOE', 'WAVAX']
  ] as const,

  // Slippage scenarios
  slippageScenarios: [
    { name: 'Conservative', tolerance: DEFAULT_SLIPPAGE.CONSERVATIVE, deadlineMinutes: DEFAULT_TTL.NORMAL },
    { name: 'Normal', tolerance: DEFAULT_SLIPPAGE.NORMAL, deadlineMinutes: DEFAULT_TTL.NORMAL },
    { name: 'Aggressive', tolerance: DEFAULT_SLIPPAGE.AGGRESSIVE, deadlineMinutes: DEFAULT_TTL.FAST }
  ]
};

/**
 * Main demo function
 */
async function runPhase4Demo(): Promise<void> {
  console.log('\n🚀 Phase 4 Offline Demo - Trader Joe Router Dry-Run\n');
  console.log('='.repeat(60));

  try {
    // Validate environment
    logger.info('Validating Phase 4 environment...');
    validatePhase4Env();
    logger.info('✅ Environment validation passed');

    // Initialize router and evaluator
    logger.info('Initializing Trader Joe router...');
    const router = createTraderJoeRouter();
    const evaluator = createTraderJoeEvaluator();
    logger.info(`✅ Router initialized: ${router.name} (Chain: ${router.chainId})`);

    // Reset metrics for clean demo
    phase4Metrics.reset();

    // Demo 1: Basic quote generation
    await demonstrateBasicQuotes();

    // Demo 2: Slippage protection scenarios
    await demonstrateSlippageProtection();

    // Demo 3: Trade evaluation and profitability
    await demonstrateTradeEvaluation();

    // Demo 4: Amount optimization
    await demonstrateAmountOptimization();

    // Demo 5: Common pairs analysis
    await demonstrateCommonPairsAnalysis();

    // Final metrics summary
    await showFinalMetrics();

  } catch (error) {
    logger.error('Demo failed:', error);
    process.exit(1);
  }
}

/**
 * Demonstrate basic quote generation
 */
async function demonstrateBasicQuotes(): Promise<void> {
  console.log('\n📊 Demo 1: Basic Quote Generation');
  console.log('-'.repeat(40));

  const router = createTraderJoeRouter();
  const tokenIn = AVALANCHE_TOKENS.WAVAX;
  const tokenOut = AVALANCHE_TOKENS.USDC;
  const amount = BigInt(10 * 1e18); // 10 WAVAX

  logger.info(`Getting quote: ${amount.toString()} ${tokenIn.symbol} → ${tokenOut.symbol}`);

  const quote = await router.getQuote(
    tokenIn,
    tokenOut,
    amount,
    { tolerance: DEFAULT_SLIPPAGE.NORMAL, deadlineMinutes: DEFAULT_TTL.NORMAL }
  );

  if (quote) {
    console.log(`✅ Quote received:`);
    console.log(`   Input: ${amount.toString()} ${tokenIn.symbol}`);
    console.log(`   Output: ${quote.outputAmount.toString()} ${tokenOut.symbol}`);
    console.log(`   Price Impact: ${formatSlippage(quote.priceImpact)}`);
    console.log(`   Gas Estimate: $${quote.gasUsd.toFixed(2)}`);
    console.log(`   Execution Price: ${quote.executionPrice.toFixed(6)} ${tokenOut.symbol}/${tokenIn.symbol}`);
  } else {
    console.log(`❌ No quote available for ${tokenIn.symbol}/${tokenOut.symbol}`);
  }
}

/**
 * Demonstrate slippage protection scenarios
 */
async function demonstrateSlippageProtection(): Promise<void> {
  console.log('\n🛡️ Demo 2: Slippage Protection Scenarios');
  console.log('-'.repeat(40));

  for (const scenario of DEMO_CONFIG.slippageScenarios) {
    console.log(`\n📋 Testing ${scenario.name} slippage (${formatSlippage(scenario.tolerance)}):`);
    
    const evaluation = await quickEvaluate('WAVAX', 'USDC', 1000);
    
    if (evaluation.quote) {
      console.log(`   ✅ Quote successful`);
      console.log(`   Profit: $${evaluation.profitUsd.toFixed(2)}`);
      console.log(`   Score: ${evaluation.executionScore.toFixed(1)}/100`);
      
      if (evaluation.warnings.length > 0) {
        console.log(`   ⚠️ Warnings: ${evaluation.warnings.join(', ')}`);
      }
    } else {
      console.log(`   ❌ No route found`);
      if (evaluation.errors.length > 0) {
        console.log(`   Errors: ${evaluation.errors.join(', ')}`);
      }
    }
  }
}

/**
 * Demonstrate trade evaluation and profitability
 */
async function demonstrateTradeEvaluation(): Promise<void> {
  console.log('\n💰 Demo 3: Trade Evaluation & Profitability');
  console.log('-'.repeat(40));

  const evaluator = createTraderJoeEvaluator();

  for (const [tokenInSymbol, tokenOutSymbol] of DEMO_CONFIG.testPairs) {
    console.log(`\n📈 Evaluating ${tokenInSymbol} → ${tokenOutSymbol}:`);
    
    const evaluation = await quickEvaluate(tokenInSymbol, tokenOutSymbol, 1000);
    
    const status = evaluation.profitable ? '✅ PROFITABLE' : '❌ UNPROFITABLE';
    console.log(`   ${status}`);
    console.log(`   Profit: $${evaluation.profitUsd.toFixed(2)}`);
    console.log(`   Gas Cost: $${evaluation.gasUsd.toFixed(2)}`);
    console.log(`   Price Impact: ${formatSlippage(evaluation.priceImpact)}`);
    console.log(`   Execution Score: ${evaluation.executionScore.toFixed(1)}/100`);
    
    if (evaluation.warnings.length > 0) {
      console.log(`   ⚠️ Warnings: ${evaluation.warnings.length}`);
    }
  }
}

/**
 * Demonstrate amount optimization
 */
async function demonstrateAmountOptimization(): Promise<void> {
  console.log('\n⚖️ Demo 4: Trade Size Optimization');
  console.log('-'.repeat(40));

  const evaluator = createTraderJoeEvaluator();
  const tokenIn = AVALANCHE_TOKENS.WAVAX;
  const tokenOut = AVALANCHE_TOKENS.USDC;

  console.log(`\n🎯 Finding optimal trade size for ${tokenIn.symbol} → ${tokenOut.symbol}:`);

  const minAmount = BigInt(1 * 1e18); // 1 WAVAX
  const maxAmount = BigInt(100 * 1e18); // 100 WAVAX

  const result = await evaluator.findOptimalTradeSize(
    tokenIn,
    tokenOut,
    minAmount,
    maxAmount,
    5
  );

  if (result.bestEvaluation) {
    const bestQuote = result.bestEvaluation.quote!;
    const inputAvax = Number(bestQuote.inputAmount) / 1e18;
    
    console.log(`   ✅ Optimal size found:`);
    console.log(`   Amount: ${inputAvax.toFixed(2)} ${tokenIn.symbol}`);
    console.log(`   Profit: $${result.bestEvaluation.profitUsd.toFixed(2)}`);
    console.log(`   Score: ${result.bestEvaluation.executionScore.toFixed(1)}/100`);
  } else {
    console.log(`   ❌ No profitable size found in range`);
  }

  console.log(`\n📊 Tested ${result.allEvaluations.length} different sizes`);
  const profitableCount = result.allEvaluations.filter(e => e.profitable).length;
  console.log(`   Profitable: ${profitableCount}/${result.allEvaluations.length}`);
}

/**
 * Demonstrate common pairs analysis
 */
async function demonstrateCommonPairsAnalysis(): Promise<void> {
  console.log('\n🔍 Demo 5: Common Pairs Analysis');
  console.log('-'.repeat(40));

  const evaluator = createTraderJoeEvaluator();
  
  logger.info('Analyzing common trading pairs...');
  const analysis = await evaluator.evaluateCommonPairs(BigInt(1000 * 1e18));

  console.log(`\n📋 Analysis Results:`);
  console.log(`   Total Pairs Tested: ${analysis.summary.totalPairs}`);
  console.log(`   Profitable Pairs: ${analysis.summary.profitablePairs}`);
  console.log(`   Success Rate: ${((analysis.summary.profitablePairs / analysis.summary.totalPairs) * 100).toFixed(1)}%`);
  console.log(`   Average Gas: $${analysis.summary.averageGasUsd.toFixed(2)}`);
  console.log(`   Average Price Impact: ${formatSlippage(analysis.summary.averagePriceImpact)}`);

  if (analysis.profitable.length > 0) {
    console.log(`\n🏆 Top Profitable Pairs:`);
    analysis.profitable
      .sort((a, b) => b.executionScore - a.executionScore)
      .slice(0, 3)
      .forEach((evaluation, index) => {
        if (evaluation.quote) {
          const pairName = `${evaluation.quote.route.input.symbol}/${evaluation.quote.route.output.symbol}`;
          console.log(`   ${index + 1}. ${pairName} - Score: ${evaluation.executionScore.toFixed(1)} - Profit: $${evaluation.profitUsd.toFixed(2)}`);
        }
      });
  }
}

/**
 * Show final metrics summary
 */
async function showFinalMetrics(): Promise<void> {
  console.log('\n📈 Final Metrics Summary');
  console.log('='.repeat(60));

  // Log metrics through the logger
  logPhase4Metrics();

  // Get detailed metrics
  const metrics = phase4Metrics.getMetrics();
  
  console.log(`\n🕒 Demo Duration: ${Math.round((Date.now() - metrics.startTime.getTime()) / 1000)}s`);
  console.log(`📊 Total Quotes: ${metrics.totalQuotes}`);
  console.log(`✅ Successful: ${metrics.successfulQuotes} (${((metrics.successfulQuotes / metrics.totalQuotes) * 100).toFixed(1)}%)`);
  console.log(`💰 Profitable: ${metrics.profitableEvaluations}`);
  console.log(`💵 Volume Analyzed: $${metrics.totalVolumeAnalyzed.toFixed(2)}`);

  if (metrics.routerPerformance.size > 0) {
    console.log(`\n🔧 Router Performance:`);
    for (const [name, perf] of metrics.routerPerformance) {
      const successRate = perf.quotesRequested > 0 ? (perf.quotesSuccessful / perf.quotesRequested) * 100 : 0;
      console.log(`   ${name}: ${perf.quotesSuccessful}/${perf.quotesRequested} (${successRate.toFixed(1)}%) - Avg: ${perf.averageResponseTime.toFixed(0)}ms`);
    }
  }

  if (metrics.topTokenPairs.length > 0) {
    console.log(`\n🔥 Most Tested Pairs:`);
    metrics.topTokenPairs.slice(0, 3).forEach((pair, index) => {
      console.log(`   ${index + 1}. ${pair.tokenA}/${pair.tokenB}: ${pair.quoteCount} quotes, $${pair.totalVolume.toFixed(2)} volume`);
    });
  }

  console.log(`\n✨ Phase 4 Demo Complete!`);
  console.log('='.repeat(60));
}

/**
 * Utility to repeat a string
 */
// function repeat(str: string, count: number): string {
//   return new Array(count + 1).join(str);
// }

// Run the demo
runPhase4Demo().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});