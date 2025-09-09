import type { ClaimBundle, Chain } from '../types/common.js';
export declare function estimateBundleGasUsd(bundle: ClaimBundle, chain: Chain): number;
export declare function estimateClaimGasUsd(chain: Chain, itemCount?: number): number;
export declare function validateGasEstimate(gasUsd: number, totalUsd: number): boolean;
export declare function updateGasEstimates(chain: Chain, itemCount: number, actualGasUsd: number): void;
export declare function estimateBundleUsd(bundle: ClaimBundle): Promise<number>;
//# sourceMappingURL=gas.d.ts.map