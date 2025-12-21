/**
 * @fileoverview 日誌查詢服務
 * @description
 *   提供系統日誌的查詢、統計、匯出功能
 *   - 多條件篩選查詢（時間、級別、來源、關鍵字）
 *   - 日誌詳情和關聯日誌查詢
 *   - 日誌統計分析
 *   - CSV/JSON 格式匯出
 *   - 過期日誌清理
 *
 * @module src/services/logging/log-query.service
 * @since Epic 12 - Story 12-7
 * @lastModified 2025-12-21
 */

import { prisma } from '@/lib/prisma';
import { LogLevel, LogSource, LogExportFormat, Prisma } from '@prisma/client';
import {
  LogQueryFilters,
  LogQueryOptions,
  LogQueryResult,
  LogEntry,
  LogDetail,
  LogStats,
  LogExportRequest,
  ExportStatusResponse,
  LogCleanupResult,
  LOG_DEFAULT_RETENTION_DAYS,
  MAX_EXPORT_RECORDS,
  EXPORT_FILE_EXPIRY_HOURS,
} from '@/types/logging';

/**
 * 日誌查詢服務類別
 */
export class LogQueryService {
  /**
   * 查詢日誌
   * @param options 查詢選項
   * @returns 分頁日誌結果
   */
  async queryLogs(options: LogQueryOptions): Promise<LogQueryResult> {
    const { filters, limit = 100, offset = 0, orderBy = 'desc' } = options;

    const where = this.buildWhereClause(filters);

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { timestamp: orderBy },
        take: Math.min(limit, 1000),
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.systemLog.count({ where }),
    ]);

    return {
      logs: logs.map(this.mapToLogEntry),
      total,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * 取得單筆日誌詳情
   * @param logId 日誌 ID
   * @returns 日誌詳情
   */
  async getLogDetail(logId: string): Promise<LogDetail | null> {
    const log = await prisma.systemLog.findUnique({
      where: { id: logId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!log) return null;

    // 計算關聯日誌數量
    let relatedLogsCount = 0;
    if (log.correlationId) {
      relatedLogsCount = await prisma.systemLog.count({
        where: {
          correlationId: log.correlationId,
          id: { not: logId },
        },
      });
    }

    return {
      ...this.mapToLogEntry(log),
      userEmail: log.user?.email ?? undefined,
      relatedLogsCount,
    };
  }

  /**
   * 取得關聯日誌（同一 correlationId）
   * @param logId 日誌 ID
   * @param limit 最大筆數
   * @returns 關聯日誌列表
   */
  async getRelatedLogs(logId: string, limit = 50): Promise<LogEntry[]> {
    const log = await prisma.systemLog.findUnique({
      where: { id: logId },
      select: { correlationId: true },
    });

    if (!log?.correlationId) return [];

    const relatedLogs = await prisma.systemLog.findMany({
      where: {
        correlationId: log.correlationId,
        id: { not: logId },
      },
      orderBy: { timestamp: 'asc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return relatedLogs.map(this.mapToLogEntry);
  }

  /**
   * 取得日誌統計
   * @param filters 篩選條件
   * @returns 統計資料
   */
  async getLogStats(filters: LogQueryFilters): Promise<LogStats> {
    const where = this.buildWhereClause(filters);

    // 並行執行所有統計查詢
    const [
      totalCount,
      levelCounts,
      sourceCounts,
      errorCount,
      avgDuration,
    ] = await Promise.all([
      // 總筆數
      prisma.systemLog.count({ where }),

      // 依級別統計
      prisma.systemLog.groupBy({
        by: ['level'],
        where,
        _count: { id: true },
      }),

      // 依來源統計
      prisma.systemLog.groupBy({
        by: ['source'],
        where,
        _count: { id: true },
      }),

      // 錯誤數（ERROR + CRITICAL）
      prisma.systemLog.count({
        where: {
          ...where,
          level: { in: ['ERROR', 'CRITICAL'] },
        },
      }),

      // 平均回應時間
      prisma.systemLog.aggregate({
        where: {
          ...where,
          duration: { not: null },
        },
        _avg: { duration: true },
      }),
    ]);

    // 轉換統計結果
    const byLevel = Object.fromEntries(
      Object.values(LogLevel).map((level) => [
        level,
        levelCounts.find((c) => c.level === level)?._count.id ?? 0,
      ])
    ) as Record<LogLevel, number>;

    const bySource = Object.fromEntries(
      Object.values(LogSource).map((source) => [
        source,
        sourceCounts.find((c) => c.source === source)?._count.id ?? 0,
      ])
    ) as Record<LogSource, number>;

    // 計算時間範圍
    const now = new Date();
    const startTime = filters.startTime ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const endTime = filters.endTime ?? now;

    return {
      totalCount,
      byLevel,
      bySource,
      errorRate: totalCount > 0 ? (errorCount / totalCount) * 100 : 0,
      avgResponseTime: avgDuration._avg.duration ?? 0,
      timeRange: {
        start: startTime,
        end: endTime,
      },
    };
  }

  /**
   * 建立日誌匯出任務
   * @param request 匯出請求
   * @param userId 建立者 ID
   * @returns 匯出任務 ID
   */
  async createExport(request: LogExportRequest, userId: string): Promise<string> {
    const { filters, format, maxRecords = MAX_EXPORT_RECORDS } = request;

    // 建立匯出記錄
    const exportRecord = await prisma.logExport.create({
      data: {
        format,
        status: 'PENDING',
        levels: filters.levels ?? [],
        sources: filters.sources ?? [],
        startDate: filters.startTime ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: filters.endTime ?? new Date(),
        searchQuery: filters.keyword,
        createdBy: userId,
        expiresAt: new Date(Date.now() + EXPORT_FILE_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    // 異步執行匯出（在實際環境中應使用背景任務）
    this.processExport(exportRecord.id, filters, format, maxRecords).catch((error) => {
      console.error(`Export ${exportRecord.id} failed:`, error);
    });

    return exportRecord.id;
  }

  /**
   * 取得匯出狀態
   * @param exportId 匯出 ID
   * @returns 匯出狀態
   */
  async getExportStatus(exportId: string): Promise<ExportStatusResponse | null> {
    const exportRecord = await prisma.logExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) return null;

    return {
      id: exportRecord.id,
      status: exportRecord.status,
      format: exportRecord.format,
      exportedCount: exportRecord.recordCount ?? undefined,
      fileSize: exportRecord.fileSize ? Number(exportRecord.fileSize) : undefined,
      downloadUrl: exportRecord.status === 'COMPLETED' && exportRecord.filePath
        ? `/api/admin/logs/export/${exportRecord.id}/download`
        : undefined,
      errorMessage: exportRecord.errorMessage ?? undefined,
      createdAt: exportRecord.createdAt,
      completedAt: exportRecord.completedAt ?? undefined,
      expiresAt: exportRecord.expiresAt ?? undefined,
    };
  }

  /**
   * 清理過期日誌
   * @returns 清理結果
   */
  async cleanupExpiredLogs(): Promise<LogCleanupResult> {
    // 取得保留策略
    const policies = await prisma.logRetentionPolicy.findMany({
      where: { autoCleanup: true },
    });

    const byLevel: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRITICAL: 0,
    };

    let totalDeleted = 0;

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const result = await prisma.systemLog.deleteMany({
        where: {
          level: policy.level,
          timestamp: { lt: cutoffDate },
        },
      });

      byLevel[policy.level] = result.count;
      totalDeleted += result.count;

      // 更新策略記錄
      await prisma.logRetentionPolicy.update({
        where: { id: policy.id },
        data: {
          lastCleanupAt: new Date(),
          recordsCleaned: { increment: result.count },
        },
      });
    }

    // 對沒有策略的級別使用預設值
    for (const level of Object.values(LogLevel)) {
      if (!policies.some((p) => p.level === level)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - LOG_DEFAULT_RETENTION_DAYS[level]);

        const result = await prisma.systemLog.deleteMany({
          where: {
            level,
            timestamp: { lt: cutoffDate },
          },
        });

        byLevel[level] = result.count;
        totalDeleted += result.count;
      }
    }

    return {
      deletedCount: totalDeleted,
      byLevel,
      cleanedAt: new Date(),
    };
  }

  /**
   * 處理匯出任務
   * @param exportId 匯出 ID
   * @param filters 篩選條件
   * @param format 匯出格式
   * @param maxRecords 最大筆數
   */
  private async processExport(
    exportId: string,
    filters: LogQueryFilters,
    format: LogExportFormat,
    maxRecords: number
  ): Promise<void> {
    try {
      // 更新狀態為處理中
      await prisma.logExport.update({
        where: { id: exportId },
        data: { status: 'PROCESSING' },
      });

      const where = this.buildWhereClause(filters);

      // 查詢日誌（限制數量）
      const logs = await prisma.systemLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: maxRecords,
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      // 生成匯出內容
      let content: string;

      if (format === 'CSV') {
        content = this.generateCsvContent(logs);
      } else if (format === 'JSON') {
        content = JSON.stringify(logs.map(this.mapToLogEntry), null, 2);
      } else {
        content = this.generateTxtContent(logs);
      }

      const fileSize = Buffer.byteLength(content, 'utf-8');

      // 儲存檔案路徑（在實際環境中應儲存到雲端儲存）
      const filePath = `/tmp/exports/${exportId}.${format.toLowerCase()}`;

      // 更新匯出記錄
      await prisma.logExport.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          filePath,
          fileSize: BigInt(fileSize),
          recordCount: logs.length,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.logExport.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          errorMessage,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * 生成 CSV 內容
   */
  private generateCsvContent(logs: Array<{
    id: string;
    timestamp: Date;
    level: LogLevel;
    source: LogSource;
    message: string;
    correlationId: string | null;
    errorCode: string | null;
    duration: number | null;
    user: { id: string; name: string | null } | null;
  }>): string {
    const headers = [
      'ID',
      'Timestamp',
      'Level',
      'Source',
      'Message',
      'CorrelationId',
      'ErrorCode',
      'Duration',
      'UserId',
      'UserName',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.level,
      log.source,
      `"${(log.message || '').replace(/"/g, '""')}"`,
      log.correlationId || '',
      log.errorCode || '',
      log.duration?.toString() || '',
      log.user?.id || '',
      log.user?.name || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * 生成 TXT 內容
   */
  private generateTxtContent(logs: Array<{
    timestamp: Date;
    level: LogLevel;
    source: LogSource;
    message: string;
    errorStack: string | null;
  }>): string {
    return logs
      .map((log) => {
        let line = `[${log.timestamp.toISOString()}] [${log.level}] [${log.source}] ${log.message}`;
        if (log.errorStack) {
          line += `\n${log.errorStack}`;
        }
        return line;
      })
      .join('\n\n');
  }

  /**
   * 建構查詢條件
   * @param filters 篩選條件
   * @returns Prisma where 條件
   */
  private buildWhereClause(filters: LogQueryFilters): Prisma.SystemLogWhereInput {
    const where: Prisma.SystemLogWhereInput = {};

    // 時間範圍
    if (filters.startTime || filters.endTime) {
      where.timestamp = {};
      if (filters.startTime) {
        where.timestamp.gte = filters.startTime;
      }
      if (filters.endTime) {
        where.timestamp.lte = filters.endTime;
      }
    }

    // 日誌級別
    if (filters.levels && filters.levels.length > 0) {
      where.level = { in: filters.levels };
    }

    // 來源
    if (filters.sources && filters.sources.length > 0) {
      where.source = { in: filters.sources };
    }

    // 關鍵字搜尋
    if (filters.keyword) {
      where.OR = [
        { message: { contains: filters.keyword, mode: 'insensitive' } },
        { errorCode: { contains: filters.keyword, mode: 'insensitive' } },
        { endpoint: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    // 用戶 ID
    if (filters.userId) {
      where.userId = filters.userId;
    }

    // 關聯 ID
    if (filters.correlationId) {
      where.correlationId = filters.correlationId;
    }

    // 請求 ID
    if (filters.requestId) {
      where.requestId = filters.requestId;
    }

    // 錯誤代碼
    if (filters.errorCode) {
      where.errorCode = filters.errorCode;
    }

    // API 端點
    if (filters.endpoint) {
      where.endpoint = { contains: filters.endpoint, mode: 'insensitive' };
    }

    return where;
  }

  /**
   * 將資料庫記錄轉換為 LogEntry
   */
  private mapToLogEntry(log: {
    id: string;
    timestamp: Date;
    level: LogLevel;
    source: LogSource;
    message: string;
    details: Prisma.JsonValue;
    correlationId: string | null;
    requestId: string | null;
    sessionId: string | null;
    userId: string | null;
    className: string | null;
    methodName: string | null;
    lineNumber: number | null;
    errorCode: string | null;
    errorStack: string | null;
    duration: number | null;
    memoryUsage: number | null;
    ipAddress: string | null;
    userAgent: string | null;
    endpoint: string | null;
    user?: { id: string; name: string | null } | null;
  }): LogEntry {
    return {
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      source: log.source,
      message: log.message,
      details: log.details as Record<string, unknown> | undefined,
      correlationId: log.correlationId ?? undefined,
      requestId: log.requestId ?? undefined,
      sessionId: log.sessionId ?? undefined,
      userId: log.userId ?? undefined,
      userName: log.user?.name ?? undefined,
      className: log.className ?? undefined,
      methodName: log.methodName ?? undefined,
      lineNumber: log.lineNumber ?? undefined,
      errorCode: log.errorCode ?? undefined,
      errorStack: log.errorStack ?? undefined,
      duration: log.duration ?? undefined,
      memoryUsage: log.memoryUsage ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
      endpoint: log.endpoint ?? undefined,
    };
  }
}

// 單例模式匯出
export const logQueryService = new LogQueryService();
