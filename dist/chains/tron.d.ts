import type { ChainClient, ClaimBundle, SimulationResult, TxResult } from '../types/common.js';
export declare class TronClient implements ChainClient {
    readonly chain: "tron";
    private tronWeb;
    constructor(rpcUrl: string, privateKey?: string);
    gasPrice(): Promise<bigint>;
    nativeUsd(): Promise<number>;
    simulate(bundle: ClaimBundle): Promise<SimulationResult>;
    sendRaw(bundle: ClaimBundle): Promise<TxResult>;
    getBalance(address: string): Promise<number>;
    getAccount(address: string): Promise<any>;
    hexToBase58(hexAddress: string): string;
    base58ToHex(base58Address: string): string;
}
//# sourceMappingURL=tron.d.ts.map