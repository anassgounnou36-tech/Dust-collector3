import type { PendingReward, ClaimBundle } from '../types/common.js';
export declare function groupByContract(items: PendingReward[]): ClaimBundle[];
export declare function splitLargeBundles(bundles: ClaimBundle[], maxSize: number): ClaimBundle[];
export declare function mergeBundles(bundles: ClaimBundle[], minSize: number): ClaimBundle[];
//# sourceMappingURL=bundler.d.ts.map