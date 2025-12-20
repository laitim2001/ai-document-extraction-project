/**
 * @fileoverview 審計日誌服務
 * @description
 *   提供審計日誌的寫入功能，支援批次寫入和同步寫入。
 *   - 敏感操作採用同步寫入，確保即時記錄
 *   - 非敏感操作採用批次寫入，優化效能
 *   - 自動處理寫入失敗並記錄安全事件
 *
 * @module src/services/audit-log.service
 * @since Epic 8 - Story 8.1 (用戶操作日誌記錄)
 * @lastModified 2025-12-20
 *
 * @features
 *   - Singleton 模式確保單一實例
 *   - 批次寫入優化效能（100 條記錄或 1 秒）
 *   - 敏感操作同步寫入
 *   - 寫入失敗自動記錄到 SecurityLog
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/audit - 審計類型定義
 *
 * @related
 *   - src/middleware/audit-log.middleware.ts - 審計日誌中間件
 *   - prisma/schema.prisma - AuditLog 模型
 */

import { prisma } from '@/lib/prisma';
import {
  AuditLogEntry,
  AuditAction,
  AuditStatus,
  isSensitiveOperation,
  AUDIT_BATCH_CONFIG,
} from '@/types/audit';

// ============================================================
// Types
// ============================================================

/**
 * 服務狀態
 */
interface ServiceStats {
  totalLogged: number;
  batchWrites: number;
  immediateWrites: number;
  failedWrites: number;
  lastFlushTime: Date | null;
}

// ============================================================
// Service
// ============================================================

/**
 * 審計日誌服務
 *
 * @description
 * 使用 Singleton 模式確保單一實例。
 * 提供異步批次寫入和同步立即寫入兩種模式。
 *
 * @example
 * ```typescript
 * // 獲取服務實例
 * const service = AuditLogService.getInstance();
 *
 * // 記錄審計日誌
 * await service.log({
 *   userId: 'user-1',
 *   userName: 'John Doe',
 *   action: 'CREATE',
 *   resourceType: 'document',
 *   resourceId: 'doc-123',
 *   status: 'SUCCESS'
 * });
 *
 * // 應用關閉時刷新緩衝區
 * await service.shutdown();
 * ```
 */
export class AuditLogService {
  private static instance: AuditLogService;
  private writeQueue: AuditLogEntry[] = [];
  private flushTimeout: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown: boolean = false;
  private stats: ServiceStats = {
    totalLogged: 0,
    batchWrites: 0,
    immediateWrites: 0,
    failedWrites: 0,
    lastFlushTime: null,
  };

  private readonly BATCH_SIZE = AUDIT_BATCH_CONFIG.BATCH_SIZE;
  private readonly FLUSH_INTERVAL = AUDIT_BATCH_CONFIG.FLUSH_INTERVAL;

  /**
   * 獲取服務單例
   */
  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  /**
   * 私有建構函數，防止直接實例化
   */
  private constructor() {
    this.startFlushTimer();
  }

  /**
   * 記錄審計日誌
   *
   * @param entry - 審計日誌條目
   * @description
   * - 敏感操作（用戶管理、角色管理等）採用同步寫入
   * - 非敏感操作採用批次寫入，提高效能
   */
  async log(entry: AuditLogEntry): Promise<void> {
    // 服務關閉中不接受新日誌
    if (this.isShuttingDown) {
      console.warn('AuditLogService is shutting down, log entry ignored');
      return;
    }

    this.stats.totalLogged++;

    // 敏感操作同步寫入
    if (isSensitiveOperation(entry.resourceType, entry.action)) {
      await this.writeImmediately(entry);
      return;
    }

    // 非敏感操作批次寫入
    this.writeQueue.push(entry);
    if (this.writeQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * 立即寫入單條審計日誌
   *
   * @param entry - 審計日誌條目
   */
  private async writeImmediately(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: this.transformEntry(entry),
      });
      this.stats.immediateWrites++;
    } catch (error) {
      console.error('Failed to write audit log immediately:', error);
      this.stats.failedWrites++;
      await this.logWriteFailure(entry, error);
    }
  }

  /**
   * 刷新批次緩衝區，寫入所有待處理的日誌
   */
  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) {
      return;
    }

    const entries = [...this.writeQueue];
    this.writeQueue = [];

    try {
      await prisma.auditLog.createMany({
        data: entries.map((entry) => this.transformEntry(entry)),
      });
      this.stats.batchWrites++;
      this.stats.lastFlushTime = new Date();
    } catch (error) {
      console.error('Failed to batch write audit logs:', error);
      // 批次寫入失敗時，嘗試逐條寫入
      for (const entry of entries) {
        await this.writeImmediately(entry);
      }
    }
  }

  /**
   * 轉換審計日誌條目為 Prisma 數據格式
   */
  private transformEntry(entry: AuditLogEntry): {
    userId: string;
    userName: string;
    userEmail: string | undefined;
    action: AuditAction;
    resourceType: string;
    resourceId: string | undefined;
    resourceName: string | undefined;
    description: string | undefined;
    changes: object | undefined;
    metadata: object | undefined;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    requestId: string | undefined;
    sessionId: string | undefined;
    status: AuditStatus;
    errorMessage: string | undefined;
    cityCode: string | undefined;
  } {
    return {
      userId: entry.userId,
      userName: entry.userName,
      userEmail: entry.userEmail,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      resourceName: entry.resourceName,
      description: entry.description,
      changes: entry.changes as object | undefined,
      metadata: entry.metadata as object | undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      requestId: entry.requestId,
      sessionId: entry.sessionId,
      status: entry.status || 'SUCCESS',
      errorMessage: entry.errorMessage,
      cityCode: entry.cityCode,
    };
  }

  /**
   * 啟動定時刷新計時器
   */
  private startFlushTimer(): void {
    if (this.flushTimeout) {
      return;
    }

    this.flushTimeout = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Scheduled flush failed:', error);
      });
    }, this.FLUSH_INTERVAL);
  }

  /**
   * 記錄寫入失敗到安全日誌
   */
  private async logWriteFailure(
    entry: AuditLogEntry,
    error: unknown
  ): Promise<void> {
    try {
      await prisma.securityLog.create({
        data: {
          userId: entry.userId,
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'HIGH',
          resourceType: 'AuditLog',
          resourceId: entry.resourceId,
          details: {
            message: 'Failed to write audit log',
            entry: {
              action: entry.action,
              resourceType: entry.resourceType,
              resourceId: entry.resourceId,
            },
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (logError) {
      console.error('CRITICAL: Failed to log audit write failure', {
        originalEntry: entry,
        originalError: error,
        logError,
      });
    }
  }

  /**
   * 關閉服務
   *
   * @description 刷新所有待處理的日誌並停止定時器
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // 停止定時器
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
      this.flushTimeout = null;
    }

    // 刷新剩餘日誌
    await this.flush();
  }

  /**
   * 獲取服務統計資訊
   */
  getStats(): Readonly<ServiceStats> {
    return { ...this.stats };
  }

  /**
   * 獲取待處理日誌數量
   */
  getPendingCount(): number {
    return this.writeQueue.length;
  }

  /**
   * 重置服務（僅用於測試）
   * @internal
   */
  static resetInstance(): void {
    if (AuditLogService.instance) {
      AuditLogService.instance.shutdown().catch(console.error);
      // @ts-expect-error - 用於測試重置
      AuditLogService.instance = undefined;
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 審計日誌服務單例
 *
 * @example
 * ```typescript
 * import { auditLogService } from '@/services/audit-log.service';
 *
 * await auditLogService.log({
 *   userId: 'user-1',
 *   userName: 'John Doe',
 *   action: 'UPDATE',
 *   resourceType: 'document',
 *   resourceId: 'doc-123'
 * });
 * ```
 */
export const auditLogService = AuditLogService.getInstance();
