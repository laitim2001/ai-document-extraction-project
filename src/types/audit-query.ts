/**
 * @fileoverview 審計查詢類型定義
 * @description
 *   定義審計查詢功能所需的類型：
 *   - AuditQueryParams: 查詢參數
 *   - AuditQueryResult: 查詢結果
 *   - ProcessingRecord: 處理記錄
 *
 * @module src/types/audit-query
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 多條件篩選參數
 *   - 分頁與排序支援
 *   - 大量結果處理機制
 *   - 權限控制常數
 *
 * @related
 *   - src/services/audit-query.service.ts - 審計查詢服務
 *   - src/app/api/audit/query/route.ts - 審計查詢 API
 *   - src/components/audit/AuditQueryForm.tsx - 查詢表單組件
 */

import { z } from 'zod'

// ============================================================
// Constants
// ============================================================

/**
 * 最大查詢結果筆數
 * 超過此數量時會返回截斷警告
 */
export const MAX_QUERY_RESULTS = 10000

/**
 * 預設每頁筆數
 */
export const DEFAULT_PAGE_SIZE = 50

/**
 * 查詢超時時間（毫秒）
 */
export const QUERY_TIMEOUT_MS = 30000

// ============================================================
// Query Parameter Types
// ============================================================

/**
 * 審計查詢參數
 *
 * @description
 *   支援多條件篩選、分頁與排序的查詢參數
 */
export interface AuditQueryParams {
  /** 開始日期（必填，ISO 8601 格式） */
  startDate: string
  /** 結束日期（必填，ISO 8601 格式） */
  endDate: string

  /** 城市代碼過濾（選填） */
  cityCodes?: string[]
  /** Forwarder ID 過濾（選填） */
  forwarderIds?: string[]
  /** 處理狀態過濾（選填） */
  statuses?: string[]
  /** 操作人員 ID 過濾（選填） */
  operatorIds?: string[]
  /** 資源類型過濾（選填） */
  resourceTypes?: string[]
  /** 操作類型過濾（選填） */
  actions?: string[]

  /** 搜尋關鍵字（選填，支援發票號碼、文件ID、Forwarder 代碼） */
  searchTerm?: string

  /** 頁碼（從 1 開始，預設 1） */
  page?: number
  /** 每頁筆數（預設 50） */
  pageSize?: number

  /** 排序欄位 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 審計查詢參數 Zod Schema
 */
export const auditQueryParamsSchema = z.object({
  startDate: z.string().datetime({ message: '開始日期格式無效' }),
  endDate: z.string().datetime({ message: '結束日期格式無效' }),
  cityCodes: z.array(z.string()).optional(),
  forwarderIds: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  operatorIds: z.array(z.string()).optional(),
  resourceTypes: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  searchTerm: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(DEFAULT_PAGE_SIZE),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
}).refine(
  data => new Date(data.endDate) >= new Date(data.startDate),
  { message: '結束日期必須晚於或等於開始日期', path: ['endDate'] }
)

// ============================================================
// Result Types
// ============================================================

/**
 * 審計查詢結果
 *
 * @description
 *   包含查詢結果記錄、分頁資訊和查詢狀態
 */
export interface AuditQueryResult {
  /** 處理記錄列表 */
  records: ProcessingRecord[]
  /** 總記錄數 */
  total: number
  /** 當前頁碼 */
  page: number
  /** 每頁筆數 */
  pageSize: number
  /** 總頁數 */
  totalPages: number
  /** 查詢耗時（毫秒） */
  queryTime: number
  /** 是否因超過限制而被截斷 */
  isTruncated: boolean
}

/**
 * 處理記錄
 *
 * @description
 *   單筆文件處理記錄的詳細資訊
 */
export interface ProcessingRecord {
  /** 記錄 ID */
  id: string
  /** 文件 ID */
  documentId: string
  /** 發票號碼（從提取結果獲取） */
  invoiceNumber?: string
  /** Forwarder 代碼 */
  forwarderCode: string
  /** Forwarder 名稱 */
  forwarderName: string
  /** 城市代碼 */
  cityCode: string
  /** 城市名稱 */
  cityName: string
  /** 處理狀態 */
  status: string
  /** 處理類型：自動或人工 */
  processingType: 'AUTO' | 'MANUAL'
  /** 處理人員 ID */
  processedBy?: string
  /** 處理人員名稱 */
  processedByName?: string
  /** 處理完成時間 */
  processedAt?: string
  /** 建立時間 */
  createdAt: string
  /** AI 處理成本（美元） */
  aiCost?: number
  /** 審核耗時（秒） */
  reviewDuration?: number
  /** 修正次數 */
  corrections: number
  /** 是否已升級 */
  escalated: boolean
}

/**
 * 結果計數預覽
 */
export interface CountPreview {
  /** 結果筆數 */
  count: number
  /** 是否超過限制 */
  exceedsLimit: boolean
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 審計查詢 API 成功響應
 */
export interface AuditQueryResponse {
  success: true
  data: AuditQueryResult
}

/**
 * 結果計數 API 成功響應
 */
export interface CountPreviewResponse {
  success: true
  data: CountPreview
}

/**
 * 審計查詢 API 錯誤響應
 */
export interface AuditQueryErrorResponse {
  success: false
  error: string
  details?: Record<string, string[]>
}

// ============================================================
// Form Types
// ============================================================

/**
 * 查詢表單值類型
 */
export interface AuditQueryFormValues {
  startDate: Date
  endDate: Date
  cityCodes?: string[]
  forwarderIds?: string[]
  statuses?: string[]
  operatorIds?: string[]
}

/**
 * 查詢表單 Zod Schema
 */
export const auditQueryFormSchema = z.object({
  startDate: z.date({ message: '請選擇開始日期' }),
  endDate: z.date({ message: '請選擇結束日期' }),
  cityCodes: z.array(z.string()).optional(),
  forwarderIds: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  operatorIds: z.array(z.string()).optional()
}).refine(
  data => data.endDate >= data.startDate,
  { message: '結束日期必須晚於開始日期', path: ['endDate'] }
)

// ============================================================
// Constants for UI
// ============================================================

/**
 * 狀態選項（用於查詢表單）
 */
export const STATUS_OPTIONS = [
  { value: 'PENDING', label: '待處理' },
  { value: 'PROCESSING', label: '處理中' },
  { value: 'PENDING_REVIEW', label: '待審核' },
  { value: 'APPROVED', label: '已核准' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'FAILED', label: '失敗' },
  { value: 'ESCALATED', label: '已升級' }
] as const

/**
 * 狀態 Badge 樣式映射
 */
export const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  PROCESSING: 'secondary',
  PENDING_REVIEW: 'secondary',
  APPROVED: 'default',
  COMPLETED: 'default',
  FAILED: 'destructive',
  ESCALATED: 'destructive'
}
