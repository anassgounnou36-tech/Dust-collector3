import type { ClaimBundle, ChainClient, SimulationResult } from '../types/common.js';
export interface BundleSimulationResult extends SimulationResult {
    readonly bundleId: string;
    readonly gasEstimate?: number;
}
export declare function dryRun(bundle: ClaimBundle, clients: Map<string, ChainClient>): Promise<BundleSimulationResult>;
export declare function simulateMultiple(bundles: ClaimBundle[], clients: Map<string, ChainClient>): Promise<BundleSimulationResult[]>;
export declare function aggregateSimulationResults(results: BundleSimulationResult[]): {
    successCount: number;
    failureCount: number;
    totalGasEstimate: number;
    failureReasons: string[];
};
//# sourceMappingURL=simulator.d.ts.map