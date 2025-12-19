/**
 * @fileoverview 報表匯出相關類型定義
 * @description
 *   定義費用報表匯出功能所需的所有類型：
 *   - 匯出欄位類型和標籤
 *   - 匯出配置介面
 *   - 任務狀態類型
 *   - API 響應類型
 *   - 相關常數定義
 *
 * @module src/types/report-export
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 */

/**
 * 可匯出的欄位
 */
export type ExportField =
  | 'invoiceNumber'
  | 'uploadTime'
  | 'processedTime'
  | 'forwarderCode'
  | 'forwarderName'
  | 'aiCost'
  | 'reviewDuration'
  | 'status'
  | 'cityCode'
  | 'processingType'
  | 'confidenceScore'

/**
 * 匯出欄位標籤
 */
export const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  invoiceNumber: '發票編號',
  uploadTime: '上傳時間',
  processedTime: '處理時間',
  forwarderCode: 'Forwarder 代碼',
  forwarderName: 'Forwarder 名稱',
  aiCost: 'AI 成本',
  reviewDuration: '審核時長',
  status: '狀態',
  cityCode: '城市代碼',
  processingType: '處理類型',
  confidenceScore: '信心分數'
}

/**
 * 預設匯出欄位
 */
export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  'invoiceNumber',
  'uploadTime',
  'processedTime',
  'forwarderCode',
  'forwarderName',
  'aiCost',
  'reviewDuration'
]

/**
 * 匯出格式
 */
export type ExportFormat = 'xlsx' | 'csv'

/**
 * 匯出配置
 */
export interface ExportConfig {
  /** 日期範圍 */
  dateRange: {
    startDate: string
    endDate: string
  }
  /** 匯出格式 */
  format: ExportFormat
  /** 選擇的欄位 */
  fields: ExportField[]
  /** 篩選的 Forwarder IDs */
  forwarderIds?: string[]
  /** 篩選的城市代碼 */
  cityCodes?: string[]
}

/**
 * 報表任務狀態
 */
export type ReportJobStatusType = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

/**
 * 報表任務詳情
 */
export interface ExportJobStatus {
  /** 任務 ID */
  id: string
  /** 任務狀態 */
  status: ReportJobStatusType
  /** 處理進度 (0-100) */
  progress?: number
  /** 總記錄數 */
  totalRecords?: number
  /** 下載 URL */
  downloadUrl?: string
  /** 下載連結過期時間 */
  expiresAt?: string
  /** 錯誤訊息 */
  error?: string
  /** 建立時間 */
  createdAt: string
  /** 完成時間 */
  completedAt?: string
}

/**
 * 匯出 API 響應
 */
export interface ExportResponse {
  success: boolean
  data?: {
    mode: 'direct' | 'background'
    jobId?: string
    estimatedCount?: number
    message?: string
  }
  error?: string
}

/**
 * 大量匯出閾值
 */
export const LARGE_EXPORT_THRESHOLD = 10000

/**
 * 下載連結有效期（小時）
 */
export const DOWNLOAD_LINK_EXPIRY_HOURS = 24
