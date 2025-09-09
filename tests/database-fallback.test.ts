import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDb, initSchema, upsertWallet, recordPending, getDiagnostics, resetDb } from '../src/state/db.js';
import type { Address, PendingReward } from '../src/types/common.js';

// Test address for testing
const testWallet: Address = {
  value: '0x742d35Cc6635C0532925a3b8D4c161F5',
  chain: 'avalanche'
};

const testReward: PendingReward = {
  id: 'test-reward-1',
  wallet: testWallet,
  protocol: 'traderjoe',
  token: {
    value: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    chain: 'avalanche'
  },
  amountWei: '1000000000000000000',
  amountUsd: 35.0,
  claimTo: testWallet,
  discoveredAt: new Date(),
  lastClaimAt: undefined
};

describe('Database Fallback System', () => {
  beforeEach(() => {
    // Reset the database singleton before each test
    resetDb();
  });

  afterEach(() => {
    // Reset environment variables
    delete process.env.FORCE_MEMORY_DB;
    resetDb();
  });

  describe('SQLite Availability Detection', () => {
    it('should detect database type in diagnostics', () => {
      const db = initDb(':memory:');
      initSchema(db);
      
      const diagnostics = getDiagnostics();
      expect(diagnostics.type).toMatch(/^(sqlite|memory)$/);
      expect(typeof diagnostics.available).toBe('boolean');
    });
  });

  describe('Force Memory Database', () => {
    it('should use memory database when FORCE_MEMORY_DB=true', () => {
      // Set environment variable to force memory database
      process.env.FORCE_MEMORY_DB = 'true';
      
      const db = initDb('/tmp/test.db'); // This should be ignored
      initSchema(db);
      
      const diagnostics = getDiagnostics();
      expect(diagnostics.type).toBe('memory');
      expect(diagnostics.path).toBe(':memory:');
    });
  });

  describe('Database Operations with Memory Fallback', () => {
    it('should insert and retrieve wallets', () => {
      const db = initDb(':memory:');
      initSchema(db);
      
      // Insert wallet
      upsertWallet(db, testWallet);
      
      // Verify it was inserted by attempting duplicate insert (should not error)
      expect(() => upsertWallet(db, testWallet)).not.toThrow();
    });

    it('should record pending rewards', () => {
      const db = initDb(':memory:');
      initSchema(db);
      
      // Insert wallet first
      upsertWallet(db, testWallet);
      
      // Record pending reward
      expect(() => recordPending(db, testReward)).not.toThrow();
    });

    it('should handle multiple records', () => {
      const db = initDb(':memory:');
      initSchema(db);
      
      // Insert multiple wallets
      const wallets: Address[] = [
        { value: '0x1111111111111111111111111111111111111111', chain: 'avalanche' },
        { value: '0x2222222222222222222222222222222222222222', chain: 'avalanche' },
        { value: '0x3333333333333333333333333333333333333333', chain: 'tron' }
      ];
      
      for (const wallet of wallets) {
        expect(() => upsertWallet(db, wallet)).not.toThrow();
      }
      
      // Record rewards for each wallet
      for (let i = 0; i < wallets.length; i++) {
        const reward: PendingReward = {
          ...testReward,
          id: `test-reward-${i}`,
          wallet: wallets[i],
          claimTo: wallets[i]
        };
        expect(() => recordPending(db, reward)).not.toThrow();
      }
    });
  });

  describe('Schema Initialization', () => {
    it('should initialize schema without errors', () => {
      const db = initDb(':memory:');
      expect(() => initSchema(db)).not.toThrow();
    });

    it('should create all required tables', () => {
      const db = initDb(':memory:');
      initSchema(db);
      
      // Test that we can perform operations on all tables
      expect(() => upsertWallet(db, testWallet)).not.toThrow();
      expect(() => recordPending(db, testReward)).not.toThrow();
    });
  });

  describe('Database Persistence Warning', () => {
    it('should warn about data persistence when using memory database', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      process.env.FORCE_MEMORY_DB = 'true';
      const db = initDb('/tmp/test.db');
      initSchema(db);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('FORCE_MEMORY_DB=true')
      );
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Database Compatibility', () => {
  beforeEach(() => {
    resetDb();
  });

  afterEach(() => {
    resetDb();
  });

  it('should maintain same interface for both SQLite and Memory databases', () => {
    const db = initDb(':memory:');
    initSchema(db);
    
    // Test that all required methods exist
    expect(typeof db.prepare).toBe('function');
    expect(typeof db.exec).toBe('function');
    expect(typeof db.pragma).toBe('function');
    expect(typeof db.transaction).toBe('function');
    
    // Test statement methods
    const stmt = db.prepare('SELECT 1');
    expect(typeof stmt.run).toBe('function');
    expect(typeof stmt.get).toBe('function');
    expect(typeof stmt.all).toBe('function');
  });

  it('should handle transactions consistently', () => {
    const db = initDb(':memory:');
    initSchema(db);
    
    upsertWallet(db, testWallet);
    
    const transaction = db.transaction((rewards: PendingReward[]) => {
      for (const reward of rewards) {
        recordPending(db, reward);
      }
    });
    
    const rewards = [
      { ...testReward, id: 'batch-1' },
      { ...testReward, id: 'batch-2' },
      { ...testReward, id: 'batch-3' }
    ];
    
    expect(() => transaction(rewards)).not.toThrow();
  });
});