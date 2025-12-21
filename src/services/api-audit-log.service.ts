/**
 * @fileoverview API 審計日誌服務
 * @description
 *   專門用於外部 API 請求的審計日誌記錄，包括：
 *   - 請求資訊記錄
 *   - 敏感資訊過濾
 *   - 批次寫入優化
 *   - 日誌查詢
 *
 * @module src/services/api-audit-log.service
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 敏感資訊自動過濾
 *   - 批次寫入優化
 *   - 分頁查詢
 *   - 統計分析
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/middleware/external-api-auth.ts - API 認證中間件
 *   - src/types/external-api/auth.ts - 認證類型定義
 *   - prisma/schema.prisma - ApiAuditLog 模型
 */

import { prisma } from '@/lib/prisma';
import {
  API_AUDIT_BATCH_CONFIG,
  AUDIT_SENSITIVE_FIELDS,
} from '@/lib/constants/api-auth';
import type { ApiAuditLogEntry } from '@/types/external-api/auth';
import { Prisma } from '@prisma/client';

// ============================================================
// 類型定義
// ============================================================

/**
 * 審計日誌查詢參數
 */
export interface ApiAuditLogQueryParams {
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  limit?: number;
  /** API Key ID 篩選 */
  apiKeyId?: string;
  /** 開始日期 */
  startDate?: Date;
  /** 結束日期 */
  endDate?: Date;
  /** HTTP 狀態碼篩選 */
  statusCode?: number;
  /** 端點篩選 */
  endpoint?: string;
  /** 客戶端 IP 篩選 */
  clientIp?: string;
}

/**
 * 審計日誌響應
 */
export interface ApiAuditLogResponse {
  id: string;
  apiKeyId: string;
  method: string;
  endpoint: string;
  path: string;
  queryParams: Record<string, unknown> | null;
  requestBody: Record<string, unknown> | null;
  statusCode: number;
  responseTime: number;
  errorCode: string | null;
  errorMessage: string | null;
  clientIp: string;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  traceId: string | null;
  createdAt: Date;
}

/**
 * 分頁結果（本地使用）
 */
interface AuditLogPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * API 使用統計
 */
export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByStatusCode: Record<string, number>;
}

// ============================================================
// 服務類別
// ============================================================

/**
 * API 審計日誌服務
 *
 * @description
 * 專門處理外部 API 請求的審計日誌。
 * 使用批次寫入優化效能，自動過濾敏感資訊。
 *
 * @example
 * ```typescript
 * // 記錄 API 請求
 * await apiAuditLogService.log({
 *   apiKeyId: 'key-123',
 *   method: 'POST',
 *   endpoint: '/api/v1/invoices',
 *   path: '/api/v1/invoices',
 *   statusCode: 201,
 *   responseTime: 150,
 *   clientIp: '192.168.1.1',
 * });
 *
 * // 查詢日誌
 * const logs = await apiAuditLogService.query({
 *   apiKeyId: 'key-123',
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
export class ApiAuditLogService {
  private static instance: ApiAuditLogService;
  private writeQueue: ApiAuditLogEntry[] = [];
  private flushTimeout: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  private readonly BATCH_SIZE = API_AUDIT_BATCH_CONFIG.BATCH_SIZE;
  private readonly FLUSH_INTERVAL = API_AUDIT_BATCH_CONFIG.FLUSH_INTERVAL;

  /**
   * 獲取服務單例
   */
  static getInstance(): ApiAuditLogService {
    if (!ApiAuditLogService.instance) {
      ApiAuditLogService.instance = new ApiAuditLogService();
    }
    return ApiAuditLogService.instance;
  }

  /**
   * 私有建構函數
   */
  private constructor() {
    this.startFlushTimer();
  }

  // ============================================================
  // 日誌記錄
  // ============================================================

  /**
   * 記錄 API 審計日誌
   *
   * @description
   * 自動過濾敏感資訊，使用批次寫入優化效能。
   *
   * @param entry 日誌條目
   */
  async log(entry: ApiAuditLogEntry): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('ApiAuditLogService is shutting down, log entry ignored');
      return;
    }

    // 過濾敏感資訊
    const sanitizedEntry = this.sanitizeEntry(entry);

    // 加入寫入佇列
    this.writeQueue.push(sanitizedEntry);

    // 達到批次大小時立即寫入
    if (this.writeQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * 刷新批次緩衝區
   */
  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) {
      return;
    }

    const entries = [...this.writeQueue];
    this.writeQueue = [];

    try {
      await prisma.apiAuditLog.createMany({
        data: entries.map((entry) => ({
          apiKeyId: entry.apiKeyId,
          method: entry.method,
          endpoint: entry.endpoint,
          path: entry.path,
          queryParams: entry.queryParams as Prisma.InputJsonValue | undefined,
          requestBody: entry.requestBody as Prisma.InputJsonValue | undefined,
          statusCode: entry.statusCode,
          responseTime: entry.responseTime,
          errorCode: entry.errorCode,
          errorMessage: entry.errorMessage,
          clientIp: entry.clientIp,
          userAgent: entry.userAgent,
          country: entry.country,
          city: entry.city,
          traceId: entry.traceId,
        })),
      });
    } catch (error) {
      console.error('Failed to batch write API audit logs:', error);
      // 批次失敗時逐條寫入
      for (const entry of entries) {
        try {
          await prisma.apiAuditLog.create({
            data: {
              apiKeyId: entry.apiKeyId,
              method: entry.method,
              endpoint: entry.endpoint,
              path: entry.path,
              queryParams: entry.queryParams as Prisma.InputJsonValue | undefined,
              requestBody: entry.requestBody as Prisma.InputJsonValue | undefined,
              statusCode: entry.statusCode,
              responseTime: entry.responseTime,
              errorCode: entry.errorCode,
              errorMessage: entry.errorMessage,
              clientIp: entry.clientIp,
              userAgent: entry.userAgent,
              country: entry.country,
              city: entry.city,
              traceId: entry.traceId,
            },
          });
        } catch (innerError) {
          console.error('Failed to write individual API audit log:', innerError);
        }
      }
    }
  }

  // ============================================================
  // 日誌查詢
  // ============================================================

  /**
   * 查詢 API 審計日誌
   *
   * @param params 查詢參數
   * @returns 分頁結果
   */
  async query(params: ApiAuditLogQueryParams = {}): Promise<AuditLogPaginatedResult<ApiAuditLogResponse>> {
    const {
      page = 1,
      limit = 50,
      apiKeyId,
      startDate,
      endDate,
      statusCode,
      endpoint,
      clientIp,
    } = params;

    // 構建查詢條件
    const where: Prisma.ApiAuditLogWhereInput = {
      ...(apiKeyId && { apiKeyId }),
      ...(statusCode && { statusCode }),
      ...(endpoint && { endpoint: { contains: endpoint } }),
      ...(clientIp && { clientIp }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    // 執行查詢
    const [logs, total] = await Promise.all([
      prisma.apiAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.apiAuditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => this.toApiAuditLogResponse(log)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 獲取 API Key 的使用統計
   *
   * @param apiKeyId API Key ID
   * @param startDate 開始日期
   * @param endDate 結束日期
   */
  async getUsageStats(
    apiKeyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ApiUsageStats> {
    const where: Prisma.ApiAuditLogWhereInput = {
      apiKeyId,
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    // 獲取所有相關日誌
    const logs = await prisma.apiAuditLog.findMany({
      where,
      select: {
        statusCode: true,
        responseTime: true,
        endpoint: true,
      },
    });

    // 計算統計
    const totalRequests = logs.length;
    const successfulRequests = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
    const failedRequests = logs.filter((l) => l.statusCode >= 400).length;
    const averageResponseTime =
      totalRequests > 0
        ? logs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests
        : 0;

    // 按端點分組
    const requestsByEndpoint: Record<string, number> = {};
    for (const log of logs) {
      requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
    }

    // 按狀態碼分組
    const requestsByStatusCode: Record<string, number> = {};
    for (const log of logs) {
      const key = String(log.statusCode);
      requestsByStatusCode[key] = (requestsByStatusCode[key] || 0) + 1;
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime),
      requestsByEndpoint,
      requestsByStatusCode,
    };
  }

  /**
   * 獲取最近的請求記錄
   *
   * @param apiKeyId API Key ID
   * @param limit 限制數量
   */
  async getRecentRequests(apiKeyId: string, limit = 10): Promise<ApiAuditLogResponse[]> {
    const logs = await prisma.apiAuditLog.findMany({
      where: { apiKeyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => this.toApiAuditLogResponse(log));
  }

  // ============================================================
  // 資料清理
  // ============================================================

  /**
   * 清理過期的審計日誌
   *
   * @param retentionDays 保留天數
   * @returns 刪除的記錄數
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.apiAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  // ============================================================
  // 私有輔助方法
  // ============================================================

  /**
   * 過濾敏感資訊
   */
  private sanitizeEntry(entry: ApiAuditLogEntry): ApiAuditLogEntry {
    return {
      ...entry,
      queryParams: entry.queryParams
        ? this.sanitizeObject(entry.queryParams)
        : undefined,
      requestBody: entry.requestBody
        ? this.sanitizeObject(entry.requestBody)
        : undefined,
    };
  }

  /**
   * 過濾物件中的敏感欄位
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = AUDIT_SENSITIVE_FIELDS.some(
        (field) => lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
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
        console.error('Scheduled API audit log flush failed:', error);
      });
    }, this.FLUSH_INTERVAL);
  }

  /**
   * 轉換為響應格式
   */
  private toApiAuditLogResponse(log: {
    id: string;
    apiKeyId: string;
    method: string;
    endpoint: string;
    path: string;
    queryParams: Prisma.JsonValue;
    requestBody: Prisma.JsonValue;
    statusCode: number;
    responseTime: number;
    errorCode: string | null;
    errorMessage: string | null;
    clientIp: string;
    userAgent: string | null;
    country: string | null;
    city: string | null;
    traceId: string | null;
    createdAt: Date;
  }): ApiAuditLogResponse {
    return {
      id: log.id,
      apiKeyId: log.apiKeyId,
      method: log.method,
      endpoint: log.endpoint,
      path: log.path,
      queryParams: log.queryParams as Record<string, unknown> | null,
      requestBody: log.requestBody as Record<string, unknown> | null,
      statusCode: log.statusCode,
      responseTime: log.responseTime,
      errorCode: log.errorCode,
      errorMessage: log.errorMessage,
      clientIp: log.clientIp,
      userAgent: log.userAgent,
      country: log.country,
      city: log.city,
      traceId: log.traceId,
      createdAt: log.createdAt,
    };
  }

  /**
   * 關閉服務
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
      this.flushTimeout = null;
    }

    await this.flush();
  }

  /**
   * 獲取待處理日誌數量
   */
  getPendingCount(): number {
    return this.writeQueue.length;
  }

  /**
   * 重置服務實例（僅用於測試）
   * @internal
   */
  static resetInstance(): void {
    if (ApiAuditLogService.instance) {
      ApiAuditLogService.instance.shutdown().catch(console.error);
      // @ts-expect-error - 用於測試重置
      ApiAuditLogService.instance = undefined;
    }
  }
}

// ============================================================
// 單例導出
// ============================================================

/**
 * API 審計日誌服務單例
 *
 * @example
 * ```typescript
 * import { apiAuditLogService } from '@/services/api-audit-log.service';
 *
 * await apiAuditLogService.log({
 *   apiKeyId: 'key-123',
 *   method: 'POST',
 *   endpoint: '/api/v1/invoices',
 *   path: '/api/v1/invoices',
 *   statusCode: 201,
 *   responseTime: 150,
 *   clientIp: '192.168.1.1',
 * });
 * ```
 */
export const apiAuditLogService = ApiAuditLogService.getInstance();
