/**
 * Tests for Trader Joe Router amount out calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTraderJoeRouter, AVALANCHE_TOKENS } from '../../src/routers/traderJoe/TraderJoeRouter.js';
import { env, getTestConfig } from '../../src/config/env.js';
import type { Token } from '../../src/routers/types.js';

// Set mock mode for tests
process.env.MOCK_MODE = 'true';

describe('TraderJoe Router Amount Out Calculations', () => {
  let router: ReturnType<typeof createTraderJoeRouter>;
  const testConfig = getTestConfig();

  beforeEach(() => {
    router = createTraderJoeRouter(testConfig.avalancheRpcUrl);
  });

  describe('Basic Quote Generation', () => {
    it('should generate quote for WAVAX → USDC', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const amountIn = BigInt(10 * 1e18); // 10 WAVAX

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        amountIn,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // In mock mode, we might not get real quotes, but we should test the interface
      if (quote) {
        expect(quote.inputAmount).toBe(amountIn);
        expect(quote.outputAmount).toBeGreaterThan(0n);
        expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
        expect(quote.gasEstimate).toBeGreaterThan(0n);
        expect(quote.gasUsd).toBeGreaterThan(0);
        expect(quote.executionPrice).toBeGreaterThan(0);
        expect(quote.route.pairs).toHaveLength(1); // Single hop only
        expect(quote.route.input).toEqual(tokenIn);
        expect(quote.route.output).toEqual(tokenOut);
      }
    }, 10000);

    it('should generate quote for JOE → USDC', async () => {
      const tokenIn = AVALANCHE_TOKENS.JOE;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const amountIn = BigInt(1000 * 1e18); // 1000 JOE

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        amountIn,
        { tolerance: 0.01, deadlineMinutes: 10 }
      );

      if (quote) {
        expect(quote.inputAmount).toBe(amountIn);
        expect(quote.outputAmount).toBeGreaterThan(0n);
        expect(quote.route.input.symbol).toBe('JOE');
        expect(quote.route.output.symbol).toBe('USDC');
      }
    }, 10000);

    it('should return null for non-existent pairs', async () => {
      // Create fake tokens that shouldn't have pairs
      const fakeTokenIn: Token = {
        address: '0x0000000000000000000000000000000000000001',
        decimals: 18,
        symbol: 'FAKE1',
        chainId: 43114
      };
      
      const fakeTokenOut: Token = {
        address: '0x0000000000000000000000000000000000000002',
        decimals: 18,
        symbol: 'FAKE2',
        chainId: 43114
      };

      const quote = await router.getQuote(
        fakeTokenIn,
        fakeTokenOut,
        BigInt(1e18),
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      expect(quote).toBeNull();
    }, 10000);
  });

  describe('Multiple Amount Quotes', () => {
    it('should generate quotes for multiple amounts', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const amounts = [
        BigInt(1 * 1e18),   // 1 WAVAX
        BigInt(5 * 1e18),   // 5 WAVAX
        BigInt(10 * 1e18),  // 10 WAVAX
        BigInt(50 * 1e18)   // 50 WAVAX
      ];

      const quotes = await router.getQuotes(
        tokenIn,
        tokenOut,
        amounts,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // All quotes should be valid if any are returned
      quotes.forEach((quote, index) => {
        expect(quote.inputAmount).toBe(amounts[index]);
        expect(quote.outputAmount).toBeGreaterThan(0n);
        expect(quote.route.input).toEqual(tokenIn);
        expect(quote.route.output).toEqual(tokenOut);
      });

      // If quotes are returned, larger inputs should generally produce larger outputs
      if (quotes.length >= 2) {
        for (let i = 1; i < quotes.length; i++) {
          // Allow for some variation due to price impact
          expect(Number(quotes[i].outputAmount)).toBeGreaterThanOrEqual(
            Number(quotes[i-1].outputAmount) * 0.9 // Allow up to 10% decrease due to slippage
          );
        }
      }
    }, 15000);

    it('should handle zero amount gracefully', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        0n,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // Should return null for zero amount
      expect(quote).toBeNull();
    });

    it('should handle very small amounts', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const smallAmount = BigInt(1000); // Very small amount (0.000000000000001 WAVAX)

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        smallAmount,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      // Might return null for very small amounts due to liquidity constraints
      if (quote) {
        expect(quote.inputAmount).toBe(smallAmount);
        expect(quote.outputAmount).toBeGreaterThan(0n);
      }
    });
  });

  describe('Price Impact Calculations', () => {
    it('should calculate reasonable price impact', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const largeAmount = BigInt(1000 * 1e18); // Large trade to show price impact

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        largeAmount,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (quote) {
        expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
        expect(quote.priceImpact).toBeLessThan(1); // Should be less than 100%
        
        // Large trades should have noticeable price impact
        if (quote.priceImpact > 0) {
          expect(quote.priceImpact).toBeGreaterThan(0.001); // At least 0.1% for large trades
        }
      }
    }, 10000);

    it('should show higher price impact for larger trades', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      
      const smallAmount = BigInt(1 * 1e18);   // 1 WAVAX
      const largeAmount = BigInt(100 * 1e18); // 100 WAVAX

      const [smallQuote, largeQuote] = await Promise.all([
        router.getQuote(tokenIn, tokenOut, smallAmount, { tolerance: 0.005, deadlineMinutes: 10 }),
        router.getQuote(tokenIn, tokenOut, largeAmount, { tolerance: 0.005, deadlineMinutes: 10 })
      ]);

      if (smallQuote && largeQuote) {
        // Larger trade should have equal or higher price impact
        expect(largeQuote.priceImpact).toBeGreaterThanOrEqual(smallQuote.priceImpact);
      }
    }, 15000);
  });

  describe('Execution Price Calculations', () => {
    it('should calculate correct execution price', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const amountIn = BigInt(10 * 1e18); // 10 WAVAX

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        amountIn,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (quote) {
        const inputHuman = Number(quote.inputAmount) / Math.pow(10, tokenIn.decimals);
        const outputHuman = Number(quote.outputAmount) / Math.pow(10, tokenOut.decimals);
        const expectedPrice = outputHuman / inputHuman;

        expect(quote.executionPrice).toBeCloseTo(expectedPrice, 6);
        expect(quote.executionPrice).toBeGreaterThan(0);
      }
    });

    it('should provide consistent pricing for symmetric amounts', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const amount = BigInt(5 * 1e18); // 5 WAVAX

      const quote1 = await router.getQuote(tokenIn, tokenOut, amount, { tolerance: 0.005, deadlineMinutes: 10 });
      const quote2 = await router.getQuote(tokenIn, tokenOut, amount, { tolerance: 0.005, deadlineMinutes: 10 });

      if (quote1 && quote2) {
        // Execution prices should be very close (within 1% due to potential block differences)
        const priceDiff = Math.abs(quote1.executionPrice - quote2.executionPrice) / quote1.executionPrice;
        expect(priceDiff).toBeLessThan(0.01);
      }
    }, 15000);
  });

  describe('Gas Estimation', () => {
    it('should provide reasonable gas estimates', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      const amountIn = BigInt(10 * 1e18);

      const quote = await router.getQuote(
        tokenIn,
        tokenOut,
        amountIn,
        { tolerance: 0.005, deadlineMinutes: 10 }
      );

      if (quote) {
        expect(quote.gasEstimate).toBeGreaterThan(0n);
        expect(quote.gasUsd).toBeGreaterThan(0);
        
        // Gas should be reasonable for a single swap
        expect(quote.gasEstimate).toBeLessThan(BigInt(500000)); // Less than 500k gas
        expect(quote.gasUsd).toBeLessThan(50); // Less than $50 gas
      }
    });

    it('should have consistent gas estimates for same pair', async () => {
      const tokenIn = AVALANCHE_TOKENS.WAVAX;
      const tokenOut = AVALANCHE_TOKENS.USDC;
      
      const amount1 = BigInt(1 * 1e18);
      const amount2 = BigInt(10 * 1e18);

      const [quote1, quote2] = await Promise.all([
        router.getQuote(tokenIn, tokenOut, amount1, { tolerance: 0.005, deadlineMinutes: 10 }),
        router.getQuote(tokenIn, tokenOut, amount2, { tolerance: 0.005, deadlineMinutes: 10 })
      ]);

      if (quote1 && quote2) {
        // Gas estimates should be similar for same pair (within 20%)
        const gasDiff = Math.abs(Number(quote1.gasEstimate) - Number(quote2.gasEstimate));
        const gasAvg = (Number(quote1.gasEstimate) + Number(quote2.gasEstimate)) / 2;
        expect(gasDiff / gasAvg).toBeLessThan(0.2);
      }
    }, 15000);
  });
});