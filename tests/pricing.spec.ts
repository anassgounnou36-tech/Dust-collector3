import { describe, it, expect, beforeEach, vi } from 'vitest';
import { quoteToUsd, isStablecoin, getTokenDecimals } from '../src/economics/pricing.js';

// Mock console.warn to track warnings
const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Pricing Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isStablecoin', () => {
    it('should identify stable tokens correctly', () => {
      expect(isStablecoin('USDC')).toBe(true);
      expect(isStablecoin('usdt')).toBe(true);
      expect(isStablecoin('DAI')).toBe(true);
      expect(isStablecoin('AVAX')).toBe(false);
      expect(isStablecoin('JOE')).toBe(false);
    });
  });

  describe('getTokenDecimals', () => {
    it('should return correct decimals for known tokens', () => {
      expect(getTokenDecimals('USDC')).toBe(6);
      expect(getTokenDecimals('USDT')).toBe(6);
      expect(getTokenDecimals('DAI')).toBe(18);
      expect(getTokenDecimals('UNKNOWN')).toBe(18); // fallback
    });
  });

  describe('quoteToUsd', () => {
    it('should return expected USD value for stable tokens', async () => {
      // USDC with 6 decimals: 1000000 wei = 1.0 USD
      const usdcAddress = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
      const result = await quoteToUsd('avalanche', usdcAddress, '1000000');
      
      expect(result).toBe(1.0);
    });

    it('should return expected USD value for DAI (18 decimals)', async () => {
      // DAI with 18 decimals: 1000000000000000000 wei = 1.0 USD
      const daiAddress = '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70';
      const result = await quoteToUsd('avalanche', daiAddress, '1000000000000000000');
      
      expect(result).toBe(1.0);
    });

    it('should return 0 for non-stable tokens with warning', async () => {
      // WAVAX address (not a stablecoin)
      const wavaxAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
      const result = await quoteToUsd('avalanche', wavaxAddress, '1000000000000000000');
      
      expect(result).toBe(0);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('Non-stable token pricing not implemented')
      );
    });

    it('should return 0 for unknown token addresses with warning', async () => {
      const unknownAddress = '0x1234567890123456789012345678901234567890';
      const result = await quoteToUsd('avalanche', unknownAddress, '1000000000000000000');
      
      expect(result).toBe(0);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('Non-stable token pricing not implemented')
      );
    });

    it('should return 0 for non-avalanche chains with warning', async () => {
      const usdcAddress = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
      // @ts-ignore - Testing runtime behavior
      const result = await quoteToUsd('tron', usdcAddress, '1000000');
      
      expect(result).toBe(0);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('Chain tron not supported')
      );
    });

    it('should handle multiple calls with different amounts', async () => {
      const usdcAddress = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
      
      const result1 = await quoteToUsd('avalanche', usdcAddress, '500000'); // 0.5 USDC
      const result2 = await quoteToUsd('avalanche', usdcAddress, '2500000'); // 2.5 USDC
      
      expect(result1).toBe(0.5);
      expect(result2).toBe(2.5);
    });
  });
});