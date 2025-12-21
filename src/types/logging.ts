/**
 * @fileoverview 系統日誌類型定義
 * @description
 *   定義系統日誌查詢、寫入、匯出相關的 TypeScript 類型
 *   - 日誌查詢篩選條件和選項
 *   - 日誌條目和統計資料
 *   - 匯出狀態和請求上下文
 *
 * @module src/types/logging
 * @since Epic 12 - Story 12-7
 * @lastModified 2025-12-21
 */

import { LogLevel, LogSource, LogExportFormat, LogExportStatus } from '@prisma/client';
import { z } from 'zod';

// ============================================================
// Re-export Prisma types for convenience
// ============================================================

export { LogLevel, LogSource, LogExportFormat, LogExportStatus };

// ============================================================
// Log Query Types
// ============================================================

/**
 * 日誌查詢篩選條件
 */
export interface LogQueryFilters {
  /** 開始時間 */
  startTime?: Date;
  /** 結束時間 */
  endTime?: Date;
  /** 時間範圍（API 請求格式） */
  timeRange?: {
    start: Date;
    end: Date;
  };
  /** 日誌級別篩選 */
  levels?: LogLevel[];
  /** 來源篩選 */
  sources?: LogSource[];
  /** 關鍵字搜尋 */
  keyword?: string;
  /** 用戶 ID 篩選 */
  userId?: string;
  /** 關聯 ID 篩選（跨服務追蹤） */
  correlationId?: string;
  /** 請求 ID 篩選 */
  requestId?: string;
  /** 錯誤代碼篩選 */
  errorCode?: string;
  /** API 端點篩選 */
  endpoint?: string;
}

/**
 * 日誌查詢選項
 */
export interface LogQueryOptions {
  /** 篩選條件 */
  filters: LogQueryFilters;
  /** 每頁筆數 (預設: 100, 最大: 1000) */
  limit?: number;
  /** 偏移量 (預設: 0) */
  offset?: number;
  /** 排序方向 (預設: desc) */
  orderBy?: 'asc' | 'desc';
}

/**
 * 日誌條目（查詢回傳格式）
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
  className?: string;
  methodName?: string;
  lineNumber?: number;
  errorCode?: string;
  errorStack?: string;
  duration?: number;
  memoryUsage?: number;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
}

/**
 * 日誌詳情（包含完整資訊）
 */
export interface LogDetail extends LogEntry {
  userEmail?: string;
  relatedLogsCount?: number;
}

/**
 * 日誌查詢結果
 */
export interface LogQueryResult {
  /** 日誌列表 */
  logs: LogEntry[];
  /** 總筆數 */
  total: number;
  /** 是否還有更多資料 */
  hasMore: boolean;
}

// ============================================================
// Log Statistics Types
// ============================================================

/**
 * 日誌統計資料
 */
export interface LogStats {
  /** 總筆數 */
  totalCount: number;
  /** 依級別統計 */
  byLevel: Record<LogLevel, number>;
  /** 依來源統計 */
  bySource: Record<LogSource, number>;
  /** 錯誤率 (%) */
  errorRate: number;
  /** 平均回應時間 (ms) */
  avgResponseTime: number;
  /** 統計時間範圍 */
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * 日誌趨勢資料點
 */
export interface LogTrendPoint {
  /** 時間點 */
  timestamp: Date;
  /** 總筆數 */
  count: number;
  /** 錯誤數 */
  errorCount: number;
}

// ============================================================
// Log Export Types
// ============================================================

/**
 * 日誌匯出請求
 */
export interface LogExportRequest {
  /** 篩選條件 */
  filters: LogQueryFilters;
  /** 匯出格式 */
  format: LogExportFormat;
  /** 最大筆數 (預設: 10000) */
  maxRecords?: number;
}

/**
 * 匯出狀態
 */
export interface ExportStatusResponse {
  /** 匯出 ID */
  id: string;
  /** 狀態 */
  status: LogExportStatus;
  /** 匯出格式 */
  format: LogExportFormat;
  /** 已匯出筆數 */
  exportedCount?: number;
  /** 檔案大小 (bytes) */
  fileSize?: number;
  /** 下載 URL */
  downloadUrl?: string;
  /** 錯誤訊息 */
  errorMessage?: string;
  /** 錯誤訊息（別名） */
  error?: string;
  /** 建立時間 */
  createdAt: Date;
  /** 完成時間 */
  completedAt?: Date;
  /** 過期時間 */
  expiresAt?: Date;
  /** 檔案路徑 */
  filePath?: string;
  /** 檔案名稱 */
  fileName?: string;
  /** 匯出進度 (0-100) */
  progress?: number;
  /** 總記錄數 */
  totalRecords?: number;
  /** 已處理記錄數 */
  processedRecords?: number;
}

// ============================================================
// Log Writing Types
// ============================================================

/**
 * 日誌寫入選項
 */
export interface LogWriteOptions {
  /** 日誌級別 */
  level: LogLevel;
  /** 來源 */
  source: LogSource;
  /** 訊息 */
  message: string;
  /** 額外詳情 */
  details?: Record<string, unknown>;
  /** 錯誤物件 */
  error?: Error;
  /** 類別名稱 */
  className?: string;
  /** 方法名稱 */
  methodName?: string;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 執行時間 (ms) */
  duration?: number;
  /** 記憶體使用 (MB) */
  memoryUsage?: number;
  /** API 端點 */
  endpoint?: string;
}

/**
 * 請求上下文（用於日誌追蹤）
 */
export interface LogRequestContext {
  /** 關聯 ID（跨服務追蹤） */
  correlationId: string;
  /** 請求 ID（單一請求） */
  requestId: string;
  /** 用戶 ID */
  userId?: string;
  /** 工作階段 ID */
  sessionId?: string;
  /** IP 地址 */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

// ============================================================
// Log Retention Types
// ============================================================

/**
 * 日誌保留策略
 */
export interface LogRetentionPolicyData {
  id: string;
  level: LogLevel;
  retentionDays: number;
  archiveEnabled: boolean;
  autoCleanup: boolean;
  lastCleanupAt?: Date;
  recordsCleaned: number;
}

/**
 * 清理結果
 */
export interface LogCleanupResult {
  /** 清理的筆數 */
  deletedCount: number;
  /** 各級別清理數量 */
  byLevel: Record<LogLevel, number>;
  /** 清理時間 */
  cleanedAt: Date;
}

// ============================================================
// SSE Streaming Types
// ============================================================

/**
 * 串流篩選條件
 */
export interface StreamFilters {
  /** 日誌級別篩選 */
  levels?: LogLevel[];
  /** 來源篩選 */
  sources?: LogSource[];
}

/**
 * 串流事件資料
 */
export interface StreamLogEvent {
  /** 事件類型 */
  type: 'log' | 'heartbeat' | 'error';
  /** 日誌資料 (type=log 時) */
  data?: LogEntry;
  /** 錯誤訊息 (type=error 時) */
  error?: string;
  /** 時間戳 */
  timestamp: Date;
}

// ============================================================
// API Request/Response Types
// ============================================================

/**
 * 日誌列表 API 請求參數
 */
export interface LogListParams {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  levels?: string;
  sources?: string;
  keyword?: string;
  userId?: string;
  correlationId?: string;
  orderBy?: 'asc' | 'desc';
}

/**
 * 日誌列表 API 回應
 */
export interface LogListResponse {
  success: true;
  data: LogEntry[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * 日誌詳情 API 回應
 */
export interface LogDetailResponse {
  success: true;
  data: LogDetail;
}

/**
 * 關聯日誌 API 回應
 */
export interface RelatedLogsResponse {
  success: true;
  data: LogEntry[];
}

/**
 * 日誌統計 API 回應
 */
export interface LogStatsResponse {
  success: true;
  data: LogStats;
}

/**
 * 匯出建立 API 回應
 */
export interface ExportCreateResponse {
  success: true;
  data: {
    exportId: string;
    status: LogExportStatus;
  };
}

// ============================================================
// Zod Validation Schemas
// ============================================================

/**
 * 日誌查詢篩選條件驗證 schema（用於 API 路由）
 */
export const LogQueryFiltersSchema = z.object({
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }).optional(),
  levels: z.array(z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'])).optional(),
  sources: z.array(z.enum(['WEB', 'API', 'AI', 'DATABASE', 'N8N', 'SCHEDULER', 'BACKGROUND', 'SYSTEM'])).optional(),
  keyword: z.string().max(200).optional(),
  correlationId: z.string().max(100).optional(),
  userId: z.string().optional(),
  errorCode: z.string().optional(),
  endpoint: z.string().optional(),
});

/**
 * 日誌查詢參數驗證 schema
 */
export const logQueryParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(100),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  levels: z.string().optional().transform((val) =>
    val ? val.split(',').filter(Boolean) as LogLevel[] : undefined
  ),
  sources: z.string().optional().transform((val) =>
    val ? val.split(',').filter(Boolean) as LogSource[] : undefined
  ),
  keyword: z.string().max(200).optional(),
  userId: z.string().cuid().optional(),
  correlationId: z.string().max(100).optional(),
  orderBy: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * 匯出請求驗證 schema
 */
export const logExportRequestSchema = z.object({
  format: z.enum(['CSV', 'JSON', 'TXT']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  levels: z.array(z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'])).optional(),
  sources: z.array(z.enum(['WEB', 'API', 'AI', 'DATABASE', 'N8N', 'SCHEDULER', 'BACKGROUND', 'SYSTEM'])).optional(),
  keyword: z.string().max(200).optional(),
  maxRecords: z.number().int().min(1).max(10000).optional().default(10000),
});

/**
 * 串流篩選參數驗證 schema
 */
export const streamFiltersSchema = z.object({
  levels: z.string().optional().transform((val) =>
    val ? val.split(',').filter(Boolean) as LogLevel[] : undefined
  ),
  sources: z.string().optional().transform((val) =>
    val ? val.split(',').filter(Boolean) as LogSource[] : undefined
  ),
});

// ============================================================
// Constants
// ============================================================

/**
 * 日誌級別配置
 */
export const LOG_LEVEL_CONFIG: Record<LogLevel, {
  label: string;
  color: string;
  bgColor: string;
  priority: number;
}> = {
  DEBUG: { label: '除錯', color: 'text-gray-500', bgColor: 'bg-gray-100', priority: 0 },
  INFO: { label: '資訊', color: 'text-blue-600', bgColor: 'bg-blue-100', priority: 1 },
  WARN: { label: '警告', color: 'text-yellow-600', bgColor: 'bg-yellow-100', priority: 2 },
  ERROR: { label: '錯誤', color: 'text-red-600', bgColor: 'bg-red-100', priority: 3 },
  CRITICAL: { label: '嚴重', color: 'text-red-800', bgColor: 'bg-red-200', priority: 4 },
};

/**
 * 日誌來源配置
 */
export const LOG_SOURCE_CONFIG: Record<LogSource, {
  label: string;
  icon: string;
}> = {
  WEB: { label: 'Web 應用', icon: 'Globe' },
  API: { label: 'API 服務', icon: 'Webhook' },
  AI: { label: 'AI 服務', icon: 'Brain' },
  DATABASE: { label: '資料庫', icon: 'Database' },
  N8N: { label: 'n8n 工作流', icon: 'Workflow' },
  SCHEDULER: { label: '排程任務', icon: 'Clock' },
  BACKGROUND: { label: '背景任務', icon: 'Loader' },
  SYSTEM: { label: '系統', icon: 'Server' },
};

/**
 * 預設保留天數配置
 */
export const LOG_DEFAULT_RETENTION_DAYS: Record<LogLevel, number> = {
  DEBUG: 7,
  INFO: 30,
  WARN: 60,
  ERROR: 90,
  CRITICAL: 180,
};

/**
 * 匯出最大筆數
 */
export const MAX_EXPORT_RECORDS = 10000;

/**
 * 每頁預設筆數
 */
export const LOG_DEFAULT_PAGE_SIZE = 100;

/**
 * 每頁最大筆數
 */
export const MAX_PAGE_SIZE = 1000;

/**
 * SSE 心跳間隔 (毫秒)
 */
export const SSE_HEARTBEAT_INTERVAL = 30000;

/**
 * 匯出檔案過期時間 (小時)
 */
export const EXPORT_FILE_EXPIRY_HOURS = 24;
