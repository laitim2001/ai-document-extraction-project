/**
 * @fileoverview 規則升級建議相關類型定義
 * @description
 *   定義規則升級建議系統的所有類型，包括：
 *   - 預期影響分析類型
 *   - 推斷規則類型
 *   - 建議列表與詳情類型
 *   - API 請求/響應類型
 *   - 來源與狀態配置
 *
 * @module src/types/suggestion
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - ExpectedImpact: 預期影響分析結構
 *   - InferredRule: 推斷規則結構
 *   - SuggestionListItem: 建議列表項目
 *   - SuggestionDetail: 建議詳情
 *   - SUGGESTION_SOURCES / SUGGESTION_STATUSES: 配置常量
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的枚舉類型
 */

import { ExtractionType, SuggestionSource, SuggestionStatus } from '@prisma/client'

// ============================================================
// 預期影響類型
// ============================================================

/**
 * 風險項目
 */
export interface RiskItem {
  /** 風險類型 */
  type: 'false_positive' | 'false_negative' | 'format_change' | 'coverage_gap'
  /** 嚴重程度 */
  severity: 'low' | 'medium' | 'high'
  /** 風險描述 */
  description: string
  /** 受影響數量 */
  affectedCount?: number
}

/**
 * 模擬結果摘要
 */
export interface SimulationSummary {
  /** 測試文件數 */
  tested: number
  /** 匹配成功數 */
  matched: number
  /** 改善數 */
  improved: number
  /** 退化數 */
  degraded: number
}

/**
 * 預期影響分析
 */
export interface ExpectedImpact {
  /** 受影響文件數 */
  affectedDocuments: number
  /** 預估準確率提升（百分比） */
  estimatedImprovement: number
  /** 當前準確率（如果有現有規則） */
  currentAccuracy: number | null
  /** 預測準確率 */
  predictedAccuracy: number
  /** 潛在風險列表 */
  potentialRisks: RiskItem[]
  /** 模擬結果摘要 */
  simulationSummary: SimulationSummary
}

// ============================================================
// 推斷規則類型
// ============================================================

/**
 * 推斷的規則
 */
export interface InferredRule {
  /** 規則類型 */
  type: ExtractionType
  /** 規則模式 */
  pattern: string
  /** 信心度 (0-1) */
  confidence: number
  /** 解釋說明 */
  explanation: string
  /** 替代方案 */
  alternatives?: InferredRule[]
}

/**
 * 修正樣本
 */
export interface CorrectionSample {
  /** 原始值 */
  originalValue: string
  /** 修正後的值 */
  correctedValue: string
  /** 上下文資訊 */
  context?: {
    /** 頁碼 */
    pageNumber?: number
    /** 邊界框 */
    boundingBox?: { x: number; y: number; width: number; height: number }
    /** 周圍文字 */
    surroundingText?: string
  }
}

// ============================================================
// 建議列表類型
// ============================================================

/**
 * 建議列表項目
 */
export interface SuggestionListItem {
  /** 建議 ID */
  id: string
  /** Forwarder 資訊 */
  forwarder: {
    id: string
    name: string
    code: string
  }
  /** 欄位名稱 */
  fieldName: string
  /** 提取類型 */
  extractionType: ExtractionType
  /** 建議來源 */
  source: SuggestionSource
  /** 修正次數 */
  correctionCount: number
  /** 建議狀態 */
  status: SuggestionStatus
  /** 信心度 */
  confidence: number
  /** 優先級 */
  priority: number
  /** 建議者 */
  suggestedBy: {
    id: string
    name: string
  } | null
  /** 創建時間 */
  createdAt: string
  /** 是否有現有規則 */
  hasExistingRule: boolean
}

/**
 * 建議列表查詢參數
 */
export interface SuggestionsQueryParams {
  /** Forwarder ID 過濾 */
  forwarderId?: string
  /** 欄位名稱過濾 */
  fieldName?: string
  /** 狀態過濾 */
  status?: SuggestionStatus
  /** 來源過濾 */
  source?: SuggestionSource
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  pageSize?: number
  /** 排序欄位 */
  sortBy?: 'createdAt' | 'correctionCount' | 'confidence' | 'priority'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 建議列表摘要
 */
export interface SuggestionsSummary {
  /** 總建議數 */
  totalSuggestions: number
  /** 待審核建議數 */
  pendingSuggestions: number
  /** 自動學習建議數 */
  autoLearningSuggestions: number
  /** 手動建議數 */
  manualSuggestions: number
}

/**
 * 建議列表分頁資訊
 */
export interface SuggestionsPagination {
  /** 總數 */
  total: number
  /** 當前頁碼 */
  page: number
  /** 每頁數量 */
  pageSize: number
  /** 總頁數 */
  totalPages: number
}

/**
 * 建議列表響應
 */
export interface SuggestionsListResponse {
  success: true
  data: {
    suggestions: SuggestionListItem[]
    pagination: SuggestionsPagination
    summary: SuggestionsSummary
  }
}

// ============================================================
// 建議詳情類型
// ============================================================

/**
 * 建議樣本案例
 */
export interface SuggestionSampleCase {
  /** 樣本 ID */
  id: string
  /** 文件 ID */
  documentId: string
  /** 文件名稱 */
  documentName: string
  /** 原始值 */
  originalValue: string
  /** 修正值 */
  correctedValue: string
  /** 使用建議規則提取的值 */
  extractedValue: string | null
  /** 是否符合預期 */
  matchesExpected: boolean | null
}

/**
 * 建議詳情
 */
export interface SuggestionDetail {
  /** 建議 ID */
  id: string
  /** Forwarder 資訊 */
  forwarder: {
    id: string
    name: string
    code: string
    logoUrl?: string
  }
  /** 欄位名稱 */
  fieldName: string
  /** 提取類型 */
  extractionType: ExtractionType
  /** 現有規則模式 */
  currentPattern: string | null
  /** 建議的規則模式 */
  suggestedPattern: string
  /** 信心度 */
  confidence: number
  /** 來源 */
  source: SuggestionSource
  /** 修正次數 */
  correctionCount: number
  /** 預期影響 */
  expectedImpact: ExpectedImpact | null
  /** 狀態 */
  status: SuggestionStatus
  /** 優先級 */
  priority: number
  /** 建議者 */
  suggestedBy: {
    id: string
    name: string
    email: string
  } | null
  /** 審核者 */
  reviewedBy: {
    id: string
    name: string
    email: string
  } | null
  /** 審核備註 */
  reviewNotes: string | null
  /** 拒絕原因 */
  rejectionReason: string | null
  /** 創建時間 */
  createdAt: string
  /** 審核時間 */
  reviewedAt: string | null
  /** 樣本案例 */
  sampleCases: SuggestionSampleCase[]
  /** 關聯的修正模式 */
  pattern: {
    id: string
    occurrenceCount: number
    firstSeenAt: string
  } | null
  /** 現有規則資訊 */
  existingRule: {
    id: string
    version: number
    status: string
  } | null
}

/**
 * 建議詳情響應
 */
export interface SuggestionDetailResponse {
  success: true
  data: SuggestionDetail
}

// ============================================================
// API 請求類型
// ============================================================

/**
 * 創建建議請求
 */
export interface CreateSuggestionRequest {
  /** Forwarder ID */
  forwarderId: string
  /** 欄位名稱 */
  fieldName: string
  /** 提取類型 */
  extractionType: ExtractionType
  /** 建議的規則模式 */
  suggestedPattern: string
  /** 說明（可選） */
  explanation?: string
}

/**
 * 從模式生成建議請求
 */
export interface GenerateSuggestionRequest {
  /** 修正模式 ID */
  patternId: string
}

/**
 * 生成建議響應
 */
export interface GenerateSuggestionResponse {
  success: true
  data: {
    suggestionId: string
    inferredRule: InferredRule
    impact: ExpectedImpact
  }
}

/**
 * 創建建議響應
 */
export interface CreateSuggestionResponse {
  success: true
  data: {
    id: string
    status: SuggestionStatus
    createdAt: string
  }
}

/**
 * 更新建議狀態請求
 */
export interface UpdateSuggestionStatusRequest {
  /** 新狀態 */
  status: SuggestionStatus
  /** 審核備註（可選） */
  reviewNotes?: string
  /** 拒絕原因（當狀態為 REJECTED 時必填） */
  rejectionReason?: string
}

/**
 * 批量處理結果
 */
export interface BatchProcessResult {
  /** 處理數量 */
  processed: number
  /** 成功數量 */
  succeeded: number
  /** 失敗數量 */
  failed: number
  /** 錯誤訊息列表 */
  errors: string[]
}

// ============================================================
// 來源與狀態配置
// ============================================================

/**
 * 建議來源配置
 */
export interface SuggestionSourceConfig {
  /** 來源值 */
  value: SuggestionSource
  /** 顯示標籤 */
  label: string
  /** 圖標名稱 */
  icon: string
  /** 描述 */
  description: string
}

/**
 * 建議來源列表
 */
export const SUGGESTION_SOURCES: SuggestionSourceConfig[] = [
  {
    value: 'AUTO_LEARNING',
    label: '自動學習',
    icon: 'Bot',
    description: '系統根據修正模式自動生成',
  },
  {
    value: 'MANUAL',
    label: '手動建議',
    icon: 'User',
    description: 'Super User 手動創建',
  },
  {
    value: 'IMPORT',
    label: '導入',
    icon: 'Upload',
    description: '從外部系統導入',
  },
]

/**
 * 建議狀態配置
 */
export interface SuggestionStatusConfig {
  /** 狀態值 */
  value: SuggestionStatus
  /** 顯示標籤 */
  label: string
  /** 顏色主題 */
  color: 'default' | 'warning' | 'success' | 'destructive' | 'info'
  /** 描述 */
  description: string
}

/**
 * 建議狀態列表
 */
export const SUGGESTION_STATUSES: SuggestionStatusConfig[] = [
  {
    value: 'PENDING',
    label: '待審核',
    color: 'warning',
    description: '等待 Super User 審核',
  },
  {
    value: 'APPROVED',
    label: '已批准',
    color: 'success',
    description: '已批准，等待實施',
  },
  {
    value: 'REJECTED',
    label: '已拒絕',
    color: 'destructive',
    description: '審核後拒絕',
  },
  {
    value: 'IMPLEMENTED',
    label: '已實施',
    color: 'info',
    description: '已創建或更新規則',
  },
]

// ============================================================
// 輔助函數
// ============================================================

/**
 * 根據來源值獲取配置
 */
export function getSuggestionSourceConfig(
  source: SuggestionSource
): SuggestionSourceConfig | undefined {
  return SUGGESTION_SOURCES.find((s) => s.value === source)
}

/**
 * 根據狀態值獲取配置
 */
export function getSuggestionStatusConfig(
  status: SuggestionStatus
): SuggestionStatusConfig | undefined {
  return SUGGESTION_STATUSES.find((s) => s.value === status)
}

/**
 * 檢查建議是否可審核
 */
export function isSuggestionReviewable(status: SuggestionStatus): boolean {
  return status === 'PENDING'
}

/**
 * 檢查建議是否可實施
 */
export function isSuggestionImplementable(status: SuggestionStatus): boolean {
  return status === 'APPROVED'
}
