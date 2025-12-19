/**
 * @fileoverview 城市處理量統計類型定義
 * @description
 *   - 處理結果類型定義
 *   - 統計數據結構
 *   - API 請求/回應類型
 *   - 校驗結果類型
 *
 * @module src/types/processing-statistics
 * @since Epic 7 - Story 7.7
 * @lastModified 2025-12-19
 */

// ============================================================
// Core Enums and Types
// ============================================================

/**
 * 處理結果類型
 */
export type ProcessingResultType =
  | 'AUTO_APPROVED'    // 自動通過
  | 'MANUAL_REVIEWED'  // 人工審核通過
  | 'ESCALATED'        // 升級處理
  | 'FAILED';          // 處理失敗

/**
 * 時間聚合粒度
 */
export type TimeGranularity = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * 審計類型
 */
export type AuditType = 'SCHEDULED' | 'MANUAL' | 'AUTO_REPAIR';

// ============================================================
// Data Interfaces
// ============================================================

/**
 * 單日處理統計
 */
export interface DailyProcessingStats {
  cityCode: string;
  date: string;  // ISO date string YYYY-MM-DD
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  totalProcessingTime: number;  // seconds
  avgProcessingTime: number | null;
  minProcessingTime: number | null;
  maxProcessingTime: number | null;
  successCount: number;
  successRate: number | null;
  automationRate: number | null;
  lastUpdatedAt: string;
}

/**
 * 每小時處理統計
 */
export interface HourlyStats {
  hour: string;  // ISO datetime string
  cityCode: string;
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  totalProcessingTime: number;
}

/**
 * 聚合統計結果
 */
export interface AggregatedStats {
  period: string;  // 日期或期間標識 (YYYY-MM-DD, YYYY-WW, YYYY-MM, YYYY)
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  avgProcessingTime: number;
  successRate: number;       // 0-100
  automationRate: number;    // 0-100
  // 計算欄位
  successCount?: number;
  failedRate?: number;
  manualRate?: number;
}

/**
 * 城市統計匯總
 */
export interface CityStatsSummary {
  cityCode: string;
  cityName: string;
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  avgProcessingTime: number;
  successRate: number;
  automationRate: number;
  trend: {
    processedChange: number;  // 百分比
    automationChange: number;
  };
}

/**
 * 即時統計數據
 */
export interface RealtimeStats {
  todayStats: DailyProcessingStats | null;
  hourlyTrend: {
    hour: string;
    count: number;
  }[];
  liveQueue?: {
    pending: number;
    processing: number;
  };
}

// ============================================================
// Query Parameters
// ============================================================

/**
 * 統計查詢參數
 */
export interface StatsQueryParams {
  startDate: string;
  endDate: string;
  granularity: TimeGranularity;
  cityCodes?: string[];
  forwarderCodes?: string[];
}

/**
 * 城市匯總查詢參數
 */
export interface CitySummaryQueryParams {
  startDate: string;
  endDate: string;
}

// ============================================================
// Event Types
// ============================================================

/**
 * 處理結果記錄事件
 * 當文件處理完成時觸發
 */
export interface ProcessingResultEvent {
  documentId: string;
  cityCode: string;
  forwarderCode: string;
  status: string;
  autoApproved: boolean;
  processingDurationSeconds: number;
  processedAt: Date;
}

// ============================================================
// Reconciliation Types
// ============================================================

/**
 * 統計差異
 */
export interface StatDiscrepancy {
  field: string;
  expected: number;
  actual: number;
  difference: number;
}

/**
 * 校驗結果
 */
export interface ReconciliationResult {
  verified: boolean;
  discrepancies: StatDiscrepancy[];
  corrected: boolean;
  auditLogId: string;
}

/**
 * 校驗請求參數
 */
export interface ReconciliationRequest {
  cityCode: string;
  date: string;  // ISO date string
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 聚合統計 API 回應
 */
export interface AggregatedStatsResponse {
  success: boolean;
  data: AggregatedStats[];
  meta: {
    granularity: string;
    startDate: string;
    endDate: string;
    totalDataPoints: number;
    cacheHit: boolean;
  };
}

/**
 * 城市統計匯總 API 回應
 */
export interface CityStatsSummaryResponse {
  success: boolean;
  data: CityStatsSummary[];
  meta: {
    period: string;
    cityCount: number;
  };
}

/**
 * 即時統計 API 回應
 */
export interface RealtimeStatsResponse {
  success: boolean;
  data: RealtimeStats;
}

/**
 * 校驗結果 API 回應
 */
export interface ReconciliationResponse {
  success: boolean;
  data: ReconciliationResult;
}

// ============================================================
// Service Internal Types
// ============================================================

/**
 * 統計更新數據（內部使用）
 */
export interface StatsUpdateData {
  resultType: ProcessingResultType;
  processingTimeSeconds: number;
}

/**
 * 快取配置
 */
export interface StatsCacheConfig {
  key: string;
  ttl: number;  // milliseconds
  tags: string[];
}

/**
 * 處理計數（用於計算統計）
 */
export interface ProcessingCounts {
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  totalProcessingTime: number;
  successCount: number;
}
