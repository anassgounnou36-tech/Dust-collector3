import { describe, it, expect, vi } from 'vitest';
import { BitqueryCollector } from '../../src/collectors/bitquery.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('BitqueryCollector', () => {
  const mockApiKey = 'test-api-key';
  
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw error without API key', () => {
    expect(() => new BitqueryCollector('')).toThrow('BITQUERY_API_KEY is required');
  });

  it('should collect wallet addresses from transfer data', async () => {
    const mockResponse = {
      data: {
        ethereum: {
          transfers: [
            {
              receiver: {
                address: '0xe816f3db12db343faf01b0781f9fe80122fa7e7d',
              },
              amount: 100.5,
              count: 5,
            },
            {
              receiver: {
                address: '0x742d35cc6634c0532925a3b8d4b65ed2b2c8b7f5',
              },
              amount: 50.25,
              count: 3,
            },
          ],
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new BitqueryCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661');

    expect(wallets).toHaveLength(2);
    expect(wallets[0].address).toBe('0xe816f3db12db343faf01b0781f9fe80122fa7e7d');
    expect(wallets[0].chain).toBe('avalanche');
    expect(wallets[0].source).toBe('bitquery');
    expect(wallets[0].balance_tokens).toBe(100.5);
    expect(wallets[0].token_address).toBe('0x62edc0692BD897D2295872a9FFCac5425011c661');
  });

  it('should handle GraphQL errors', async () => {
    const mockResponse = {
      errors: [
        {
          message: 'Invalid API key',
          extensions: {
            code: 'UNAUTHENTICATED',
          },
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new BitqueryCollector(mockApiKey);

    await expect(
      collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661')
    ).rejects.toThrow('Bitquery GraphQL errors');
  });

  it('should handle rate limiting', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    const collector = new BitqueryCollector(mockApiKey);

    await expect(
      collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661')
    ).rejects.toThrow('Bitquery API rate limit exceeded');
  });

  it('should handle empty response data', async () => {
    const mockResponse = {
      data: {
        ethereum: {
          transfers: [],
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new BitqueryCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661');

    expect(wallets).toHaveLength(0);
  });

  it('should respect limit parameter', async () => {
    const mockResponse = {
      data: {
        ethereum: {
          transfers: [
            { receiver: { address: '0xe816f3db12db343faf01b0781f9fe80122fa7e7d' }, amount: 100 },
            { receiver: { address: '0x742d35cc6634c0532925a3b8d4b65ed2b2c8b7f5' }, amount: 50 },
            { receiver: { address: '0x1234567890123456789012345678901234567890' }, amount: 25 },
          ],
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new BitqueryCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661', {
      limit: 2,
    });

    expect(wallets).toHaveLength(2);
  });

  it('should skip wallets without receiver address', async () => {
    const mockResponse = {
      data: {
        ethereum: {
          transfers: [
            {
              receiver: {
                address: '0xe816f3db12db343faf01b0781f9fe80122fa7e7d',
              },
              amount: 100,
            },
            {
              receiver: null, // Invalid receiver
              amount: 50,
            },
            {
              receiver: {
                address: null, // Invalid address
              },
              amount: 25,
            },
          ],
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new BitqueryCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661');

    expect(wallets).toHaveLength(1);
    expect(wallets[0].address).toBe('0xe816f3db12db343faf01b0781f9fe80122fa7e7d');
  });
});