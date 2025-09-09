"use strict";
/* Flexible debug + evaluation snapshot utilities matching multiple call patterns
   used in traderJoeEvaluator.ts */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluationDebugger = exports.EvaluationDebugger = void 0;
exports.analyzeFailedEvaluations = analyzeFailedEvaluations;
const isDebugEnabled = () => process.env.TRADERJOE_DEBUG_MODE === 'true' ||
    process.env.DEBUG_EVAL === 'true';
function genId() {
    return (globalThis.crypto?.randomUUID?.() ??
        'xxxxxxxxxxxx'.replace(/[x]/g, () => ((Math.random() * 16) | 0).toString(16)));
}
class EvaluationDebugger {
    sessions = new Map();
    enabled = isDebugEnabled();
    isEnabled() {
        this.enabled = isDebugEnabled();
        return this.enabled;
    }
    enable() {
        this.enabled = true;
    }
    disable() {
        this.enabled = false;
    }
    clearSnapshots() {
        this.sessions.clear();
    }
    getAllSnapshots() {
        return this.getAllSessions();
    }
    ensureSession(id) {
        return this.sessions.get(id);
    }
    startSession(...args) {
        const id = genId();
        const meta = args.length === 1 && typeof args[0] === 'object'
            ? { ...args[0] }
            : args.length > 1
                ? { args }
                : undefined;
        const session = {
            id,
            startedAt: Date.now(),
            decisions: [],
            warnings: [],
            errors: [],
            meta
        };
        this.sessions.set(id, session);
        return id;
    }
    // recordRouterState(sessionId, stateObj)
    // recordRouterState(sessionId, chainId, rpcUrl, connected)
    // recordRouterState(sessionId, routerName, chainId, rpcUrl, connected)
    recordRouterState(sessionId, ...args) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (!s)
            return;
        let state = {};
        if (args.length === 1 && typeof args[0] === 'object') {
            state = { ...args[0] };
        }
        else if (args.length === 3) {
            // (chainId, rpcUrl, connected)
            const [chainId, rpcUrl, connected] = args;
            state = { chainId, rpcUrl, networkConnected: connected };
        }
        else if (args.length === 4) {
            // (routerName, chainId, rpcUrl, connected)
            const [routerName, chainId, rpcUrl, connected] = args;
            state = { routerName, chainId, rpcUrl, networkConnected: connected };
        }
        else {
            state = { rawArgs: args };
        }
        s.routerState = { ...(s.routerState || {}), ...state };
    }
    // recordQuoteResult(sessionId, quoteObj)
    // recordQuoteResult(sessionId, errorMessage, timing)
    // recordQuoteResult(sessionId, quoteObj, timing)
    recordQuoteResult(sessionId, ...args) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (!s)
            return;
        let result = {};
        if (args.length === 1 && typeof args[0] === 'object') {
            result = { ...args[0] };
        }
        else if (args.length === 2) {
            // Could be (quoteObj, timing) or (errorString, timing)
            if (typeof args[0] === 'string') {
                result = { success: false, error: args[0], timing: args[1] };
            }
            else {
                result = { success: true, quote: args[0], timing: args[1] };
            }
        }
        else if (args.length === 3) {
            // (successBool, quoteOrNull, timing)
            const [success, payload, timing] = args;
            result = success
                ? { success: true, quote: payload, timing }
                : { success: false, error: payload, timing };
        }
        else {
            result = { rawArgs: args };
        }
        s.quoteResult = { ...(s.quoteResult || {}), ...result };
    }
    // recordDecision(sessionId, decisionObj)
    // recordDecision(sessionId, id, passed, observed?, threshold?, weight?, message?)
    recordDecision(sessionId, ...args) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (!s)
            return;
        let decision;
        if (args.length === 1 && typeof args[0] === 'object') {
            decision = { ...args[0] };
        }
        else if (typeof args[0] === 'string' && typeof args[1] === 'boolean') {
            const [id, passed, observed = undefined, threshold = undefined, weight = 1, message = undefined] = args;
            decision = {
                id,
                passed,
                observed,
                threshold,
                weight,
                message
            };
        }
        else if (typeof args[0] === 'string' &&
            typeof args[1] === 'string' &&
            typeof args[2] === 'boolean') {
            // Pattern: (id, label??, passed, ...)
            const [id, _label, passed, observed = undefined, threshold = undefined, weight = 1, message = undefined] = args;
            decision = { id, passed, observed, threshold, weight, message };
        }
        if (!decision) {
            decision = {
                id: 'unknown_pattern',
                passed: false,
                message: 'Unrecognized decision pattern',
                observed: JSON.stringify(args)
            };
        }
        decision.timestamp = Date.now();
        s.decisions.push(decision);
    }
    recordWarning(sessionId, warning) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (s)
            s.warnings.push(warning);
    }
    recordError(sessionId, error) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (s)
            s.errors.push(error);
    }
    recordMetrics(sessionId, metrics) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (s)
            s.metrics = { ...(s.metrics || {}), ...metrics };
    }
    /* completeSession flexible forms:
       completeSession(sessionId, status)
       completeSession(sessionId, status, summaryObj)
       completeSession(sessionId, routerState, quoteResult, decisions, metrics, status, profitFlag, warnings, errors)
    */
    completeSession(sessionId, ...args) {
        if (!this.isEnabled())
            return;
        const s = this.ensureSession(sessionId);
        if (!s)
            return;
        if (args.length === 0) {
            s.status = s.status || 'completed';
        }
        else if (args.length === 1 && typeof args[0] === 'string') {
            s.status = args[0];
        }
        else if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'object') {
            s.status = args[0];
            s.meta = { ...(s.meta || {}), ...(args[1] || {}) };
        }
        else if (args.length >= 5) {
            // Attempt to map the 10-arg pattern:
            const [routerState, quoteResult, decisions, metrics, status, profitFlag, warnings, errors, extraMeta] = args;
            if (routerState && typeof routerState === 'object') {
                s.routerState = { ...(s.routerState || {}), ...routerState };
            }
            if (quoteResult && typeof quoteResult === 'object') {
                s.quoteResult = { ...(s.quoteResult || {}), ...quoteResult };
            }
            if (Array.isArray(decisions)) {
                // Append decisions (assumed already structured or raw)
                decisions.forEach((d) => {
                    if (d && typeof d === 'object' && 'id' in d) {
                        s.decisions.push(d);
                    }
                });
            }
            if (metrics && typeof metrics === 'object') {
                s.metrics = { ...(s.metrics || {}), ...metrics };
            }
            if (typeof status === 'string')
                s.status = status;
            if (typeof profitFlag === 'boolean') {
                s.meta = { ...(s.meta || {}), profitFlag };
            }
            if (Array.isArray(warnings)) {
                warnings.forEach(w => typeof w === 'string' && s.warnings.push(w));
            }
            if (Array.isArray(errors)) {
                errors.forEach(e => typeof e === 'string' && s.errors.push(e));
            }
            if (extraMeta && typeof extraMeta === 'object') {
                s.meta = { ...(s.meta || {}), ...extraMeta };
            }
        }
        else {
            s.meta = { ...(s.meta || {}), rawCompleteArgs: args };
        }
        s.completedAt = Date.now();
        if (!s.status)
            s.status = 'completed';
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    analyzeFailures() {
        const failureReasons = {};
        const warningsAgg = {};
        for (const s of this.sessions.values()) {
            s.errors.forEach(e => (failureReasons[e] = (failureReasons[e] || 0) + 1));
            s.warnings.forEach(w => (warningsAgg[w] = (warningsAgg[w] || 0) + 1));
        }
        return {
            failureReasons: Object.entries(failureReasons).sort((a, b) => b[1] - a[1]),
            commonWarnings: Object.entries(warningsAgg).sort((a, b) => b[1] - a[1])
        };
    }
}
exports.EvaluationDebugger = EvaluationDebugger;
exports.evaluationDebugger = new EvaluationDebugger();
// Analysis function expected by tests  
function analyzeFailedEvaluations(snapshots) {
    const failureReasons = {};
    const warningsAgg = {};
    for (const snapshot of snapshots) {
        snapshot.errors.forEach(e => (failureReasons[e] = (failureReasons[e] || 0) + 1));
        snapshot.warnings.forEach(w => (warningsAgg[w] = (warningsAgg[w] || 0) + 1));
    }
    return {
        totalEvaluations: snapshots.length,
        failedEvaluations: snapshots.filter(s => s.errors.length > 0 || s.finalEvaluation?.profitable === false).length,
        failureReasons: new Set(Object.keys(failureReasons)),
        commonWarnings: new Set(Object.keys(warningsAgg)),
        failureReasonsCounts: Object.entries(failureReasons).sort((a, b) => b[1] - a[1]),
        commonWarningsCounts: Object.entries(warningsAgg).sort((a, b) => b[1] - a[1])
    };
}
//# sourceMappingURL=evaluationSnapshot.js.map