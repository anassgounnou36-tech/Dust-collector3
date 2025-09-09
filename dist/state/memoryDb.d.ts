export interface MemoryDbRecord {
    [key: string]: any;
}
export interface MemoryDbStatement {
    run(...params: any[]): {
        changes: number;
        lastInsertRowid: number | bigint;
    };
    get(...params: any[]): any;
    all(...params: any[]): any[];
}
export interface MemoryDbTransaction {
    (...args: any[]): void;
}
export declare class MemoryDatabase {
    private tables;
    private autoIncrementCounters;
    private isOpen;
    constructor(path?: string);
    pragma(statement: string): any;
    exec(sql: string): void;
    private executeStatement;
    private createTable;
    prepare(sql: string): MemoryDbStatement;
    transaction(callback: (...args: any[]) => void): (...args: any[]) => void;
    close(): void;
    getTable(tableName: string): MemoryDbRecord[];
    setTable(tableName: string, records: MemoryDbRecord[]): void;
    getNextId(tableName: string): number;
    getAllTables(): string[];
}
//# sourceMappingURL=memoryDb.d.ts.map