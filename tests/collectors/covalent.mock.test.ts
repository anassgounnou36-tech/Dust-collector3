import { describe, it, expect, vi } from 'vitest';
import { CovalentCollector } from '../../src/collectors/covalent.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('CovalentCollector', () => {
  const mockApiKey = 'test-api-key';
  
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw error without API key', () => {
    expect(() => new CovalentCollector('')).toThrow('COVALENT_API_KEY is required');
  });

  it('should collect token holders successfully', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            address: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D',
            balance: '100000000000000000000', // 100 tokens (18 decimals)
          },
          {
            address: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5',
            balance: '50000000000000000000', // 50 tokens
          },
        ],
        contract_decimals: 18,
        has_more: false,
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new CovalentCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661');

    expect(wallets).toHaveLength(2);
    expect(wallets[0].address).toBe('0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D');
    expect(wallets[0].chain).toBe('avalanche');
    expect(wallets[0].source).toBe('covalent');
    expect(wallets[0].balance_tokens).toBe(100);
    expect(wallets[0].balance_wei).toBe('100000000000000000000');
  });

  it('should handle rate limiting with exponential backoff', async () => {
    const mockRateLimitResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    };

    const mockSuccessResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: {
          items: [],
          has_more: false,
        },
      }),
    };

    (global.fetch as any)
      .mockResolvedValueOnce(mockRateLimitResponse)
      .mockResolvedValueOnce(mockSuccessResponse);

    const collector = new CovalentCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661');

    expect(wallets).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle API errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const collector = new CovalentCollector(mockApiKey);

    await expect(
      collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661')
    ).rejects.toThrow('Covalent API error: 500 Internal Server Error');
  });

  it('should respect pagination and limits', async () => {
    const mockResponse = {
      data: {
        items: [
          { address: '0xe816F3dB12Db343FAF01B0781F9fE80122FA7E7D', balance: '1000000000000000000' },
          { address: '0x742d35Cc6634C0532925a3b8D4b65ED2b2C8b7f5', balance: '2000000000000000000' },
        ],
        contract_decimals: 18,
        has_more: true,
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const collector = new CovalentCollector(mockApiKey);
    const wallets = await collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661', {
      pageSize: 2,
      limit: 3,
    });

    // Should stop at limit (3) even though has_more is true
    expect(wallets.length).toBeLessThanOrEqual(3);
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const collector = new CovalentCollector(mockApiKey);

    await expect(
      collector.collect('0x62edc0692BD897D2295872a9FFCac5425011c661')
    ).rejects.toThrow('Network error');
  });
});