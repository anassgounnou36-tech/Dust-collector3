#!/usr/bin/env tsx
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const TraderJoeRouter_js_1 = require("../src/routers/traderJoe/TraderJoeRouter.js");
const traderJoeEvaluator_js_1 = require("../src/engine/traderJoeEvaluator.js");
const phase4_js_1 = require("../src/metrics/phase4.js");
const env_js_1 = require("../src/config/env.js");
const logger_js_1 = require("../src/engine/logger.js");
const slippage_js_1 = require("../src/core/slippage.js");
// Load environment variables
(0, dotenv_1.config)();
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
    ],
    // Slippage scenarios
    slippageScenarios: [
        { name: 'Conservative', tolerance: slippage_js_1.DEFAULT_SLIPPAGE.CONSERVATIVE, deadlineMinutes: slippage_js_1.DEFAULT_TTL.NORMAL },
        { name: 'Normal', tolerance: slippage_js_1.DEFAULT_SLIPPAGE.NORMAL, deadlineMinutes: slippage_js_1.DEFAULT_TTL.NORMAL },
        { name: 'Aggressive', tolerance: slippage_js_1.DEFAULT_SLIPPAGE.AGGRESSIVE, deadlineMinutes: slippage_js_1.DEFAULT_TTL.FAST }
    ]
};
/**
 * Main demo function
 */
async function runPhase4Demo() {
    console.log('\n🚀 Phase 4 Offline Demo - Trader Joe Router Dry-Run\n');
    console.log('='.repeat(60));
    try {
        // Validate environment
        logger_js_1.logger.info('Validating Phase 4 environment...');
        (0, env_js_1.validatePhase4Env)();
        logger_js_1.logger.info('✅ Environment validation passed');
        // Initialize router and evaluator
        logger_js_1.logger.info('Initializing Trader Joe router...');
        const router = (0, TraderJoeRouter_js_1.createTraderJoeRouter)();
        const evaluator = (0, traderJoeEvaluator_js_1.createTraderJoeEvaluator)();
        logger_js_1.logger.info(`✅ Router initialized: ${router.name} (Chain: ${router.chainId})`);
        // Reset metrics for clean demo
        phase4_js_1.phase4Metrics.reset();
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
    }
    catch (error) {
        logger_js_1.logger.error('Demo failed:', error);
        process.exit(1);
    }
}
/**
 * Demonstrate basic quote generation
 */
async function demonstrateBasicQuotes() {
    console.log('\n📊 Demo 1: Basic Quote Generation');
    console.log('-'.repeat(40));
    const router = (0, TraderJoeRouter_js_1.createTraderJoeRouter)();
    const tokenIn = TraderJoeRouter_js_1.AVALANCHE_TOKENS.WAVAX;
    const tokenOut = TraderJoeRouter_js_1.AVALANCHE_TOKENS.USDC;
    const amount = BigInt(10 * 1e18); // 10 WAVAX
    logger_js_1.logger.info(`Getting quote: ${amount.toString()} ${tokenIn.symbol} → ${tokenOut.symbol}`);
    const quote = await router.getQuote(tokenIn, tokenOut, amount, { tolerance: slippage_js_1.DEFAULT_SLIPPAGE.NORMAL, deadlineMinutes: slippage_js_1.DEFAULT_TTL.NORMAL });
    if (quote) {
        console.log(`✅ Quote received:`);
        console.log(`   Input: ${amount.toString()} ${tokenIn.symbol}`);
        console.log(`   Output: ${quote.outputAmount.toString()} ${tokenOut.symbol}`);
        console.log(`   Price Impact: ${(0, slippage_js_1.formatSlippage)(quote.priceImpact)}`);
        console.log(`   Gas Estimate: $${quote.gasUsd.toFixed(2)}`);
        console.log(`   Execution Price: ${quote.executionPrice.toFixed(6)} ${tokenOut.symbol}/${tokenIn.symbol}`);
    }
    else {
        console.log(`❌ No quote available for ${tokenIn.symbol}/${tokenOut.symbol}`);
    }
}
/**
 * Demonstrate slippage protection scenarios
 */
async function demonstrateSlippageProtection() {
    console.log('\n🛡️ Demo 2: Slippage Protection Scenarios');
    console.log('-'.repeat(40));
    for (const scenario of DEMO_CONFIG.slippageScenarios) {
        console.log(`\n📋 Testing ${scenario.name} slippage (${(0, slippage_js_1.formatSlippage)(scenario.tolerance)}):`);
        const evaluation = await (0, traderJoeEvaluator_js_1.quickEvaluate)('WAVAX', 'USDC', 1000);
        if (evaluation.quote) {
            console.log(`   ✅ Quote successful`);
            console.log(`   Profit: $${evaluation.profitUsd.toFixed(2)}`);
            console.log(`   Score: ${evaluation.executionScore.toFixed(1)}/100`);
            if (evaluation.warnings.length > 0) {
                console.log(`   ⚠️ Warnings: ${evaluation.warnings.join(', ')}`);
            }
        }
        else {
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
async function demonstrateTradeEvaluation() {
    console.log('\n💰 Demo 3: Trade Evaluation & Profitability');
    console.log('-'.repeat(40));
    const evaluator = (0, traderJoeEvaluator_js_1.createTraderJoeEvaluator)();
    for (const [tokenInSymbol, tokenOutSymbol] of DEMO_CONFIG.testPairs) {
        console.log(`\n📈 Evaluating ${tokenInSymbol} → ${tokenOutSymbol}:`);
        const evaluation = await (0, traderJoeEvaluator_js_1.quickEvaluate)(tokenInSymbol, tokenOutSymbol, 1000);
        const status = evaluation.profitable ? '✅ PROFITABLE' : '❌ UNPROFITABLE';
        console.log(`   ${status}`);
        console.log(`   Profit: $${evaluation.profitUsd.toFixed(2)}`);
        console.log(`   Gas Cost: $${evaluation.gasUsd.toFixed(2)}`);
        console.log(`   Price Impact: ${(0, slippage_js_1.formatSlippage)(evaluation.priceImpact)}`);
        console.log(`   Execution Score: ${evaluation.executionScore.toFixed(1)}/100`);
        if (evaluation.warnings.length > 0) {
            console.log(`   ⚠️ Warnings: ${evaluation.warnings.length}`);
        }
    }
}
/**
 * Demonstrate amount optimization
 */
async function demonstrateAmountOptimization() {
    console.log('\n⚖️ Demo 4: Trade Size Optimization');
    console.log('-'.repeat(40));
    const evaluator = (0, traderJoeEvaluator_js_1.createTraderJoeEvaluator)();
    const tokenIn = TraderJoeRouter_js_1.AVALANCHE_TOKENS.WAVAX;
    const tokenOut = TraderJoeRouter_js_1.AVALANCHE_TOKENS.USDC;
    console.log(`\n🎯 Finding optimal trade size for ${tokenIn.symbol} → ${tokenOut.symbol}:`);
    const minAmount = BigInt(1 * 1e18); // 1 WAVAX
    const maxAmount = BigInt(100 * 1e18); // 100 WAVAX
    const result = await evaluator.findOptimalTradeSize(tokenIn, tokenOut, minAmount, maxAmount, 5);
    if (result.bestEvaluation) {
        const bestQuote = result.bestEvaluation.quote;
        const inputAvax = Number(bestQuote.inputAmount) / 1e18;
        console.log(`   ✅ Optimal size found:`);
        console.log(`   Amount: ${inputAvax.toFixed(2)} ${tokenIn.symbol}`);
        console.log(`   Profit: $${result.bestEvaluation.profitUsd.toFixed(2)}`);
        console.log(`   Score: ${result.bestEvaluation.executionScore.toFixed(1)}/100`);
    }
    else {
        console.log(`   ❌ No profitable size found in range`);
    }
    console.log(`\n📊 Tested ${result.allEvaluations.length} different sizes`);
    const profitableCount = result.allEvaluations.filter(e => e.profitable).length;
    console.log(`   Profitable: ${profitableCount}/${result.allEvaluations.length}`);
}
/**
 * Demonstrate common pairs analysis
 */
async function demonstrateCommonPairsAnalysis() {
    console.log('\n🔍 Demo 5: Common Pairs Analysis');
    console.log('-'.repeat(40));
    const evaluator = (0, traderJoeEvaluator_js_1.createTraderJoeEvaluator)();
    logger_js_1.logger.info('Analyzing common trading pairs...');
    const analysis = await evaluator.evaluateCommonPairs(BigInt(1000 * 1e18));
    console.log(`\n📋 Analysis Results:`);
    console.log(`   Total Pairs Tested: ${analysis.summary.totalPairs}`);
    console.log(`   Profitable Pairs: ${analysis.summary.profitablePairs}`);
    console.log(`   Success Rate: ${((analysis.summary.profitablePairs / analysis.summary.totalPairs) * 100).toFixed(1)}%`);
    console.log(`   Average Gas: $${analysis.summary.averageGasUsd.toFixed(2)}`);
    console.log(`   Average Price Impact: ${(0, slippage_js_1.formatSlippage)(analysis.summary.averagePriceImpact)}`);
    if (analysis.profitable.length > 0) {
        console.log(`\n🏆 Top Profitable Pairs:`);
        analysis.profitable
            .sort((a, b) => b.executionScore - a.executionScore)
            .slice(0, 3)
            .forEach((eval, index) => {
            if (eval.quote) {
                const pairName = `${eval.quote.route.input.symbol}/${eval.quote.route.output.symbol}`;
                console.log(`   ${index + 1}. ${pairName} - Score: ${eval.executionScore.toFixed(1)} - Profit: $${eval.profitUsd.toFixed(2)}`);
            }
        });
    }
}
/**
 * Show final metrics summary
 */
async function showFinalMetrics() {
    console.log('\n📈 Final Metrics Summary');
    console.log('='.repeat(60));
    // Log metrics through the logger
    (0, phase4_js_1.logPhase4Metrics)();
    // Get detailed metrics
    const metrics = phase4_js_1.phase4Metrics.getMetrics();
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
//# sourceMappingURL=phase4-offline-demo.js.map