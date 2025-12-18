/**
 * @fileoverview 審核工作流相關類型定義
 * @description
 *   定義審核隊列 API 的請求/響應類型，包含：
 *   - ReviewQueueItem: 單個審核項目的完整資訊
 *   - ReviewQueueResponse: API 響應格式
 *   - ReviewQueueFilters: 篩選參數
 *
 * @module src/types/review
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 */

import { ProcessingPath, QueueStatus } from '@prisma/client'

// ============================================================
// API Response Types
// ============================================================

/**
 * 審核隊列項目
 * 包含文件基本資訊、Forwarder、處理路徑和信心度
 */
export interface ReviewQueueItem {
  /** 處理隊列 ID */
  id: string
  /** 文件資訊 */
  document: {
    /** 文件 ID */
    id: string
    /** 文件名稱 */
    fileName: string
    /** 建立時間 (ISO 8601) */
    createdAt: string
  }
  /** Forwarder 資訊 */
  forwarder: {
    /** Forwarder ID */
    id: string
    /** Forwarder 名稱 */
    name: string
    /** Forwarder 代碼 */
    code: string
  } | null
  /** 處理路徑 */
  processingPath: ProcessingPath
  /** 整體信心度 (0-100) */
  overallConfidence: number
  /** 優先級 (數字越大越優先) */
  priority: number
  /** 隊列狀態 */
  status: QueueStatus
  /** 路由原因 */
  routingReason: string | null
}

/**
 * 審核隊列 API 成功響應
 */
export interface ReviewQueueResponse {
  success: true
  data: ReviewQueueItem[]
  meta: {
    /** 總筆數 */
    total: number
    /** 當前頁碼 */
    page: number
    /** 每頁筆數 */
    pageSize: number
    /** 總頁數 */
    totalPages: number
  }
}

/**
 * 審核隊列 API 錯誤響應 (RFC 7807)
 */
export interface ReviewQueueErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
    instance?: string
  }
}

// ============================================================
// Filter Types
// ============================================================

/**
 * 審核隊列篩選參數
 */
export interface ReviewQueueFilters {
  /** Forwarder ID */
  forwarderId?: string
  /** 處理路徑 */
  processingPath?: ProcessingPath
  /** 最低信心度 (0-100) */
  minConfidence?: number
  /** 最高信心度 (0-100) */
  maxConfidence?: number
}

/**
 * 審核隊列查詢參數（包含分頁）
 */
export interface ReviewQueueParams extends ReviewQueueFilters {
  /** 頁碼 (從 1 開始) */
  page?: number
  /** 每頁筆數 */
  pageSize?: number
}

// ============================================================
// Statistics Types
// ============================================================

/**
 * 審核隊列統計資訊
 */
export interface ReviewQueueStats {
  /** 待審核總數 */
  totalPending: number
  /** 快速審核數量 */
  quickReviewCount: number
  /** 完整審核數量 */
  fullReviewCount: number
  /** 高優先級數量 */
  highPriorityCount: number
}

// ============================================================
// Story 3-2: Review Detail Types
// ============================================================

/**
 * 欄位來源位置（PDF 座標）
 * @description 定義欄位在 PDF 中的位置，使用百分比座標（0-1）
 */
export interface FieldSourcePosition {
  /** 頁碼 (1-indexed) */
  page: number
  /** X 座標 (百分比 0-1) */
  x: number
  /** Y 座標 (百分比 0-1) */
  y: number
  /** 寬度 (百分比 0-1) */
  width: number
  /** 高度 (百分比 0-1) */
  height: number
}

/**
 * 映射來源類型
 */
export type MappingSource = 'UNIVERSAL' | 'FORWARDER' | 'LLM' | null

/**
 * 提取欄位結果
 * @description 單個提取欄位的完整資訊
 */
export interface ExtractedField {
  /** 欄位 ID */
  id: string
  /** 欄位名稱（技術名稱） */
  fieldName: string
  /** 欄位分組 */
  fieldGroup: string
  /** 提取值 */
  value: string | null
  /** 信心度 (0-100) */
  confidence: number
  /** PDF 來源位置 */
  sourcePosition: FieldSourcePosition | null
  /** 映射來源 */
  mappingSource: MappingSource
}

/**
 * 欄位分組資料
 */
export interface FieldGroupData {
  /** 分組名稱（技術名稱） */
  groupName: string
  /** 分組顯示名稱 */
  displayName: string
  /** 分組內的欄位 */
  fields: ExtractedField[]
  /** 是否展開 */
  isExpanded: boolean
}

/**
 * 審核詳情資料
 * @description GET /api/review/[id] 響應的資料結構
 */
export interface ReviewDetailData {
  /** 文件資訊 */
  document: {
    /** 文件 ID */
    id: string
    /** 文件名稱 */
    fileName: string
    /** 文件 URL */
    fileUrl: string
    /** MIME 類型 */
    mimeType: string
    /** 頁數 */
    pageCount: number
    /** 建立時間 (ISO 8601) */
    createdAt: string
  }
  /** Forwarder 資訊 */
  forwarder: {
    id: string
    name: string
    code: string
  } | null
  /** 處理隊列資訊 */
  processingQueue: {
    id: string
    processingPath: ProcessingPath
    overallConfidence: number
    status: QueueStatus
  } | null
  /** 提取結果 */
  extraction: {
    id: string
    overallConfidence: number
    fields: ExtractedField[]
  }
}

/**
 * 審核詳情 API 成功響應
 */
export interface ReviewDetailResponse {
  success: true
  data: ReviewDetailData
}

/**
 * 審核詳情 API 錯誤響應
 */
export interface ReviewDetailErrorResponse {
  success: false
  error: {
    type: string
    title: string
    status: number
    detail: string
    instance?: string
  }
}

// ============================================================
// Story 3-4: Approve Review Types
// ============================================================

/**
 * 審核動作類型
 */
export type ReviewAction = 'APPROVED' | 'CORRECTED' | 'ESCALATED'

/**
 * 確認審核請求
 * @description POST /api/review/[id]/approve 請求體
 */
export interface ApproveRequest {
  /** 確認的欄位名稱列表 */
  confirmedFields?: string[]
  /** 審核備註 */
  notes?: string
  /** 審核開始時間（ISO 8601 格式） */
  reviewStartedAt?: string
}

/**
 * 確認審核成功響應
 */
export interface ApproveResponse {
  success: true
  data: {
    /** 文件 ID */
    documentId: string
    /** 更新後的狀態 */
    status: 'APPROVED'
    /** 審核者 ID */
    reviewedBy: string
    /** 審核完成時間 (ISO 8601) */
    reviewedAt: string
    /** 審核記錄 ID */
    reviewRecordId: string
  }
}

/**
 * 確認審核錯誤響應
 */
export interface ApproveErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  errors?: Record<string, string[]>
}

/**
 * 審核記錄類型
 * @description 對應 ReviewRecord Prisma 模型
 */
export interface ReviewRecordData {
  /** 記錄 ID */
  id: string
  /** 文件 ID */
  documentId: string
  /** 審核者 ID */
  reviewerId: string
  /** 審核動作 */
  action: ReviewAction
  /** 處理路徑 */
  processingPath: ProcessingPath
  /** 確認的欄位 */
  confirmedFields: string[]
  /** 修改的欄位 */
  modifiedFields: Record<string, { before: unknown; after: unknown }> | null
  /** 審核備註 */
  notes: string | null
  /** 審核時長（秒） */
  reviewDuration: number | null
  /** 開始時間 */
  startedAt: string | null
  /** 完成時間 */
  completedAt: string
  /** 建立時間 */
  createdAt: string
}

// ============================================================
// Story 3-5: Correction Types
// ============================================================

/**
 * 修正類型
 */
export type CorrectionType = 'NORMAL' | 'EXCEPTION'

/**
 * 單個修正輸入
 */
export interface CorrectionInput {
  /** 欄位 ID */
  fieldId: string
  /** 欄位名稱 */
  fieldName: string
  /** 原始值 */
  originalValue: string | null
  /** 修正後的值 */
  correctedValue: string
  /** 修正類型 */
  correctionType: CorrectionType
}

/**
 * 修正請求
 * @description PATCH /api/review/[id]/correct 請求體
 */
export interface CorrectRequest {
  /** 修正列表 */
  corrections: CorrectionInput[]
}

/**
 * 修正成功響應
 */
export interface CorrectResponse {
  success: true
  data: {
    /** 文件 ID */
    documentId: string
    /** 修正數量 */
    correctionCount: number
    /** 修正記錄列表 */
    corrections: {
      /** 記錄 ID */
      id: string
      /** 欄位名稱 */
      fieldName: string
      /** 修正後的值 */
      correctedValue: string
      /** 修正類型 */
      correctionType: CorrectionType
    }[]
  }
}

/**
 * 修正錯誤響應
 */
export interface CorrectErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  errors?: Record<string, string[]>
}

/**
 * 欄位編輯狀態
 * @description 用於追蹤單個欄位的編輯狀態
 */
export interface FieldEditState {
  /** 欄位 ID */
  fieldId: string
  /** 欄位名稱 */
  fieldName: string
  /** 原始值 */
  originalValue: string | null
  /** 當前值 */
  currentValue: string
  /** 是否正在編輯 */
  isEditing: boolean
  /** 是否已修改 */
  isDirty: boolean
  /** 驗證錯誤 */
  validationError: string | null
}

/**
 * 待儲存的修正
 * @description 用於批量提交修正
 */
export interface PendingCorrection {
  /** 欄位 ID */
  fieldId: string
  /** 欄位名稱 */
  fieldName: string
  /** 原始值 */
  originalValue: string | null
  /** 新值 */
  newValue: string
}
