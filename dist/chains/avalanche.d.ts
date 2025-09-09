import type { ChainClient, ClaimBundle, SimulationResult, TxResult } from '../types/common.js';
export declare class AvalancheClient implements ChainClient {
    readonly chain: "avalanche";
    private provider;
    private wallet?;
    constructor(rpcUrl: string, privateKey?: string);
    gasPrice(): Promise<bigint>;
    nativeUsd(): Promise<number>;
    simulate(bundle: ClaimBundle): Promise<SimulationResult>;
    sendRaw(bundle: ClaimBundle): Promise<TxResult>;
    getBalance(address: string): Promise<bigint>;
    getBlockNumber(): Promise<number>;
    getCode(address: string): Promise<string>;
}
export declare function gasPrice(): Promise<bigint>;
export declare function simulate(to: string, data: string, value?: number): Promise<string>;
export declare function sendRaw(to: string, data: string, value?: number, gasLimit?: number): Promise<TxResult>;
export declare function nativeUsd(): Promise<number>;
//# sourceMappingURL=avalanche.d.ts.map