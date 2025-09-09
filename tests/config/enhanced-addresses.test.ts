import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  isPlaceholderAddress, 
  looksLikeSeedOrTestAddress, 
  isAllowedRecipientNonMock,
  getDefaultClaimRecipient,
  validateClaimRecipients
} from '../../src/config/addresses.js';
import type { Address } from '../../src/types/common.js';

describe('Enhanced Address Validation Tests', () => {
  
  describe('Seed/Test Address Detection', () => {
    it('should detect seed address patterns', () => {
      const seedAddresses: Address[] = [
        { value: '0x1234567890123456789012345678901234567890', chain: 'avalanche' },
        { value: '0x2345678901234567890123456789012345678901', chain: 'avalanche' },
        { value: '0x3456789012345678901234567890123456789012', chain: 'avalanche' },
        { value: '0x4567890123456789012345678901234567890123', chain: 'avalanche' },
        { value: '0x5678901234567890123456789012345678901234', chain: 'avalanche' },
        { value: '0x0123456789012345678901234567890123456789', chain: 'avalanche' },
        { value: '0x9876543210987654321098765432109876543210', chain: 'avalanche' },
        { value: '0xabcd1234567890123456789012345678901234567890', chain: 'avalanche' },
        { value: '0xdead1234567890123456789012345678901234567890', chain: 'avalanche' },
        { value: '0xbeef1234567890123456789012345678901234567890', chain: 'avalanche' }
      ];

      for (const address of seedAddresses) {
        expect(looksLikeSeedOrTestAddress(address)).toBe(true);
      }
    });

    it('should detect test keyword patterns', () => {
      const testAddresses: Address[] = [
        { value: '0xtest567890123456789012345678901234567890', chain: 'avalanche' },
        { value: '0xseed567890123456789012345678901234567890', chain: 'avalanche' },
        { value: '0xdemo567890123456789012345678901234567890', chain: 'avalanche' }
      ];

      for (const address of testAddresses) {
        expect(looksLikeSeedOrTestAddress(address)).toBe(true);
      }
    });

    it('should allow valid production addresses', () => {
      const validAddresses: Address[] = [
        { value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D', chain: 'avalanche' },
        { value: '0x8ba1f109551bD432803012645Hac136c', chain: 'avalanche' },
        { value: '0xA0b86a33E6417aAb2CD9A6A321e0C6c676CE9B01', chain: 'avalanche' },
        { value: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', chain: 'avalanche' }
      ];

      for (const address of validAddresses) {
        expect(looksLikeSeedOrTestAddress(address)).toBe(false);
      }
    });
  });

  describe('Non-Mock Recipient Allowlist', () => {
    beforeEach(() => {
      // Mock environment variable
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D';
    });

    it('should allow configured default recipient', () => {
      const allowedAddress: Address = {
        value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche'
      };

      expect(isAllowedRecipientNonMock(allowedAddress)).toBe(true);
    });

    it('should reject placeholder addresses', () => {
      const placeholderAddress: Address = {
        value: '0x0000000000000000000000000000000000000000',
        chain: 'avalanche'
      };

      expect(isAllowedRecipientNonMock(placeholderAddress)).toBe(false);
    });

    it('should reject seed/test addresses', () => {
      const seedAddress: Address = {
        value: '0x1234567890123456789012345678901234567890',
        chain: 'avalanche'
      };

      expect(isAllowedRecipientNonMock(seedAddress)).toBe(false);
    });

    it('should reject addresses not on allowlist', () => {
      const unknownAddress: Address = {
        value: '0xA0b86a33E6417aAb2CD9A6A321e0C6c676CE9B01',
        chain: 'avalanche'
      };

      expect(isAllowedRecipientNonMock(unknownAddress)).toBe(false);
    });

    it('should reject when no default recipient configured', () => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
      
      const address: Address = {
        value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche'
      };

      expect(isAllowedRecipientNonMock(address)).toBe(false);
    });
  });

  describe('Claim Recipients Configuration', () => {
    it('should pass validation in mock mode regardless of configuration', () => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
      
      expect(() => validateClaimRecipients(true)).not.toThrow();
    });

    it('should pass validation when Avalanche recipient is configured', () => {
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D';
      
      expect(() => validateClaimRecipients(false)).not.toThrow();
    });

    it('should fail validation when Avalanche recipient is missing in non-mock mode', () => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
      
      expect(() => validateClaimRecipients(false)).toThrow(
        'Missing required environment variables for non-mock mode: DEFAULT_CLAIM_RECIPIENT_AVAX'
      );
    });

    it('should retrieve configured Avalanche recipient', () => {
      process.env.DEFAULT_CLAIM_RECIPIENT_AVAX = '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D';
      
      const recipient = getDefaultClaimRecipient('avalanche');
      
      expect(recipient).toEqual({
        value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
        chain: 'avalanche'
      });
    });

    it('should return null when recipient not configured', () => {
      delete process.env.DEFAULT_CLAIM_RECIPIENT_AVAX;
      
      const recipient = getDefaultClaimRecipient('avalanche');
      
      expect(recipient).toBeNull();
    });
  });
});