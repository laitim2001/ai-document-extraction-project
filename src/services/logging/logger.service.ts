/**
 * @fileoverview 日誌寫入服務
 * @description
 *   提供結構化日誌寫入功能
 *   - 多級別日誌記錄（debug, info, warn, error, critical）
 *   - 請求上下文追蹤（correlationId, requestId）
 *   - 即時串流事件廣播
 *   - AsyncLocalStorage 上下文傳遞
 *
 * @module src/services/logging/logger.service
 * @since Epic 12 - Story 12-7
 * @lastModified 2025-12-21
 */

import { prisma } from '@/lib/prisma';
import { LogLevel, LogSource, Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import { AsyncLocalStorage } from 'async_hooks';
import {
  LogWriteOptions,
  LogRequestContext,
  LogEntry,
} from '@/types/logging';

// ============================================================
// Log Stream Emitter (Singleton for SSE)
// ============================================================

/**
 * 日誌串流事件發送器
 * 用於 SSE 即時串流功能
 */
class LogStreamEmitter extends EventEmitter {
  private static instance: LogStreamEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // 支援多個 SSE 連線
  }

  /**
   * 取得單例實例
   */
  static getInstance(): LogStreamEmitter {
    if (!LogStreamEmitter.instance) {
      LogStreamEmitter.instance = new LogStreamEmitter();
    }
    return LogStreamEmitter.instance;
  }

  /**
   * 發送日誌事件
   */
  emitLog(log: LogEntry): void {
    this.emit('log', log);
  }
}

export const logStreamEmitter = LogStreamEmitter.getInstance();

// ============================================================
// Request Context Storage
// ============================================================

/**
 * 請求上下文存儲
 * 用於跨函數傳遞請求追蹤資訊
 */
export const requestContextStorage = new AsyncLocalStorage<LogRequestContext>();

/**
 * 取得當前請求上下文
 */
export function getLogRequestContext(): LogRequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================
// Logger Service
// ============================================================

/**
 * 日誌服務類別
 */
export class LoggerService {
  private source: LogSource;
  private className?: string;

  constructor(source: LogSource, className?: string) {
    this.source = source;
    this.className = className;
  }

  /**
   * 記錄 DEBUG 級別日誌
   */
  debug(message: string, options?: Partial<LogWriteOptions>): Promise<void> {
    return this.log({ level: 'DEBUG', message, ...options });
  }

  /**
   * 記錄 INFO 級別日誌
   */
  info(message: string, options?: Partial<LogWriteOptions>): Promise<void> {
    return this.log({ level: 'INFO', message, ...options });
  }

  /**
   * 記錄 WARN 級別日誌
   */
  warn(message: string, options?: Partial<LogWriteOptions>): Promise<void> {
    return this.log({ level: 'WARN', message, ...options });
  }

  /**
   * 記錄 ERROR 級別日誌
   */
  error(message: string, error?: Error, options?: Partial<LogWriteOptions>): Promise<void> {
    return this.log({
      level: 'ERROR',
      message,
      error,
      errorCode: options?.errorCode ?? error?.name,
      ...options,
    });
  }

  /**
   * 記錄 CRITICAL 級別日誌
   */
  critical(message: string, error?: Error, options?: Partial<LogWriteOptions>): Promise<void> {
    return this.log({
      level: 'CRITICAL',
      message,
      error,
      errorCode: options?.errorCode ?? error?.name,
      ...options,
    });
  }

  /**
   * 記錄 HTTP 請求日誌
   */
  httpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    options?: Partial<LogWriteOptions>
  ): Promise<void> {
    const level: LogLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

    return this.log({
      level,
      message: `${method} ${path} - ${statusCode} (${duration}ms)`,
      endpoint: path,
      duration,
      details: {
        httpMethod: method,
        httpStatusCode: statusCode,
        ...options?.details,
      },
      ...options,
    });
  }

  /**
   * 核心日誌寫入方法
   */
  private async log(options: Partial<LogWriteOptions> & { level: LogLevel; message: string }): Promise<void> {
    const context = getLogRequestContext();

    const logData: Parameters<typeof prisma.systemLog.create>[0]['data'] = {
      level: options.level,
      source: options.source ?? this.source,
      message: options.message,
      details: options.details as Prisma.InputJsonValue | undefined,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      sessionId: context?.sessionId,
      className: options.className ?? this.className,
      methodName: options.methodName,
      errorCode: options.errorCode,
      errorStack: options.error?.stack,
      duration: options.duration,
      memoryUsage: options.memoryUsage,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      endpoint: options.endpoint,
    };

    // 只有當 userId 存在時才添加
    if (context?.userId) {
      logData.userId = context.userId;
    }

    try {
      // 寫入資料庫
      const savedLog = await prisma.systemLog.create({
        data: logData,
      });

      // 發送串流事件
      const logEntry: LogEntry = {
        id: savedLog.id,
        timestamp: savedLog.timestamp,
        level: savedLog.level,
        source: savedLog.source,
        message: savedLog.message,
        details: savedLog.details as Record<string, unknown> | undefined,
        correlationId: savedLog.correlationId ?? undefined,
        requestId: savedLog.requestId ?? undefined,
        sessionId: savedLog.sessionId ?? undefined,
        userId: savedLog.userId ?? undefined,
        className: savedLog.className ?? undefined,
        methodName: savedLog.methodName ?? undefined,
        errorCode: savedLog.errorCode ?? undefined,
        errorStack: savedLog.errorStack ?? undefined,
        duration: savedLog.duration ?? undefined,
        memoryUsage: savedLog.memoryUsage ?? undefined,
        ipAddress: savedLog.ipAddress ?? undefined,
        userAgent: savedLog.userAgent ?? undefined,
        endpoint: savedLog.endpoint ?? undefined,
      };

      logStreamEmitter.emitLog(logEntry);

      // 開發環境也輸出到 console
      if (process.env.NODE_ENV === 'development') {
        this.consoleLog(options.level, options.message, options.error);
      }
    } catch (error) {
      // 日誌寫入失敗時，至少輸出到 console
      console.error('Failed to write log to database:', error);
      this.consoleLog(options.level, options.message, options.error);
    }
  }

  /**
   * 輸出到 console
   */
  private consoleLog(level: LogLevel, message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.source}]`;

    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message);
        break;
      case 'INFO':
        console.info(prefix, message);
        break;
      case 'WARN':
        console.warn(prefix, message);
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(prefix, message);
        if (error) {
          console.error(error);
        }
        break;
    }
  }
}

// ============================================================
// Pre-configured Logger Instances
// ============================================================

/**
 * Web 應用日誌記錄器
 */
export const webLogger = new LoggerService('WEB');

/**
 * API 服務日誌記錄器
 */
export const apiLogger = new LoggerService('API');

/**
 * AI 服務日誌記錄器
 */
export const aiLogger = new LoggerService('AI');

/**
 * 資料庫日誌記錄器
 */
export const dbLogger = new LoggerService('DATABASE');

/**
 * n8n 工作流日誌記錄器
 */
export const n8nLogger = new LoggerService('N8N');

/**
 * 排程任務日誌記錄器
 */
export const schedulerLogger = new LoggerService('SCHEDULER');

/**
 * 背景任務日誌記錄器
 */
export const backgroundLogger = new LoggerService('BACKGROUND');

/**
 * 系統日誌記錄器
 */
export const systemLogger = new LoggerService('SYSTEM');

/**
 * 建立自訂日誌記錄器
 * @param source 日誌來源
 * @param className 類別名稱
 */
export function createLogger(source: LogSource, className?: string): LoggerService {
  return new LoggerService(source, className);
}

// ============================================================
// Request Context Helpers
// ============================================================

/**
 * 建立請求上下文
 */
export function createLogRequestContext(options: {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}): LogRequestContext {
  return {
    correlationId: options.correlationId ?? generateId(),
    requestId: generateId(),
    userId: options.userId,
    sessionId: options.sessionId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  };
}

/**
 * 在請求上下文中執行函數
 */
export function runWithContext<T>(
  context: LogRequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

/**
 * 在請求上下文中執行異步函數
 */
export async function runWithContextAsync<T>(
  context: LogRequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestContextStorage.run(context, fn);
}
