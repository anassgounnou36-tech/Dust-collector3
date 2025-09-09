import type { Address } from '../types/common.js';
export declare function expandNeighbors(seedWallets: Address[]): Promise<Address[]>;
export declare function findTransactionNeighbors(wallet: Address, depth?: number): Promise<Address[]>;
export declare function findTokenCoHolders(wallet: Address, tokenAddresses: string[]): Promise<Address[]>;
export declare function findContractInteractionPeers(wallet: Address, contractAddresses: string[]): Promise<Address[]>;
export declare function findMultiSigRelated(wallet: Address): Promise<Address[]>;
export declare function findCrossChainRelated(wallet: Address): Promise<Address[]>;
export interface ExpansionStrategy {
    name: string;
    weight: number;
    expand: (wallets: Address[]) => Promise<Address[]>;
}
export declare const EXPANSION_STRATEGIES: ExpansionStrategy[];
export declare function expandWithStrategies(seedWallets: Address[], strategies?: ExpansionStrategy[], maxResults?: number): Promise<Address[]>;
//# sourceMappingURL=expanders.d.ts.map