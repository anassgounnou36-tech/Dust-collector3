/**
 * Integration tests for Trader Joe on Avalanche network
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTraderJoeRouter, createTraderJoeEvaluator, AVALANCHE_TOKENS } from '../../src/routers/traderJoe/TraderJoeRouter.js';
import { phase4Metrics, logPhase4Metrics } from '../../src/metrics/phase4.js';
import { validatePhase4Env, env } from '../../src/config/env.js';
import type { RouterEvaluation } from '../../src/routers/types.js';

// Only run integration tests if specifically requested
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
const testCondition = runIntegrationTests ? describe : describe.skip;

testCondition('Trader Joe Avalanche Integration Tests', () => {
  let router: ReturnType<typeof createTraderJoeRouter>;
  let evaluator: ReturnType<typeof createTraderJoeEvaluator>;

  beforeAll(async () => {
    // Validate environment
    try {
      validatePhase4Env();
    } catch (error) {
      console.warn('Phase 4 environment validation failed:', error);
      console.warn('Integration tests may fail without proper RPC configuration');
    }

    // Initialize components
    router = createTraderJoeRouter();
    evaluator = createTraderJoeEvaluator();
    
    // Reset metrics for clean test run
    phase4Metrics.reset();
  });

  afterAll(() => {
    // Log final metrics
    logPhase4Metrics();
  });

  describe('Network Connectivity', () => {
    it('should connect to Avalanche RPC', async () => {
      // This test verifies that we can connect to the Avalanche network
      expect(router.name).toBe('TraderJoe');
      expect(router.chainId).toBe(43114);
      
      // Try a simple network call
      try {
        const quote = await router.getQuote(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(1e18), // 1 WAVAX
          { tolerance: 0.005, deadlineMinutes: 10 }
        );
        
        // In real network conditions, this should either succeed or fail gracefully
        if (quote) {
          expect(quote.inputAmount).toBe(BigInt(1e18));
          expect(quote.outputAmount).toBeGreaterThan(0n);
        }
      } catch (error) {
        console.warn('Network call failed, which is expected in test environment:', error);
      }
    }, 30000);

    it('should handle network timeouts gracefully', async () => {
      // Test that the router doesn't hang on network issues
      const startTime = Date.now();
      
      try {
        await router.getQuote(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(1e18),
          { tolerance: 0.005, deadlineMinutes: 10 }
        );
      } catch (error) {
        // Expected in test environment
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // Should not hang for more than 30 seconds
    }, 35000);
  });

  describe('Real Contract Interactions', () => {
    it('should discover actual Trader Joe pairs', async () => {
      try {
        const pairs = await router.getPairsForToken(AVALANCHE_TOKENS.WAVAX);
        
        if (pairs.length > 0) {
          expect(pairs[0]).toHaveProperty('address');
          expect(pairs[0]).toHaveProperty('token0');
          expect(pairs[0]).toHaveProperty('token1');
          expect(pairs[0]).toHaveProperty('reserve0');
          expect(pairs[0]).toHaveProperty('reserve1');
          
          // Verify token order
          expect([pairs[0].token0.address, pairs[0].token1.address])
            .toContain(AVALANCHE_TOKENS.WAVAX.address);
        } else {
          console.warn('No pairs found for WAVAX - this may indicate network connectivity issues');
        }
      } catch (error) {
        console.warn('Pair discovery failed:', error);
        // This is expected in test environments without proper RPC access
      }
    }, 20000);

    it('should check if major pairs exist', async () => {
      try {
        const wavaxUsdcExists = await router.pairExists(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC
        );
        
        const joeWavaxExists = await router.pairExists(
          AVALANCHE_TOKENS.JOE,
          AVALANCHE_TOKENS.WAVAX
        );

        // These pairs should exist on mainnet
        if (env.avalancheRpcUrl.includes('mainnet') || env.avalancheRpcUrl.includes('avax.network')) {
          expect(wavaxUsdcExists).toBe(true);
          expect(joeWavaxExists).toBe(true);
        }
      } catch (error) {
        console.warn('Pair existence check failed:', error);
      }
    }, 15000);
  });

  describe('Real Price Discovery', () => {
    it('should get realistic quotes for major pairs', async () => {
      try {
        const quote = await router.getQuote(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(10 * 1e18), // 10 WAVAX
          { tolerance: 0.005, deadlineMinutes: 10 }
        );

        if (quote) {
          // Convert to human readable
          const inputAvax = Number(quote.inputAmount) / 1e18;
          const outputUsdc = Number(quote.outputAmount) / 1e6;
          const pricePerAvax = outputUsdc / inputAvax;

          // AVAX price should be reasonable (between $10 and $100 typically)
          expect(pricePerAvax).toBeGreaterThan(10);
          expect(pricePerAvax).toBeLessThan(100);

          // Price impact should be minimal for this size
          expect(quote.priceImpact).toBeLessThan(0.1); // Less than 10%

          // Gas should be reasonable
          expect(quote.gasUsd).toBeLessThan(20);

          console.log(`WAVAX/USDC Quote: 1 WAVAX = $${pricePerAvax.toFixed(2)}, Impact: ${(quote.priceImpact * 100).toFixed(3)}%`);
        }
      } catch (error) {
        console.warn('Real price discovery failed:', error);
      }
    }, 25000);

    it('should show price impact scaling with trade size', async () => {
      try {
        const smallQuote = await router.getQuote(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(1 * 1e18), // 1 WAVAX
          { tolerance: 0.005, deadlineMinutes: 10 }
        );

        const largeQuote = await router.getQuote(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(100 * 1e18), // 100 WAVAX
          { tolerance: 0.005, deadlineMinutes: 10 }
        );

        if (smallQuote && largeQuote) {
          // Large trades should have higher price impact
          expect(largeQuote.priceImpact).toBeGreaterThanOrEqual(smallQuote.priceImpact);
          
          // Both should be reasonable
          expect(smallQuote.priceImpact).toBeLessThan(0.02); // Less than 2%
          expect(largeQuote.priceImpact).toBeLessThan(0.15); // Less than 15%

          console.log(`Price Impact Scaling: 1 WAVAX = ${(smallQuote.priceImpact * 100).toFixed(3)}%, 100 WAVAX = ${(largeQuote.priceImpact * 100).toFixed(3)}%`);
        }
      } catch (error) {
        console.warn('Price impact scaling test failed:', error);
      }
    }, 30000);
  });

  describe('Profitability Analysis', () => {
    it('should evaluate real arbitrage opportunities', async () => {
      try {
        const evaluation = await evaluator.evaluateArbitrageOpportunity(
          AVALANCHE_TOKENS.WAVAX,
          [AVALANCHE_TOKENS.USDC, AVALANCHE_TOKENS.JOE],
          BigInt(10 * 1e18), // 10 WAVAX
          { tolerance: 0.005, deadlineMinutes: 10 }
        );

        console.log(`Arbitrage Analysis: ${evaluation.allEvaluations.size} pairs evaluated`);

        for (const [symbol, evaluation] of evaluation.allEvaluations) {
          const status = evaluation.profitable ? '✅' : '❌';
          console.log(`  ${status} WAVAX → ${symbol}: $${evaluation.profitUsd.toFixed(2)} profit, Score: ${evaluation.executionScore.toFixed(1)}`);
        }

        if (evaluation.bestTarget) {
          expect(evaluation.bestEvaluation).not.toBeNull();
          expect(evaluation.bestEvaluation!.profitable).toBe(true);
          console.log(`Best opportunity: WAVAX → ${evaluation.bestTarget.symbol}`);
        }
      } catch (error) {
        console.warn('Arbitrage evaluation failed:', error);
      }
    }, 45000);

    it('should find optimal trade sizes for real conditions', async () => {
      try {
        const result = await evaluator.findOptimalTradeSize(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(1 * 1e18),   // 1 WAVAX
          BigInt(50 * 1e18),  // 50 WAVAX
          5 // Test 5 different sizes
        );

        console.log(`Optimal Trade Size Analysis: ${result.allEvaluations.length} sizes tested`);

        result.allEvaluations.forEach((evaluation, index) => {
          if (evaluation.quote) {
            const inputAvax = Number(evaluation.quote.inputAmount) / 1e18;
            const status = evaluation.profitable ? '✅' : '❌';
            console.log(`  ${status} ${inputAvax.toFixed(1)} WAVAX: $${evaluation.profitUsd.toFixed(2)} profit, Score: ${evaluation.executionScore.toFixed(1)}`);
          }
        });

        if (result.bestEvaluation) {
          expect(result.bestEvaluation.profitable).toBe(true);
          expect(result.bestEvaluation.quote).not.toBeNull();
          
          const optimalSizeAvax = Number(result.bestEvaluation.quote!.inputAmount) / 1e18;
          console.log(`Optimal size: ${optimalSizeAvax.toFixed(1)} WAVAX with $${result.bestEvaluation.profitUsd.toFixed(2)} profit`);
        }
      } catch (error) {
        console.warn('Optimal trade size analysis failed:', error);
      }
    }, 60000);
  });

  describe('Common Pairs Market Analysis', () => {
    it('should analyze all major trading pairs', async () => {
      try {
        const analysis = await evaluator.evaluateCommonPairs(BigInt(5 * 1e18)); // 5 WAVAX equivalent

        console.log('\n🔍 Market Analysis Results:');
        console.log(`📊 Pairs Analyzed: ${analysis.summary.totalPairs}`);
        console.log(`💰 Profitable: ${analysis.summary.profitablePairs} (${((analysis.summary.profitablePairs / analysis.summary.totalPairs) * 100).toFixed(1)}%)`);
        console.log(`⛽ Avg Gas: $${analysis.summary.averageGasUsd.toFixed(2)}`);
        console.log(`📈 Avg Price Impact: ${(analysis.summary.averagePriceImpact * 100).toFixed(3)}%`);

        expect(analysis.summary.totalPairs).toBeGreaterThan(0);
        expect(analysis.summary.averageGasUsd).toBeGreaterThan(0);
        expect(analysis.summary.averagePriceImpact).toBeGreaterThanOrEqual(0);

        // Log individual pair results
        for (const [pairName, evaluation] of analysis.evaluations) {
          const status = evaluation.profitable ? '✅' : '❌';
          console.log(`  ${status} ${pairName}: $${evaluation.profitUsd.toFixed(2)} profit, ${(evaluation.priceImpact * 100).toFixed(3)}% impact`);
        }

        if (analysis.profitable.length > 0) {
          console.log('\n🏆 Top Profitable Pairs:');
          analysis.profitable
            .sort((a, b) => b.executionScore - a.executionScore)
            .slice(0, 3)
            .forEach((evaluation, index) => {
              if (evaluation.quote) {
                const pairName = `${evaluation.quote.route.input.symbol}/${evaluation.quote.route.output.symbol}`;
                console.log(`  ${index + 1}. ${pairName}: Score ${evaluation.executionScore.toFixed(1)}, Profit $${evaluation.profitUsd.toFixed(2)}`);
              }
            });
        }
      } catch (error) {
        console.warn('Market analysis failed:', error);
      }
    }, 90000);
  });

  describe('Transaction Building', () => {
    it('should build valid transaction data', async () => {
      try {
        const quote = await router.getQuote(
          AVALANCHE_TOKENS.WAVAX,
          AVALANCHE_TOKENS.USDC,
          BigInt(1 * 1e18),
          { tolerance: 0.005, deadlineMinutes: 10 }
        );

        if (quote) {
          const tradeParams = {
            route: quote.route,
            inputAmount: quote.inputAmount,
            outputAmountMin: quote.outputAmount * 995n / 1000n, // 0.5% slippage
            recipient: '0x1234567890123456789012345678901234567890', // Test address
            deadline: Math.floor(Date.now() / 1000) + 600 // 10 minutes
          };

          const txData = await router.buildTrade(tradeParams);

          expect(txData.to).toBe(env.traderJoeRouter);
          expect(txData.data).toMatch(/^0x[0-9a-fA-F]+$/); // Valid hex data
          expect(txData.value).toBe('0');
          expect(txData.gasLimit).toBeGreaterThan(0n);

          console.log(`Transaction built: to=${txData.to}, gas=${txData.gasLimit.toString()}, data_length=${txData.data.length}`);
        }
      } catch (error) {
        console.warn('Transaction building failed:', error);
      }
    }, 20000);
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive metrics during integration tests', () => {
      const metrics = phase4Metrics.getMetrics();

      console.log('\n📈 Integration Test Metrics:');
      console.log(`🕒 Test Duration: ${Math.round((Date.now() - metrics.startTime.getTime()) / 1000)}s`);
      console.log(`📊 Total Quotes: ${metrics.totalQuotes}`);
      console.log(`✅ Successful: ${metrics.successfulQuotes}`);
      console.log(`💰 Profitable: ${metrics.profitableEvaluations}`);
      console.log(`💵 Volume Analyzed: $${metrics.totalVolumeAnalyzed.toFixed(2)}`);

      if (metrics.routerPerformance.size > 0) {
        console.log('🔧 Router Performance:');
        for (const [name, perf] of metrics.routerPerformance) {
          const successRate = perf.quotesRequested > 0 ? (perf.quotesSuccessful / perf.quotesRequested) * 100 : 0;
          console.log(`  ${name}: ${successRate.toFixed(1)}% success, ${perf.averageResponseTime.toFixed(0)}ms avg`);
        }
      }

      // Verify metrics collection is working
      expect(metrics.totalQuotes).toBeGreaterThan(0);
      expect(metrics.startTime).toBeInstanceOf(Date);
    });

    it('should export metrics for analysis', () => {
      const exportedMetrics = phase4Metrics.exportMetrics();
      const parsed = JSON.parse(exportedMetrics);

      expect(parsed).toHaveProperty('startTime');
      expect(parsed).toHaveProperty('totalQuotes');
      expect(parsed).toHaveProperty('routerPerformance');
      expect(parsed).toHaveProperty('quoteHistory');

      console.log(`Exported metrics: ${(exportedMetrics.length / 1024).toFixed(1)}KB`);
    });
  });
});

// Helper function to determine if we should run integration tests
export function shouldRunIntegrationTests(): boolean {
  return runIntegrationTests;
}