"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRetryableError = createRetryableError;
exports.isRetryableError = isRetryableError;
exports.withExponentialBackoff = withExponentialBackoff;
exports.quarantineWallet = quarantineWallet;
exports.isWalletQuarantined = isWalletQuarantined;
exports.releaseQuarantine = releaseQuarantine;
exports.getQuarantinedWallets = getQuarantinedWallets;
exports.cleanupExpiredQuarantines = cleanupExpiredQuarantines;
exports.getRetryAttempt = getRetryAttempt;
exports.clearRetryTracking = clearRetryTracking;
exports.getQuarantineStats = getQuarantineStats;
const policy_js_1 = require("../economics/policy.js");
const logger_js_1 = require("./logger.js");
// In-memory quarantine store
const quarantineStore = new Map();
// Retry attempt tracking
const retryAttempts = new Map();
function createRetryableError(message, retryable = true, retryAfter) {
    const error = new Error(message);
    error.retryable = retryable;
    error.retryAfter = retryAfter || undefined;
    return error;
}
function isRetryableError(error) {
    return error && typeof error === 'object' && 'retryable' in error;
}
async function withExponentialBackoff(operation, maxAttempts = policy_js_1.Policy.RETRY_MAX_ATTEMPTS, baseDelayMs = policy_js_1.Policy.RETRY_BASE_DELAY_MS, operationId) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await operation();
            // Clear retry tracking on success
            if (operationId) {
                retryAttempts.delete(operationId);
            }
            return result;
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Check if error is retryable
            if (isRetryableError(error) && !error.retryable) {
                throw error;
            }
            // Don't retry on last attempt
            if (attempt === maxAttempts) {
                break;
            }
            // Calculate delay with exponential backoff and jitter
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            const jitter = Math.random() * 0.1 * delay; // ±10% jitter
            const totalDelay = delay + jitter;
            logger_js_1.logger.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${totalDelay.toFixed(0)}ms: ${lastError.message}`);
            // Track retry attempts
            if (operationId) {
                retryAttempts.set(operationId, attempt);
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
    }
    // All attempts failed
    if (operationId) {
        retryAttempts.delete(operationId);
    }
    throw lastError || new Error('Operation failed after maximum attempts');
}
function quarantineWallet(wallet, reason) {
    const key = `${wallet.chain}:${wallet.value}`;
    const quarantineUntil = Date.now() + (policy_js_1.Policy.QUARANTINE_TTL_HOURS * 60 * 60 * 1000);
    quarantineStore.set(key, quarantineUntil);
    logger_js_1.logger.warn(`Quarantined wallet ${wallet.value} on ${wallet.chain}: ${reason}`);
}
function isWalletQuarantined(wallet) {
    const key = `${wallet.chain}:${wallet.value}`;
    const quarantineUntil = quarantineStore.get(key);
    if (!quarantineUntil) {
        return false;
    }
    if (Date.now() > quarantineUntil) {
        // Quarantine expired
        quarantineStore.delete(key);
        return false;
    }
    return true;
}
function releaseQuarantine(wallet) {
    const key = `${wallet.chain}:${wallet.value}`;
    quarantineStore.delete(key);
    logger_js_1.logger.info(`Released quarantine for wallet ${wallet.value} on ${wallet.chain}`);
}
function getQuarantinedWallets() {
    const result = [];
    for (const [key, until] of quarantineStore.entries()) {
        const [chain, address] = key.split(':');
        if (chain && address) {
            result.push({
                wallet: { value: address, chain: chain },
                until: new Date(until)
            });
        }
    }
    return result;
}
function cleanupExpiredQuarantines() {
    const now = Date.now();
    for (const [key, until] of quarantineStore.entries()) {
        if (now > until) {
            quarantineStore.delete(key);
        }
    }
}
function getRetryAttempt(operationId) {
    return retryAttempts.get(operationId) || 0;
}
function clearRetryTracking() {
    retryAttempts.clear();
}
function getQuarantineStats() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    let expiringSoon = 0;
    for (const until of quarantineStore.values()) {
        if (until - now < oneHour) {
            expiringSoon++;
        }
    }
    return {
        totalQuarantined: quarantineStore.size,
        expiringSoon
    };
}
//# sourceMappingURL=retry.js.map