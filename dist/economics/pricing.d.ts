export declare function getTokenDecimals(symbol: string): number;
export declare function isStablecoin(symbol: string): boolean;
export declare function quoteToUsd(chain: 'avalanche', token: string, amountWei: string): Promise<number>;
export declare function formatTokenAmount(amountWei: string, decimals: number): string;
export declare function parseTokenAmount(amount: string, decimals: number): string;
//# sourceMappingURL=pricing.d.ts.map