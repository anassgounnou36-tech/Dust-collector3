/**
 * Tests for TTL (Time To Live) and slippage protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  calculateMinOutput, 
  calculateMaxInput, 
  calculateDeadline,
  protectTrade,
  validateSlippageConfig,
  getRecommendedSlippage,
  DEFAULT_SLIPPAGE,
  DEFAULT_TTL 
} from '../../src/core/slippage.js';
import type { SlippageConfig } from '../../src/routers/types.js';

describe('TTL and Slippage Protection', () => {
  describe('Slippage Calculations', () => {
    it('should calculate minimum output correctly', () => {
      const expectedOutput = BigInt(1000 * 1e6); // 1000 USDC
      const slippage = 0.005; // 0.5%

      const minOutput = calculateMinOutput(expectedOutput, slippage);
      const expectedMin = BigInt(995 * 1e6); // 995 USDC

      expect(minOutput).toBe(expectedMin);
    });

    it('should calculate maximum input correctly', () => {
      const expectedInput = BigInt(10 * 1e18); // 10 WAVAX
      const slippage = 0.01; // 1%

      const maxInput = calculateMaxInput(expectedInput, slippage);
      const expectedMax = BigInt(Math.floor(10.1 * 1e18)); // 10.1 WAVAX

      expect(maxInput).toBe(expectedMax);
    });

    it('should handle zero slippage', () => {
      const amount = BigInt(1000 * 1e18);
      const zeroSlippage = 0;

      const minOutput = calculateMinOutput(amount, zeroSlippage);
      const maxInput = calculateMaxInput(amount, zeroSlippage);

      expect(minOutput).toBe(amount);
      expect(maxInput).toBe(amount);
    });

    it('should handle maximum reasonable slippage', () => {
      const amount = BigInt(1000 * 1e18);
      const highSlippage = 0.99; // 99%

      const minOutput = calculateMinOutput(amount, highSlippage);
      const maxInput = calculateMaxInput(amount, highSlippage);

      expect(minOutput).toBeLessThan(amount / 10n); // Should be very small
      expect(maxInput).toBeGreaterThan(amount * 19n / 10n); // Should be much larger
    });

    it('should reject invalid slippage values', () => {
      const amount = BigInt(1000 * 1e18);

      expect(() => calculateMinOutput(amount, -0.1)).toThrow();
      expect(() => calculateMinOutput(amount, 1.0)).toThrow();
      expect(() => calculateMinOutput(amount, 1.1)).toThrow();

      expect(() => calculateMaxInput(amount, -0.1)).toThrow();
      expect(() => calculateMaxInput(amount, 1.0)).toThrow();
      expect(() => calculateMaxInput(amount, 1.1)).toThrow();
    });
  });

  describe('Deadline Calculations', () => {
    it('should calculate deadline correctly', () => {
      const ttlMinutes = 10;
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const deadline = calculateDeadline(ttlMinutes);
      const afterTime = Math.floor(Date.now() / 1000);
      
      expect(deadline).toBeGreaterThanOrEqual(beforeTime + ttlMinutes * 60);
      expect(deadline).toBeLessThanOrEqual(afterTime + ttlMinutes * 60);
    });

    it('should handle different TTL values', () => {
      const shortTtl = calculateDeadline(DEFAULT_TTL.FAST);
      const normalTtl = calculateDeadline(DEFAULT_TTL.NORMAL);
      const longTtl = calculateDeadline(DEFAULT_TTL.SLOW);

      expect(normalTtl).toBeGreaterThan(shortTtl);
      expect(longTtl).toBeGreaterThan(normalTtl);
      
      // Check approximate differences
      expect(normalTtl - shortTtl).toBeCloseTo((DEFAULT_TTL.NORMAL - DEFAULT_TTL.FAST) * 60, 1);
      expect(longTtl - normalTtl).toBeCloseTo((DEFAULT_TTL.SLOW - DEFAULT_TTL.NORMAL) * 60, 1);
    });

    it('should reject invalid TTL values', () => {
      expect(() => calculateDeadline(0)).toThrow();
      expect(() => calculateDeadline(-5)).toThrow();
    });
  });

  describe('Slippage Config Validation', () => {
    it('should validate correct slippage configs', () => {
      const validConfigs: SlippageConfig[] = [
        { tolerance: DEFAULT_SLIPPAGE.CONSERVATIVE, deadlineMinutes: DEFAULT_TTL.NORMAL },
        { tolerance: DEFAULT_SLIPPAGE.NORMAL, deadlineMinutes: DEFAULT_TTL.FAST },
        { tolerance: DEFAULT_SLIPPAGE.AGGRESSIVE, deadlineMinutes: DEFAULT_TTL.SLOW },
        { tolerance: 0.001, deadlineMinutes: 1 },
        { tolerance: 0.5, deadlineMinutes: 120 }
      ];

      validConfigs.forEach(config => {
        expect(() => validateSlippageConfig(config)).not.toThrow();
      });
    });

    it('should reject invalid slippage configs', () => {
      const invalidConfigs: SlippageConfig[] = [
        { tolerance: -0.1, deadlineMinutes: 10 },    // Negative tolerance
        { tolerance: 1.0, deadlineMinutes: 10 },     // 100% tolerance
        { tolerance: 1.5, deadlineMinutes: 10 },     // >100% tolerance
        { tolerance: 0.005, deadlineMinutes: 0 },    // Zero deadline
        { tolerance: 0.005, deadlineMinutes: -5 }    // Negative deadline
      ];

      invalidConfigs.forEach(config => {
        expect(() => validateSlippageConfig(config)).toThrow();
      });
    });

    it('should warn about long deadlines', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const longDeadlineConfig: SlippageConfig = {
        tolerance: 0.005,
        deadlineMinutes: 90 // Long deadline
      };

      validateSlippageConfig(longDeadlineConfig);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Long deadline detected')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Recommended Slippage', () => {
    it('should recommend appropriate slippage for different volumes', () => {
      const lowVolume = getRecommendedSlippage(100, 0.001, 'normal');    // $100
      const medVolume = getRecommendedSlippage(5000, 0.001, 'normal');   // $5K
      const highVolume = getRecommendedSlippage(50000, 0.001, 'normal'); // $50K

      expect(medVolume).toBeGreaterThan(lowVolume);
      expect(highVolume).toBeGreaterThan(medVolume);
    });

    it('should adjust for price impact', () => {
      const lowImpact = getRecommendedSlippage(1000, 0.005, 'normal');  // 0.5% impact
      const medImpact = getRecommendedSlippage(1000, 0.015, 'normal');  // 1.5% impact
      const highImpact = getRecommendedSlippage(1000, 0.03, 'normal');  // 3% impact

      expect(medImpact).toBeGreaterThan(lowImpact);
      expect(highImpact).toBeGreaterThan(medImpact);
    });

    it('should respect urgency levels', () => {
      const lowUrgency = getRecommendedSlippage(1000, 0.01, 'low');
      const normalUrgency = getRecommendedSlippage(1000, 0.01, 'normal');
      const highUrgency = getRecommendedSlippage(1000, 0.01, 'high');

      expect(normalUrgency).toBeGreaterThan(lowUrgency);
      expect(highUrgency).toBeGreaterThan(normalUrgency);
    });

    it('should cap at emergency maximum', () => {
      const veryHighSlippage = getRecommendedSlippage(100000, 0.1, 'high'); // Very high volume and impact
      
      expect(veryHighSlippage).toBeLessThanOrEqual(DEFAULT_SLIPPAGE.EMERGENCY);
    });
  });

  describe('Trade Protection', () => {
    it('should protect output trades correctly', () => {
      const amount = BigInt(1000 * 1e6); // 1000 USDC expected output
      const slippageConfig: SlippageConfig = {
        tolerance: DEFAULT_SLIPPAGE.NORMAL,
        deadlineMinutes: DEFAULT_TTL.NORMAL
      };
      const priceImpact = 0.01; // 1%
      const volumeUsd = 1000;

      const result = protectTrade(amount, slippageConfig, priceImpact, volumeUsd, true);

      expect(result.originalAmount).toBe(amount);
      expect(result.protectedAmount).toBeLessThan(amount);
      expect(result.slippageTolerance).toBe(slippageConfig.tolerance);
      expect(result.deadline).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(result.priceImpact).toBe(priceImpact);
    });

    it('should protect input trades correctly', () => {
      const amount = BigInt(10 * 1e18); // 10 WAVAX input
      const slippageConfig: SlippageConfig = {
        tolerance: DEFAULT_SLIPPAGE.NORMAL,
        deadlineMinutes: DEFAULT_TTL.NORMAL
      };
      const priceImpact = 0.01;
      const volumeUsd = 350; // ~$35 per WAVAX

      const result = protectTrade(amount, slippageConfig, priceImpact, volumeUsd, false);

      expect(result.originalAmount).toBe(amount);
      expect(result.protectedAmount).toBeGreaterThan(amount);
      expect(result.slippageTolerance).toBe(slippageConfig.tolerance);
    });

    it('should generate warnings for risky trades', () => {
      const amount = BigInt(1000 * 1e18);
      const riskyConfig: SlippageConfig = {
        tolerance: 0.001, // Very low tolerance
        deadlineMinutes: 1  // Very short deadline
      };
      const highImpact = 0.06; // 6% price impact
      const highVolume = 50000;

      const result = protectTrade(amount, riskyConfig, highImpact, highVolume, true);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.recommended).toBe(false);
      
      // Should warn about high impact
      expect(result.warnings.some(w => w.includes('High price impact'))).toBe(true);
      
      // Should warn about short deadline
      expect(result.warnings.some(w => w.includes('Very short deadline'))).toBe(true);
    });

    it('should recommend safe trades', () => {
      const amount = BigInt(100 * 1e6); // Small amount
      const safeConfig: SlippageConfig = {
        tolerance: DEFAULT_SLIPPAGE.NORMAL,
        deadlineMinutes: DEFAULT_TTL.NORMAL
      };
      const lowImpact = 0.002; // 0.2% price impact
      const normalVolume = 100;

      const result = protectTrade(amount, safeConfig, lowImpact, normalVolume, true);

      expect(result.warnings.length).toBe(0);
      expect(result.recommended).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amounts', () => {
      const zeroAmount = 0n;
      const slippage = DEFAULT_SLIPPAGE.NORMAL;

      const minOutput = calculateMinOutput(zeroAmount, slippage);
      const maxInput = calculateMaxInput(zeroAmount, slippage);

      expect(minOutput).toBe(0n);
      expect(maxInput).toBe(0n);
    });

    it('should handle very small amounts', () => {
      const tinyAmount = 1n; // 1 wei
      const slippage = DEFAULT_SLIPPAGE.NORMAL;

      const minOutput = calculateMinOutput(tinyAmount, slippage);
      const maxInput = calculateMaxInput(tinyAmount, slippage);

      expect(minOutput).toBeLessThanOrEqual(tinyAmount);
      expect(maxInput).toBeGreaterThanOrEqual(tinyAmount);
    });

    it('should handle very large amounts', () => {
      const largeAmount = BigInt('1000000000000000000000000'); // Very large number
      const slippage = DEFAULT_SLIPPAGE.NORMAL;

      const minOutput = calculateMinOutput(largeAmount, slippage);
      const maxInput = calculateMaxInput(largeAmount, slippage);

      expect(minOutput).toBeLessThan(largeAmount);
      expect(maxInput).toBeGreaterThan(largeAmount);
      
      // Should maintain precision
      const expectedMin = (largeAmount * BigInt(9950)) / BigInt(10000); // 99.5%
      expect(minOutput).toBe(expectedMin);
    });
  });
});