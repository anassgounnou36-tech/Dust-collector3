import type { ClaimBundle } from '../types/common.js';
export declare function computeBundleHash(bundle: ClaimBundle): string;
export declare function shouldSkipIdempotency(bundle: ClaimBundle): boolean;
export declare function markBundleProcessed(bundle: ClaimBundle): void;
export declare function clearIdempotencyCache(): void;
export declare function getIdempotencyCacheSize(): number;
export interface PersistentIdempotencyStore {
    hasRecentlyProcessed(hash: string): Promise<boolean>;
    markProcessed(hash: string): Promise<void>;
    cleanup(): Promise<void>;
}
export declare class DatabaseIdempotencyStore implements PersistentIdempotencyStore {
    hasRecentlyProcessed(_hash: string): Promise<boolean>;
    markProcessed(_hash: string): Promise<void>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=idempotency.d.ts.map