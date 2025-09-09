import type { Address } from '../types/common.js';
export declare const SAMPLE_SEED_WALLETS: Address[];
export declare function seedWallets(): Promise<Address[]>;
export declare function getProtocolUsers(protocolName: string, chain: Address['chain']): Promise<Address[]>;
export declare function getTokenHolders(tokenAddress: string, chain: Address['chain'], _minBalance?: string): Promise<Address[]>;
export declare function getLiquidityProviders(poolAddress: string, chain: Address['chain']): Promise<Address[]>;
export declare function isValidAddress(address: string, chain: Address['chain']): boolean;
export declare function filterValidWallets(wallets: Address[]): Address[];
//# sourceMappingURL=seeds.d.ts.map