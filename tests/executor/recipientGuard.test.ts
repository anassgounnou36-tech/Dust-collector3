import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execute, injectPricingService } from '../../src/engine/executor.js';
import { isPlaceholderAddress } from '../../src/config/addresses.js';
import type { ClaimBundle, ChainClient, TxResult, Address } from '../../src/types/common.js';

// Mock the address validation functions
vi.mock('../../src/config/addresses.js', async () => {
  const actual = await vi.importActual('../../src/config/addresses.js') as any;
  return {
    ...actual,
    looksLikeSeedOrTestAddress: vi.fn((address: Address) => {
      // Only consider 0x1234... as seed addresses for tests
      return address.value.toLowerCase().startsWith('0x1234');
    }),
    isAllowedRecipientNonMock: vi.fn((address: Address) => {
      // Allow the new valid address for tests
      return address.value === '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D';
    }),
    getDefaultClaimRecipient: vi.fn((chain: string) => {
      if (chain === 'avalanche') {
        return {
          value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
          chain: 'avalanche'
        };
      }
      return null;
    })
  };
});

describe('Recipient Guard Tests', () => {
  let mockClient: ChainClient;
  let mockBundle: ClaimBundle;
  let placeholderAddress: Address;
  let validAddress: Address;

  beforeEach(() => {
    // Mock client
    mockClient = {
      chain: 'avalanche',
      gasPrice: async () => BigInt(25000000000),
      nativeUsd: async () => 40.0,
      simulate: async () => ({ ok: true }),
      getCode: async (address: string) => '0x608060405234801561001057600080fd5b50', // Mock contract bytecode
      sendRaw: async (bundle) => ({
        success: true,
        txHash: '0x123abc',
        claimedUsd: bundle.totalUsd,
        chain: bundle.chain,
        gasUsed: '100000',
        gasUsd: 2.5
      })
    };

    // Test addresses
    placeholderAddress = {
      value: '0x0000000000000000000000000000000000000000',
      chain: 'avalanche'
    };

    validAddress = {
      value: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
      chain: 'avalanche'
    };

    // Mock bundle with placeholder recipient
    mockBundle = {
      id: 'test-bundle-1',
      chain: 'avalanche',
      protocol: 'test',
      claimTo: placeholderAddress,
      items: [{
        id: 'reward-1',
        wallet: validAddress,
        protocol: 'test',
        token: { value: '0xTokenAddress', chain: 'avalanche' },
        amountWei: '1000000000000000000',
        amountUsd: 5.0,
        claimTo: placeholderAddress,
        discoveredAt: new Date()
      }],
      totalUsd: 5.0,
      estGasUsd: 2.5,
      netUsd: 2.5
    };
  });

  describe('Placeholder Address Detection', () => {
    it('should identify placeholder addresses correctly', () => {
      expect(isPlaceholderAddress(placeholderAddress)).toBe(true);
      expect(isPlaceholderAddress(validAddress)).toBe(false);
    });

    it('should identify TRON placeholder addresses', () => {
      const tronPlaceholder: Address = {
        value: 'T0000000000000000000000000000000000000000',
        chain: 'tron'
      };
      const tronValid: Address = {
        value: 'TLPpXqMKVVsVUTGKrKWScDqVq66dGKJCqF',
        chain: 'tron'
      };

      expect(isPlaceholderAddress(tronPlaceholder)).toBe(true);
      expect(isPlaceholderAddress(tronValid)).toBe(false);
    });
  });

  describe('Mock Mode Behavior', () => {
    it('should allow placeholder recipients in mock mode', async () => {
      const clients = new Map([['avalanche', mockClient]]);
      
      const result = await execute(mockBundle, clients, true); // mockMode = true
      
      expect(result.success).toBe(true);
      expect(result.verifiedPayout).toBe(true); // Should be true in mock mode
    });

    it('should process execution normally with placeholder in mock mode', async () => {
      const clients = new Map([['avalanche', mockClient]]);
      
      const result = await execute(mockBundle, clients, true);
      
      expect(result.success).toBe(true);
      expect(result.claimedUsd).toBe(5.0);
      expect(result.txHash).toBe('0x123abc');
    });
  });

  describe('Non-Mock Mode Behavior', () => {
    it('should reject placeholder recipients in non-mock mode', async () => {
      const clients = new Map([['avalanche', mockClient]]);
      
      const result = await execute(mockBundle, clients, false); // mockMode = false
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('placeholder recipient');
      expect(result.verifiedPayout).toBe(false);
    });

    it('should allow valid recipients in non-mock mode', async () => {
      const clients = new Map([['avalanche', mockClient]]);
      
      // Create bundle with valid recipient
      const validBundle: ClaimBundle = {
        ...mockBundle,
        claimTo: validAddress,
        items: mockBundle.items.map(item => ({
          ...item,
          claimTo: validAddress
        }))
      };
      
      const result = await execute(validBundle, clients, false);
      
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0x123abc');
    });

    it('should fail gracefully when client is missing', async () => {
      const emptyClients = new Map<string, ChainClient>();
      
      // Create bundle with valid recipient to get past recipient validation
      const validBundle: ClaimBundle = {
        ...mockBundle,
        claimTo: validAddress,
        items: mockBundle.items.map(item => ({
          ...item,
          claimTo: validAddress
        }))
      };
      
      const result = await execute(validBundle, emptyClients, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No client configured');
      expect(result.verifiedPayout).toBe(false);
    });
  });

  describe('Pricing Service Integration', () => {
    it('should handle missing pricing service gracefully', async () => {
      const clients = new Map([['avalanche', mockClient]]);
      
      // Don't inject pricing service
      const validBundle: ClaimBundle = {
        ...mockBundle,
        claimTo: validAddress,
        items: mockBundle.items.map(item => ({
          ...item,
          claimTo: validAddress
        }))
      };
      
      const result = await execute(validBundle, clients, false);
      
      expect(result.success).toBe(true);
      // Should work without pricing service, just won't have enhanced verification
    });

    it('should accept pricing service injection', () => {
      const mockPricingService = {
        quoteToUsd: async () => 1.0,
        getTokenDecimals: () => 18
      };
      
      // Should not throw
      expect(() => injectPricingService(mockPricingService)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle client sendRaw errors', async () => {
      const errorClient: ChainClient = {
        ...mockClient,
        sendRaw: async () => {
          throw new Error('Network error');
        }
      };
      
      const clients = new Map([['avalanche', errorClient]]);
      const validBundle: ClaimBundle = {
        ...mockBundle,
        claimTo: validAddress,
        items: mockBundle.items.map(item => ({
          ...item,
          claimTo: validAddress
        }))
      };
      
      const result = await execute(validBundle, clients, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.verifiedPayout).toBe(false);
    });

    it('should handle missing chain client', async () => {
      const clients = new Map<string, ChainClient>();
      
      const result = await execute(mockBundle, clients, true);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No client configured for chain: avalanche');
    });
  });
});