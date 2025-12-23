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
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 */

import { ProcessingPath, QueueStatus } from '@prisma/client'

// ============================================================
// API Response Types
// ============================================================

/**
 * 審核隊列項目
 * 包含文件基本資訊、Company (REFACTOR-001: 原 Forwarder)、處理路徑和信心度
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
  /** Company 資訊 (REFACTOR-001: 原 forwarder) */
  company: {
    /** Company ID */
    id: string
    /** Company 名稱 */
    name: string
    /** Company 代碼 (可為 null) */
    code: string | null
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
  /** Company ID (REFACTOR-001: 原 forwarderId) */
  companyId?: string
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
 * REFACTOR-001: FORWARDER → COMPANY
 */
export type MappingSource = 'UNIVERSAL' | 'COMPANY' | 'LLM' | null

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
  /** Company 資訊 (REFACTOR-001: 原 forwarder) */
  company: {
    id: string
    name: string
    code: string | null
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

// ============================================================
// Story 4-6: Rule Suggestion Review Types
// ============================================================

/**
 * 規則審核拒絕原因枚舉
 * @description 用於規則建議審核的拒絕原因分類
 */
export type RejectionReason =
  | 'INSUFFICIENT_DATA'
  | 'POOR_ACCURACY'
  | 'HIGH_RISK'
  | 'DUPLICATE'
  | 'NOT_APPLICABLE'
  | 'OTHER'

/**
 * 拒絕原因配置
 */
export interface RejectionReasonConfig {
  value: RejectionReason
  label: string
  description: string
}

/**
 * 拒絕原因配置列表
 */
export const REJECTION_REASONS: RejectionReasonConfig[] = [
  {
    value: 'INSUFFICIENT_DATA',
    label: '數據不足',
    description: '樣本數量不足以驗證規則的有效性',
  },
  {
    value: 'POOR_ACCURACY',
    label: '準確率不佳',
    description: '模擬測試顯示規則準確率未達標準',
  },
  {
    value: 'HIGH_RISK',
    label: '風險過高',
    description: '影響分析顯示潛在風險過高',
  },
  {
    value: 'DUPLICATE',
    label: '重複規則',
    description: '已存在功能相同或類似的規則',
  },
  {
    value: 'NOT_APPLICABLE',
    label: '不適用',
    description: '規則不適用於目標場景',
  },
  {
    value: 'OTHER',
    label: '其他',
    description: '其他原因（請在詳細說明中說明）',
  },
]

/**
 * 規則批准請求
 * @description POST /api/rules/suggestions/[id]/approve 請求體
 */
export interface RuleApproveRequest {
  /** 審核備註（選填） */
  notes?: string
  /** 生效日期（選填，ISO 8601 格式） */
  effectiveDate?: string
}

/**
 * 規則批准響應
 */
export interface RuleApproveResponse {
  success: true
  data: {
    /** 建議 ID */
    suggestionId: string
    /** 創建的規則 ID */
    ruleId: string
    /** 規則版本 */
    ruleVersion: number
    /** 狀態 */
    status: 'APPROVED' | 'IMPLEMENTED'
    /** 訊息 */
    message: string
  }
}

/**
 * 規則拒絕請求
 * @description POST /api/rules/suggestions/[id]/reject 請求體
 */
export interface RuleRejectRequest {
  /** 拒絕原因 */
  reason: RejectionReason
  /** 詳細說明（必填） */
  reasonDetail: string
}

/**
 * 規則拒絕響應
 */
export interface RuleRejectResponse {
  success: true
  data: {
    /** 建議 ID */
    suggestionId: string
    /** 狀態 */
    status: 'REJECTED'
    /** 訊息 */
    message: string
  }
}

/**
 * 規則審核歷史項目
 */
export interface RuleReviewHistoryItem {
  /** 記錄 ID */
  id: string
  /** 建議 ID */
  suggestionId: string
  /** 審核動作 */
  action: 'APPROVED' | 'REJECTED'
  /** 審核者 */
  reviewer: {
    id: string
    name: string
  }
  /** 審核時間 (ISO 8601) */
  reviewedAt: string
  /** 審核備註 */
  notes?: string
  /** 拒絕原因 */
  rejectionReason?: RejectionReason
  /** 拒絕詳細說明 */
  rejectionDetail?: string
}

/**
 * 規則審核列表項目
 * @description 待審核規則建議列表項目
 */
export interface RuleReviewListItem {
  /** 建議 ID */
  id: string
  /** Company 資訊 (REFACTOR-001: 原 forwarder) */
  company: {
    id: string
    name: string
    code: string | null
  }
  /** 欄位名稱 */
  fieldName: string
  /** 提取類型 */
  extractionType: string
  /** 建議來源 */
  source: 'AUTO_LEARNING' | 'MANUAL' | 'IMPORT'
  /** 修正次數 */
  correctionCount: number
  /** 信心度 (0-100) */
  confidence: number
  /** 優先級 */
  priority: number
  /** 創建時間 (ISO 8601) */
  createdAt: string
  /** 是否有現有規則 */
  hasExistingRule: boolean
  /** 影響摘要 */
  impactSummary: {
    /** 受影響總數 */
    totalAffected: number
    /** 改善率 (百分比) */
    improvementRate: number
    /** 惡化率 (百分比) */
    regressionRate: number
  } | null
}

/**
 * 規則審核列表響應
 */
export interface RuleReviewListResponse {
  success: true
  data: {
    items: RuleReviewListItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  }
}

/**
 * 根據拒絕原因值獲取配置
 */
export function getRejectionReasonConfig(
  reason: RejectionReason
): RejectionReasonConfig | undefined {
  return REJECTION_REASONS.find((r) => r.value === reason)
}
