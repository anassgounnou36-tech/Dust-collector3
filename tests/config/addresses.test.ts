import { describe, it, expect, beforeEach } from 'vitest';
import { isPlaceholderAddress, getDefaultClaimRecipient, validateClaimRecipients } from '../../src/config/addresses.js';
import type { Address } from '../../src/types/common.js';

describe('Address Configuration Tests', () => {
  beforeEach(() => {
    // Clean up environment before each test
    delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
    delete process.env.DEFAULT_CLAIM_RECIPIENT_TRON;
  });

  describe('Placeholder Address Detection', () => {
    it('should identify Avalanche placeholder addresses', () => {
      const placeholder: Address = {
        value: '0x0000000000000000000000000000000000000000',
        chain: 'avalanche'
      };
      const valid: Address = {
        value: '0x1234567890123456789012345678901234567890',
        chain: 'avalanche'
      };

      expect(isPlaceholderAddress(placeholder)).toBe(true);
      expect(isPlaceholderAddress(valid)).toBe(false);
    });

    it('should identify TRON placeholder addresses', () => {
      const placeholder: Address = {
        value: 'T0000000000000000000000000000000000000000',
        chain: 'tron'
      };
      const valid: Address = {
        value: 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF',
        chain: 'tron'
      };

      expect(isPlaceholderAddress(placeholder)).toBe(true);
      expect(isPlaceholderAddress(valid)).toBe(false);
    });

    it('should be case insensitive', () => {
      const placeholderUpper: Address = {
        value: '0X0000000000000000000000000000000000000000',
        chain: 'avalanche'
      };
      const placeholderLower: Address = {
        value: '0x0000000000000000000000000000000000000000',
        chain: 'avalanche'
      };

      expect(isPlaceholderAddress(placeholderUpper)).toBe(true);
      expect(isPlaceholderAddress(placeholderLower)).toBe(true);
    });
  });

  describe('Default Claim Recipient Retrieval', () => {
    it('should return configured Avalanche recipient', () => {
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0x1234567890123456789012345678901234567890';
      
      const recipient = getDefaultClaimRecipient('avalanche');
      
      expect(recipient).toEqual({
        value: '0x1234567890123456789012345678901234567890',
        chain: 'avalanche'
      });
    });

    it('should return configured TRON recipient', () => {
      process.env.DEFAULT_CLAIM_RECIPIENT_TRON = 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF';
      
      const recipient = getDefaultClaimRecipient('tron');
      
      expect(recipient).toEqual({
        value: 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF',
        chain: 'tron'
      });
    });

    it('should return null when not configured', () => {
      const avalancheRecipient = getDefaultClaimRecipient('avalanche');
      const tronRecipient = getDefaultClaimRecipient('tron');
      
      expect(avalancheRecipient).toBeNull();
      expect(tronRecipient).toBeNull();
    });
  });

  describe('Claim Recipient Validation', () => {
    it('should pass validation in mock mode regardless of configuration', () => {
      // No environment variables set
      expect(() => validateClaimRecipients(true)).not.toThrow();
    });

    it('should pass validation in non-mock mode when Avalanche recipient is configured', () => {
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0x1234567890123456789012345678901234567890';
      
      expect(() => validateClaimRecipients(false)).not.toThrow();
    });

    it('should fail validation in non-mock mode when Avalanche recipient is missing', () => {
      expect(() => validateClaimRecipients(false)).toThrow(
        'Missing required environment variables for non-mock mode: DEFAULT_CLAIM_RECIPIENT_AVAX'
      );
    });

    it('should be flexible about TRON recipient (not required)', () => {
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0x1234567890123456789012345678901234567890';
      // TRON not set, but should still pass
      
      expect(() => validateClaimRecipients(false)).not.toThrow();
    });

    it('should provide clear error message for missing configuration', () => {
      try {
        validateClaimRecipients(false);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('DEFAULT_CLAIM_RECIPIENT_AVAX');
        expect((error as Error).message).toContain('non-mock mode');
      }
    });
  });
});