"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printStartupDiagnostics = printStartupDiagnostics;
const fs_1 = require("fs");
const logger_js_1 = require("./logger.js");
function printStartupDiagnostics(opts) {
    logger_js_1.logger.info('Startup diagnostics...');
    logger_js_1.logger.info('Runtime environment', {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
    });
    logger_js_1.logger.info('Flags', {
        MOCK_MODE: process.env.MOCK_MODE,
        DRY_RUN_ONLY: process.env.DRY_RUN_ONLY,
        USE_MEMORY_DB: process.env.USE_MEMORY_DB,
        LOG_LEVEL: process.env.LOG_LEVEL
    });
    if (opts.dbPath) {
        if (process.env.USE_MEMORY_DB === 'true') {
            logger_js_1.logger.info('Database mode: in-memory (no persistence)');
        }
        else {
            try {
                if ((0, fs_1.existsSync)(opts.dbPath)) {
                    const st = (0, fs_1.statSync)(opts.dbPath);
                    logger_js_1.logger.info('Database file', { path: opts.dbPath, size_bytes: st.size });
                }
                else {
                    logger_js_1.logger.warn('Database file not found yet', { path: opts.dbPath });
                }
            }
            catch (e) {
                logger_js_1.logger.warn('Unable to stat database file', e);
            }
        }
    }
    logger_js_1.logger.info('Active chain clients', opts.clients || []);
    logger_js_1.logger.info('Active integrations', opts.integrations || []);
    logger_js_1.logger.info('Startup diagnostics complete');
}
//# sourceMappingURL=startupDiagnostics.js.map