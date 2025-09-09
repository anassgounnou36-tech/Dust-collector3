"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseIdempotencyStore = void 0;
exports.computeBundleHash = computeBundleHash;
exports.shouldSkipIdempotency = shouldSkipIdempotency;
exports.markBundleProcessed = markBundleProcessed;
exports.clearIdempotencyCache = clearIdempotencyCache;
exports.getIdempotencyCacheSize = getIdempotencyCacheSize;
const crypto_1 = __importDefault(require("crypto"));
const policy_js_1 = require("../economics/policy.js");
// In-memory cache for idempotency tracking
const idempotencyCache = new Map();
function computeBundleHash(bundle) {
    // Create a deterministic hash based on bundle contents
    const bundleData = {
        chain: bundle.chain,
        protocol: bundle.protocol,
        claimTo: bundle.claimTo.value,
        items: bundle.items.map(item => ({
            id: item.id,
            wallet: item.wallet.value,
            token: item.token.value,
            amountWei: item.amountWei
        })).sort((a, b) => a.id.localeCompare(b.id)) // Sort for consistency
    };
    const dataString = JSON.stringify(bundleData);
    return crypto_1.default.createHash('sha256').update(dataString).digest('hex');
}
function shouldSkipIdempotency(bundle) {
    const hash = computeBundleHash(bundle);
    const now = Date.now();
    const ttlMs = policy_js_1.Policy.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
    // Check if we've seen this bundle recently
    const lastSeen = idempotencyCache.get(hash);
    if (lastSeen && (now - lastSeen) < ttlMs) {
        return true; // Skip - recently processed
    }
    // Record this bundle as being processed
    idempotencyCache.set(hash, now);
    // Clean up old entries to prevent memory leaks
    cleanupExpiredEntries();
    return false; // Don't skip - safe to process
}
function markBundleProcessed(bundle) {
    const hash = computeBundleHash(bundle);
    idempotencyCache.set(hash, Date.now());
}
function clearIdempotencyCache() {
    idempotencyCache.clear();
}
function getIdempotencyCacheSize() {
    return idempotencyCache.size;
}
function cleanupExpiredEntries() {
    const now = Date.now();
    const ttlMs = policy_js_1.Policy.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
    for (const [hash, timestamp] of idempotencyCache.entries()) {
        if (now - timestamp > ttlMs) {
            idempotencyCache.delete(hash);
        }
    }
}
class DatabaseIdempotencyStore {
    // TODO: Implement database-backed idempotency store
    // This would use the same SQLite database to persist idempotency records
    async hasRecentlyProcessed(_hash) {
        // TODO: Query database for recent processing of this hash
        throw new Error('DatabaseIdempotencyStore not implemented');
    }
    async markProcessed(_hash) {
        // TODO: Insert/update database record for this hash
        throw new Error('DatabaseIdempotencyStore not implemented');
    }
    async cleanup() {
        // TODO: Remove expired idempotency records from database
        throw new Error('DatabaseIdempotencyStore not implemented');
    }
}
exports.DatabaseIdempotencyStore = DatabaseIdempotencyStore;
//# sourceMappingURL=idempotency.js.map