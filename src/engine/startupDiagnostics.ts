import { existsSync, statSync } from 'fs';
import { logger } from './logger.js';

export interface StartupDiagnosticsOptions {
  dbPath?: string;
  clients?: string[];
  integrations?: string[];
}

export function printStartupDiagnostics(opts: StartupDiagnosticsOptions) {
  logger.info('Startup diagnostics...');
  logger.info('Runtime environment', {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid
  });

  logger.info('Flags', {
    MOCK_MODE: process.env.MOCK_MODE,
    DRY_RUN_ONLY: process.env.DRY_RUN_ONLY,
    USE_MEMORY_DB: process.env.USE_MEMORY_DB,
    LOG_LEVEL: process.env.LOG_LEVEL
  });

  if (opts.dbPath) {
    if (process.env.USE_MEMORY_DB === 'true') {
      logger.info('Database mode: in-memory (no persistence)');
    } else {
      try {
        if (existsSync(opts.dbPath)) {
          const st = statSync(opts.dbPath);
          logger.info('Database file', { path: opts.dbPath, size_bytes: st.size });
        } else {
          logger.warn('Database file not found yet', { path: opts.dbPath });
        }
      } catch (e) {
        logger.warn('Unable to stat database file', e);
      }
    }
  }

  logger.info('Active chain clients', opts.clients || []);
  logger.info('Active integrations', opts.integrations || []);
  logger.info('Startup diagnostics complete');
}