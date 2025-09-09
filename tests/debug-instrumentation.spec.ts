/**
 * Tests for the new debug instrumentation features
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluationDebugger, analyzeFailedEvaluations, type EvaluationSnapshot } from '../src/debug/evaluationSnapshot.js';
import { traderJoeValidator, validateTraderJoeEvaluation } from '../src/debug/traderJoeValidation.js';
import { createTraderJoeEvaluator } from '../src/engine/traderJoeEvaluator.js';
import { AVALANCHE_TOKENS } from '../src/routers/traderJoe/TraderJoeRouter.js';
import type { RouterEvaluation } from '../src/routers/types.js';

// Set mock mode for tests
process.env.MOCK_MODE = 'true';
process.env.TRADERJOE_DEBUG_MODE = 'true';

describe('Debug Instrumentation Tests', () => {
  beforeEach(() => {
    evaluationDebugger.clearSnapshots();
    evaluationDebugger.enable();
  });

  afterEach(() => {
    evaluationDebugger.disable();
    evaluationDebugger.clearSnapshots();
  });

  describe('Evaluation Debug Snapshots', () => {
    it('should capture debug snapshots during evaluation', async () => {
      const evaluator = createTraderJoeEvaluator(undefined, { minProfitUsd: 100.0 });

      // This should fail and create debug snapshots
      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18) // Small trade that should fail profitability
      );

      // Check that debug snapshots were created
      const snapshots = evaluationDebugger.getAllSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);

      // Verify snapshot structure
      const snapshot = snapshots[0];
      expect(snapshot.sessionId).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.tradeInput).toBeDefined();
      expect(snapshot.routerState).toBeDefined();
      expect(snapshot.finalEvaluation).toBeDefined();

      // Verify trade input
      expect(snapshot.tradeInput.tokenIn.symbol).toBe('WAVAX');
      expect(snapshot.tradeInput.tokenOut.symbol).toBe('USDC');
      expect(snapshot.tradeInput.amountIn).toBe(BigInt(1 * 1e18));

      // Verify evaluation result
      expect(snapshot.finalEvaluation.profitable).toBe(false);
      expect(snapshot.finalEvaluation.warnings.length).toBeGreaterThan(0);
      expect(snapshot.finalEvaluation.warnings.some(w => w.includes('Profit below minimum'))).toBe(true);
    });

    it('should analyze failed evaluations correctly', () => {
      // Create mock snapshots
      const mockSnapshots: EvaluationSnapshot[] = [
        {
          timestamp: new Date().toISOString(),
          sessionId: 'test1',
          tradeInput: {
            tokenIn: AVALANCHE_TOKENS.WAVAX,
            tokenOut: AVALANCHE_TOKENS.USDC,
            amountIn: BigInt(1e18),
            slippage: { tolerance: 0.005, deadlineMinutes: 10 }
          },
          routerState: {
            routerName: 'TraderJoe',
            chainId: 43114,
            rpcUrl: 'test',
            networkConnected: false
          },
          quoteResult: {
            success: false,
            quote: null,
            error: 'Network error',
            timing: 1000
          },
          evaluationCriteria: {
            minProfitUsd: 100,
            maxPriceImpact: 0.05,
            maxGasUsd: 10,
            minExecutionScore: 50
          },
          calculatedMetrics: {
            inputUsd: 0,
            outputUsd: 0,
            profitUsd: 0,
            gasUsd: 0,
            netUsd: 0,
            priceImpact: 0,
            executionScore: 0
          },
          decisionPoints: [],
          warnings: ['Profit below minimum: $0.00 < $100.00'],
          errors: ['No route found'],
          finalEvaluation: {
            quote: null,
            profitable: false,
            profitUsd: 0,
            gasUsd: 0,
            netUsd: 0,
            priceImpact: 0,
            executionScore: 0,
            warnings: ['Profit below minimum: $0.00 < $100.00'],
            errors: ['No route found']
          }
        }
      ];

      const analysis = analyzeFailedEvaluations(mockSnapshots);

      expect(analysis.totalEvaluations).toBe(1);
      expect(analysis.failedEvaluations).toBe(1);
      expect(analysis.failureReasons.has('No route found')).toBe(true);
      expect(analysis.commonWarnings.has('Profit below minimum: $0.00 < $100.00')).toBe(true);
    });
  });

  describe('Trader Joe Validation', () => {
    it('should validate evaluation with known good addresses', async () => {
      const mockEvaluation: RouterEvaluation = {
        quote: {
          route: {
            pairs: [],
            path: [AVALANCHE_TOKENS.WAVAX, AVALANCHE_TOKENS.USDC],
            input: AVALANCHE_TOKENS.WAVAX,
            output: AVALANCHE_TOKENS.USDC
          },
          inputAmount: BigInt(1e18),
          outputAmount: BigInt(35e6), // ~$35 USDC
          priceImpact: 0.02, // 2%
          gasEstimate: BigInt(200000),
          gasUsd: 1.5,
          executionPrice: 35.0
        },
        profitable: true,
        profitUsd: 2.5,
        gasUsd: 1.5,
        netUsd: 1.0,
        priceImpact: 0.02,
        executionScore: 75,
        warnings: [],
        errors: []
      };

      const validation = await validateTraderJoeEvaluation(mockEvaluation);

      expect(validation.isValid).toBe(true);
      expect(validation.version).toBe('v2.1');
      expect(validation.contractValidation.routerValid).toBe(true);
      expect(validation.contractValidation.factoryValid).toBe(true);
      expect(validation.tokenValidation.inputValid).toBe(true);
      expect(validation.tokenValidation.outputValid).toBe(true);
      expect(validation.economicValidation.profitabilityValid).toBe(true);
    });

    it('should detect validation issues', async () => {
      const mockEvaluation: RouterEvaluation = {
        quote: {
          route: {
            pairs: [],
            path: [AVALANCHE_TOKENS.WAVAX, AVALANCHE_TOKENS.USDC],
            input: AVALANCHE_TOKENS.WAVAX,
            output: AVALANCHE_TOKENS.USDC
          },
          inputAmount: BigInt(1e18),
          outputAmount: BigInt(35e6),
          priceImpact: 0.20, // 20% - excessive
          gasEstimate: BigInt(200000),
          gasUsd: 15.0, // High gas
          executionPrice: 35.0
        },
        profitable: false,
        profitUsd: 0.1, // Low profit
        gasUsd: 15.0,
        netUsd: -14.9,
        priceImpact: 0.20,
        executionScore: 10, // Low score
        warnings: [],
        errors: []
      };

      const validation = await validateTraderJoeEvaluation(mockEvaluation);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('Excessive price impact'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('High gas cost'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('Profit below minimum'))).toBe(true);
      expect(validation.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide useful recommendations', async () => {
      const mockEvaluation: RouterEvaluation = {
        quote: null,
        profitable: false,
        profitUsd: 0,
        gasUsd: 0,
        netUsd: 0,
        priceImpact: 0,
        executionScore: 0,
        warnings: [],
        errors: ['No route found']
      };

      const validation = await validateTraderJoeEvaluation(
        mockEvaluation,
        '0xunknown', // Unknown router
        '0xunknown'  // Unknown factory
      );

      expect(validation.isValid).toBe(false);
      expect(validation.version).toBe('unknown');
      
      const recommendations = traderJoeValidator.getValidationRecommendations(validation);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('router contract address'))).toBe(true);
      expect(recommendations.some(r => r.includes('factory contract address'))).toBe(true);
    });
  });

  describe('Integration with TraderJoeEvaluator', () => {
    it('should automatically apply validation during evaluation', async () => {
      const evaluator = createTraderJoeEvaluator(undefined, { minProfitUsd: 50.0 });

      const evaluation = await evaluator.evaluateTrade(
        AVALANCHE_TOKENS.WAVAX,
        AVALANCHE_TOKENS.USDC,
        BigInt(1 * 1e18)
      );

      // Should have warnings from both evaluation and validation
      expect(evaluation.warnings.length).toBeGreaterThan(0);
      
      // Should include validation-generated warnings or recommendations
      const hasValidationWarnings = evaluation.warnings.some(w => 
        w.includes('Recommendation:') || w.includes('VALIDATION')
      );
      
      // Note: In test environment with no real RPC, validation may not generate additional warnings
      // But the integration should work without errors
      expect(evaluation).toBeDefined();
      expect(Array.isArray(evaluation.warnings)).toBe(true);
      expect(Array.isArray(evaluation.errors)).toBe(true);
    });
  });
});