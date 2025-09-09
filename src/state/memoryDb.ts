// In-memory database implementation as fallback for better-sqlite3
// Provides the same interface as better-sqlite3 for compatibility

export interface MemoryDbRecord {
  [key: string]: any;
}

export interface MemoryDbStatement {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface MemoryDbTransaction {
  (...args: any[]): void;
}

export class MemoryDatabase {
  private tables: Map<string, MemoryDbRecord[]> = new Map();
  private autoIncrementCounters: Map<string, number> = new Map();
  private isOpen = true;

  constructor(path?: string) {
    // Ignore path parameter for in-memory database
    console.warn('⚠️  Using in-memory database fallback. Data will not persist between restarts.');
  }

  pragma(statement: string): any {
    // No-op for pragma statements in memory database
    return this;
  }

  exec(sql: string): void {
    // Parse and execute multiple SQL statements
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      this.executeStatement(statement.trim());
    }
  }

  private executeStatement(sql: string): void {
    const cleanSql = sql.trim().toUpperCase();
    
    if (cleanSql.startsWith('CREATE TABLE')) {
      this.createTable(sql);
    }
    // Add more statement types as needed
  }

  private createTable(sql: string): void {
    // Extract table name from CREATE TABLE statement
    const match = sql.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/i);
    if (match) {
      const tableName = match[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
        this.autoIncrementCounters.set(tableName, 0);
      }
    }
  }

  prepare(sql: string): MemoryDbStatement {
    return new MemoryStatement(sql, this);
  }

  transaction(callback: (...args: any[]) => void): (...args: any[]) => void {
    // Simple transaction implementation - just execute the callback
    return (...args: any[]) => {
      callback(...args);
    };
  }

  close(): void {
    this.isOpen = false;
    this.tables.clear();
    this.autoIncrementCounters.clear();
  }

  // Internal methods for MemoryStatement to use
  getTable(tableName: string): MemoryDbRecord[] {
    return this.tables.get(tableName) || [];
  }

  setTable(tableName: string, records: MemoryDbRecord[]): void {
    this.tables.set(tableName, records);
  }

  getNextId(tableName: string): number {
    const current = this.autoIncrementCounters.get(tableName) || 0;
    const next = current + 1;
    this.autoIncrementCounters.set(tableName, next);
    return next;
  }

  getAllTables(): string[] {
    return Array.from(this.tables.keys());
  }
}

class MemoryStatement implements MemoryDbStatement {
  constructor(private sql: string, private db: MemoryDatabase) {}

  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const sql = this.sql.trim().toUpperCase();
    
    if (sql.startsWith('INSERT')) {
      return this.handleInsert(params);
    } else if (sql.startsWith('UPDATE')) {
      return this.handleUpdate(params);
    } else if (sql.startsWith('DELETE')) {
      return this.handleDelete(params);
    }
    
    return { changes: 0, lastInsertRowid: 0 };
  }

  get(...params: any[]): any {
    const sql = this.sql.trim().toUpperCase();
    
    if (sql.startsWith('SELECT')) {
      return this.handleSelect(params, true);
    }
    
    return undefined;
  }

  all(...params: any[]): any[] {
    const sql = this.sql.trim().toUpperCase();
    
    if (sql.startsWith('SELECT')) {
      return this.handleSelect(params, false);
    }
    
    return [];
  }

  private handleInsert(params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    // Parse INSERT statement - simplified implementation
    const tableName = this.extractTableName('INSERT');
    if (!tableName) return { changes: 0, lastInsertRowid: 0 };

    const table = this.db.getTable(tableName);
    
    // For this implementation, we'll handle specific known patterns
    if (tableName === 'wallets') {
      return this.insertWallet(table, params);
    } else if (tableName === 'pending_rewards') {
      return this.insertPendingReward(table, params);
    } else if (tableName === 'executions') {
      return this.insertExecution(table, params);
    }
    
    return { changes: 0, lastInsertRowid: 0 };
  }

  private insertWallet(table: MemoryDbRecord[], params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const [address, chain] = params;
    
    // Check for conflict (UNIQUE constraint)
    const existing = table.find(r => r.address === address && r.chain === chain);
    if (existing) {
      return { changes: 0, lastInsertRowid: 0 }; // ON CONFLICT DO NOTHING
    }
    
    const id = this.db.getNextId('wallets');
    const record = {
      id,
      address,
      chain,
      first_seen_at: new Date().toISOString(),
      last_claim_at: null,
      total_claimed_usd: 0
    };
    
    table.push(record);
    this.db.setTable('wallets', table);
    
    return { changes: 1, lastInsertRowid: id };
  }

  private insertPendingReward(table: MemoryDbRecord[], params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const [id, wallet_address, wallet_chain, protocol, token_address, token_chain,
           amount_wei, amount_usd, claim_to_address, claim_to_chain, discovered_at, last_claim_at] = params;
    
    // Remove existing record with same id (INSERT OR REPLACE)
    const filteredTable = table.filter(r => r.id !== id);
    
    const record = {
      id, wallet_address, wallet_chain, protocol, token_address, token_chain,
      amount_wei, amount_usd, claim_to_address, claim_to_chain, discovered_at, last_claim_at,
      is_stale: false
    };
    
    filteredTable.push(record);
    this.db.setTable('pending_rewards', filteredTable);
    
    return { changes: 1, lastInsertRowid: 0 };
  }

  private insertExecution(table: MemoryDbRecord[], params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const [id, bundle_id, chain, protocol, claim_to_address, claim_to_chain,
           total_usd, est_gas_usd, net_usd, item_count, success, tx_hash,
           error_message, gas_used, actual_gas_usd, actual_claimed_usd] = params;
    
    const record = {
      id, bundle_id, chain, protocol, claim_to_address, claim_to_chain,
      total_usd, est_gas_usd, net_usd, item_count, success, tx_hash,
      error_message, gas_used, actual_gas_usd, actual_claimed_usd,
      executed_at: new Date().toISOString()
    };
    
    table.push(record);
    this.db.setTable('executions', table);
    
    return { changes: 1, lastInsertRowid: 0 };
  }

  private handleUpdate(params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const tableName = this.extractTableName('UPDATE');
    if (!tableName) return { changes: 0, lastInsertRowid: 0 };

    const table = this.db.getTable(tableName);
    let changes = 0;

    if (tableName === 'pending_rewards' && this.sql.includes('is_stale = TRUE')) {
      // Handle markClaimed update
      const [claimedAt, id] = params;
      const record = table.find(r => r.id === id);
      if (record) {
        record.is_stale = true;
        record.last_claim_at = claimedAt;
        changes = 1;
      }
    }

    this.db.setTable(tableName, table);
    return { changes, lastInsertRowid: 0 };
  }

  private handleDelete(params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    // Simplified delete implementation
    return { changes: 0, lastInsertRowid: 0 };
  }

  private handleSelect(params: any[], singleResult: boolean): any {
    const tableName = this.extractTableName('SELECT');
    if (!tableName) return singleResult ? undefined : [];

    const table = this.db.getTable(tableName);
    
    // Simplified SELECT implementation for known patterns
    if (tableName === 'wallets' && this.sql.includes('WHERE address = ? AND chain = ?')) {
      const [address, chain] = params;
      const record = table.find(r => r.address === address && r.chain === chain);
      return singleResult ? record : (record ? [record] : []);
    }
    
    if (tableName === 'executions' && this.sql.includes('WHERE executed_at >')) {
      // For getRecentExecutions
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 24); // Default 24 hours back
      
      const recentRecords = table
        .filter(r => new Date(r.executed_at) > cutoffTime)
        .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
      
      return singleResult ? recentRecords[0] : recentRecords;
    }
    
    return singleResult ? undefined : [];
  }

  private extractTableName(operation: string): string | null {
    const regex = new RegExp(`${operation}(?:\\s+(?:OR\\s+\\w+|INTO))?\\s+(\\w+)`, 'i');
    const match = this.sql.match(regex);
    return match ? match[1] : null;
  }
}