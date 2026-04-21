/**
 * @fileoverview Edge Runtime 兼容的輕量日誌工具
 * @description
 *   提供 Edge Runtime 可用的結構化日誌工具，適用於 middleware、auth.config 等
 *   不能 import Prisma / AsyncLocalStorage 等 Node-only 模組的執行環境。
 *
 *   與 `src/services/logging/logger.service.ts` 的差異：
 *   - LoggerService：Node runtime，寫入資料庫 + SSE 事件廣播
 *   - edgeLogger：Edge runtime，僅 console 輸出，依 LOG_LEVEL 過濾
 *
 *   設計考量：
 *   - 純 JavaScript，無第三方依賴
 *   - 生產環境預設 `info` 以上，開發環境預設 `debug`
 *   - 結構化輸出（prefix + message + JSON context），利於 log aggregation
 *   - 不得包含 Node-only API（fs, crypto, AsyncLocalStorage, Prisma）
 *
 * @module src/lib/edge-logger
 * @since FIX-050
 * @lastModified 2026-04-21
 */

/**
 * 日誌級別（由低到高）
 */
type EdgeLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<EdgeLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 取得當前環境的最低日誌級別
 *
 * 優先順序：
 * 1. `process.env.LOG_LEVEL`（顯式覆寫）
 * 2. 開發環境（NODE_ENV=development）→ debug
 * 3. 其他環境（production/test/…）→ info
 */
function resolveMinLevel(): EdgeLogLevel {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

/**
 * 將 context 物件安全地序列化為 JSON 字串（避免循環引用崩潰）
 */
function stringifyContext(context: Record<string, unknown>): string {
  try {
    return JSON.stringify(context);
  } catch {
    return '[unserializable context]';
  }
}

/**
 * 核心日誌輸出函數
 *
 * 本檔案是 Edge Runtime 的 console 包裝器，刻意允許使用 console.*
 * ESLint 的 no-console 規則在此檔案停用。
 */
/* eslint-disable no-console */
function log(
  level: EdgeLogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const min = resolveMinLevel();
  if (LEVEL_ORDER[level] < LEVEL_ORDER[min]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const ctx = context && Object.keys(context).length > 0
    ? ` ${stringifyContext(context)}`
    : '';
  const line = `${prefix} ${message}${ctx}`;

  // 使用對應的 console method，讓工具鏈能正確分類
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else if (level === 'debug') {
    console.debug(line);
  } else {
    console.info(line);
  }
}
/* eslint-enable no-console */

/**
 * Edge Runtime 兼容的 logger
 *
 * @example
 * ```typescript
 * import { edgeLogger } from '@/lib/edge-logger';
 *
 * edgeLogger.debug('User action', { userId: '123' });
 * edgeLogger.warn('Fallback triggered');
 * ```
 */
export const edgeLogger = {
  debug(message: string, context?: Record<string, unknown>): void {
    log('debug', message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    log('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    log('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    log('error', message, context);
  },
};
