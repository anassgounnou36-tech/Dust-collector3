/**
 * Tests for below minimum profit scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTraderJoeEvaluator, quickEvaluate } from '../../src/engine/traderJoeEvaluator.js';
import { AVALANCHE_TOKENS } from '../../src/routers/traderJoe/TraderJoeRouter.js';
import { getTestConfig } from '../../src/config/env.js';
import type { Token } from '../../src/routers/types.js';

// Set mock mode for tests
process.env.MOCK_MODE = 'true';

describe('Below Minimum Profit Scenarios', () => {
  let evaluator: ReturnType<typeof createTraderJoeEvaluator>;
  const testConfig = getTestConfig();

  beforeEach(() => {
    // Create evaluator with very high minimum profit requirement
    evaluator = createTraderJoeEvaluator(testConfig.avalancheRpcUrl, {
      minProfitUsd: 100.0 // $100 minimum profit
    });
  });

  describe('High Minimum Profit Threshold', () => {
    it('should mark small trades as unprofitable', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18), // Small 1 WAVAX trade
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // With $100 minimum profit requirement, small trades should be unprofitable
      expect(evaluation.profitable).toBe(false);
      expect(evaluation.profitUsd).toBeLessThan(100);
      expect(evaluation.warnings.some(w => w.includes('Profit below minimum'))).toBe(true);
      expect(evaluation.executionScore).toBeLessThan(50); // Low score due to insufficient profit
    });

    it('should mark medium trades as potentially unprofitable', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(10 * 1e18), // 10 WAVAX trade (~$350)
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // Even medium trades might not meet $100 profit requirement
      if (!evaluation.profitable) {
        expect(evaluation.profitUsd).toBeLessThan(100);
        expect(evaluation.warnings.some(w => w.includes('Profit below minimum'))).toBe(true);
      }
    });

    it('should provide detailed unprofitability reasons', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.JOE,
        AVALANCHE_TOKENS.USDC,
        BigInt(100 * 1e18), // 100 JOE (~$50)
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (!evaluation.profitable) {
        expect(evaluation.warnings.length).toBeGreaterThan(0);
        
        // Should explain why it's not profitable
        const hasRelevantWarning = evaluation.warnings.some(warning => 
          warning.includes('Profit below minimum') ||
          warning.includes('High gas cost') ||
          warning.includes('High price impact')
        );
        expect(hasRelevantWarning).toBe(true);
        
        expect(evaluation.executionScore).toBeLessThan(50);
      }
    });
  });

  describe('Gas Cost Impact on Profitability', () => {
    it('should account for gas costs in profitability', async () => {
      // Create evaluator with normal minimum profit but simulate high gas environment
      const normalEvaluator = createTraderJoeEvaluator(testConfig.avalancheRpcUrl, {
        minProfitUsd: 1.0,
        maxGasUsd: 2.0 // Low gas tolerance
      });

      const evaluation = await normalEvaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(2 * 1e18), // 2 WAVAX
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (evaluation.quote && evaluation.quote.gasUsd > 2.0) {
        expect(evaluation.profitable).toBe(false);
        expect(evaluation.warnings.some(w => w.includes('High gas cost'))).toBe(true);
      }
    });

    it('should show net profit after gas costs', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(5 * 1e18), // 5 WAVAX
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (evaluation.quote) {
        // Net profit should be gross profit minus gas costs
        const grossProfit = evaluation.profitUsd + evaluation.gasUsd;
        expect(evaluation.netUsd).toBeCloseTo(evaluation.profitUsd, 2);
        
        // Ensure gas costs are properly deducted
        expect(evaluation.gasUsd).toBeGreaterThan(0);
        expect(evaluation.netUsd).toBeLessThan(grossProfit);
      }
    });
  });

  describe('Price Impact on Profitability', () => {
    it('should penalize high price impact trades', async () => {
      // Test with a large trade that should have high price impact
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.JOE,
        AVALANCHE_TOKENS.WAVAX,
        BigInt(100000 * 1e18), // Very large JOE trade
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (evaluation.quote && evaluation.quote.priceImpact > 0.05) {
        expect(evaluation.warnings.some(w => w.includes('High price impact'))).toBe(true);
        expect(evaluation.executionScore).toBeLessThan(70); // Penalized score
      }
    });

    it('should warn about excessive price impact', async () => {
      const largeEvaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(1000 * 1e18), // Very large WAVAX trade
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (largeEvaluation.quote && largeEvaluation.priceImpact > 0.03) {
        expect(largeEvaluation.warnings.some(w => w.includes('price impact'))).toBe(true);
      }
    });
  });

  describe('Low Liquidity Scenarios', () => {
    it('should handle tokens with low liquidity', async () => {
      // Create a mock low-liquidity token
      const lowLiquidityToken: Token = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        symbol: 'LOWLIQ',
        chainId: 43114
      };

      const evaluation = await evaluator.evaluateTrade(
        lowLiquidityToken,
        AVALANCHE_TOKENS.USDC,
        BigInt(1000 * 1e18),
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // Should either fail to find a route or have poor execution characteristics
      if (evaluation.quote === null) {
        expect(evaluation.profitable).toBe(false);
        expect(evaluation.errors.length).toBeGreaterThan(0);
      } else {
        // If a route is found, it should have warnings about liquidity
        expect(evaluation.priceImpact).toBeGreaterThan(0.1); // High impact due to low liquidity
      }
    });

    it('should warn about very small output amounts', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.JOE,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18), // 1 JOE (very small)
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (evaluation.quote) {
        const outputUsd = evaluation.profitUsd + evaluation.gasUsd; // Approximate output value
        if (outputUsd < 10) {
          expect(evaluation.warnings.some(w => w.includes('small output'))).toBe(true);
        }
      }
    });
  });

  describe('Execution Score Penalties', () => {
    it('should give low scores to unprofitable trades', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18), // Small trade unlikely to be profitable
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (!evaluation.profitable) {
        expect(evaluation.executionScore).toBeLessThan(30);
      }
    });

    it('should score profitable trades higher', async () => {
      // Use lower minimum profit for this test
      const profitableEvaluator = createTraderJoeEvaluator(testConfig.avalancheRpcUrl, {
        minProfitUsd: 0.1 // Very low threshold
      });

      const evaluation = await profitableEvaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(10 * 1e18), // Larger trade more likely to be profitable
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (evaluation.profitable) {
        expect(evaluation.executionScore).toBeGreaterThan(50);
      }
    });

    it('should consider multiple factors in scoring', async () => {
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(5 * 1e18),
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (evaluation.quote) {
        // Score should reflect profit, gas costs, and price impact
        if (evaluation.profitUsd > 0) {
          expect(evaluation.executionScore).toBeGreaterThan(30);
        }
        
        if (evaluation.gasUsd > 10) {
          expect(evaluation.executionScore).toBeLessThan(80); // Penalty for high gas
        }
        
        if (evaluation.priceImpact > 0.05) {
          expect(evaluation.executionScore).toBeLessThan(70); // Penalty for high impact
        }
      }
    });
  });

  describe('Amount Optimization for Profitability', () => {
    it('should find no profitable amounts when threshold is too high', async () => {
      const result = await evaluator.findOptimalTradeSize(
        AVALANCHE_TOKENS.JOE,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18),   // Min: 1 JOE
        BigInt(100 * 1e18), // Max: 100 JOE
        5
      );

      // With $100 minimum profit, JOE trades are unlikely to be profitable
      expect(result.bestEvaluation).toBeNull();
      expect(result.allEvaluations.every(e => !e.profitable)).toBe(true);
    });

    it('should provide insights on why trades are unprofitable', async () => {
      const result = await evaluator.findOptimalTradeSize(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18),  // Min: 1 WAVAX
        BigInt(10 * 1e18), // Max: 10 WAVAX
        3
      );

      // Check that evaluations provide useful feedback
      result.allEvaluations.forEach(evaluation => {
        if (!evaluation.profitable) {
          expect(evaluation.warnings.length).toBeGreaterThan(0);
          
          // Should have specific reasons for unprofitability
          const hasSpecificReason = evaluation.warnings.some(warning =>
            warning.includes('Profit below minimum') ||
            warning.includes('High gas cost') ||
            warning.includes('High price impact')
          );
          expect(hasSpecificReason).toBe(true);
        }
      });
    });
  });

  describe('Quick Evaluation Utility', () => {
    it('should quickly identify unprofitable standard trades', async () => {
      // Test the quickEvaluate utility with small amounts
      const smallTradeEvaluation = await quickEvaluate('JOE', 'USDC', 10); // $10 worth

      expect(smallTradeEvaluation.profitable).toBe(false);
      expect(smallTradeEvaluation.profitUsd).toBeLessThan(100);
    });

    it('should provide consistent results with full evaluation', async () => {
      const quickResult = await quickEvaluate('WAVAX', 'USDC', 1000); // $1000 worth
      
      const fullResult = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(Math.floor(1000 / 35 * 1e18)), // Convert $1000 to WAVAX amount
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // Results should be consistent
      expect(quickResult.profitable).toBe(fullResult.profitable);
      
      if (quickResult.quote && fullResult.quote) {
        expect(quickResult.executionScore).toBeCloseTo(fullResult.executionScore, 0);
      }
    });
  });
});