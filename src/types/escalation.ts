/**
 * @fileoverview 升級相關類型定義
 * @description
 *   定義文件升級流程所需的類型和常數：
 *   - 升級請求和響應類型 (Story 3.7)
 *   - 升級原因配置 (Story 3.7)
 *   - 升級列表項類型 (Story 3.7)
 *   - Super User 處理類型 (Story 3.8)
 *   - 升級案例詳情類型 (Story 3.8)
 *   - 處理決策配置 (Story 3.8)
 *
 * @module src/types/escalation
 * @since Epic 3 - Story 3.7 (升級複雜案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - EscalationReason, EscalationStatus enums
 */

import type { EscalationReason, EscalationStatus } from '@prisma/client'

// ============================================================
// Request/Response Types
// ============================================================

/**
 * 升級請求資料
 */
export interface EscalateRequest {
  /** 升級原因 */
  reason: EscalationReason
  /** 升級原因詳情（某些原因必填） */
  reasonDetail?: string
}

/**
 * 升級響應資料
 */
export interface EscalateResponse {
  success: true
  data: {
    /** 升級記錄 ID */
    escalationId: string
    /** 文件 ID */
    documentId: string
    /** 升級狀態 */
    status: EscalationStatus
    /** 升級時間 (ISO 字串) */
    escalatedAt: string
  }
}

// ============================================================
// Configuration
// ============================================================

/**
 * 升級原因配置項
 */
export interface EscalationReasonConfig {
  /** 原因值（對應 Prisma enum） */
  value: EscalationReason
  /** 顯示標籤 */
  label: string
  /** 說明文字 */
  description: string
  /** 是否需要填寫詳情 */
  requiresDetail: boolean
}

/**
 * 升級原因配置列表
 * @description 定義所有可選的升級原因及其設定
 */
export const ESCALATION_REASONS: EscalationReasonConfig[] = [
  {
    value: 'UNKNOWN_FORWARDER',
    label: '無法識別 Forwarder',
    description: '系統無法判斷此發票來自哪個物流商',
    requiresDetail: false,
  },
  {
    value: 'RULE_NOT_APPLICABLE',
    label: '映射規則不適用',
    description: '現有的映射規則無法正確處理此發票格式',
    requiresDetail: true,
  },
  {
    value: 'POOR_QUALITY',
    label: '文件品質問題',
    description: '文件模糊、破損或無法正常讀取',
    requiresDetail: true,
  },
  {
    value: 'OTHER',
    label: '其他',
    description: '其他需要 Super User 協助的情況',
    requiresDetail: true,
  },
]

/**
 * 快速查找需要詳情的原因
 */
export const REASONS_REQUIRING_DETAIL: EscalationReason[] = ESCALATION_REASONS.filter(
  (r) => r.requiresDetail
).map((r) => r.value)

// ============================================================
// List/Display Types
// ============================================================

/**
 * 升級列表項（用於顯示）
 */
export interface EscalationListItem {
  /** 升級記錄 ID */
  id: string
  /** 關聯的文件資訊 */
  document: {
    id: string
    fileName: string
    forwarder: { name: string } | null
  }
  /** 升級發起者 */
  escalatedBy: {
    id: string
    name: string | null
    email: string
  }
  /** 升級原因 */
  reason: EscalationReason
  /** 原因詳情 */
  reasonDetail: string | null
  /** 升級狀態 */
  status: EscalationStatus
  /** 被分配的處理者 */
  assignedTo: {
    id: string
    name: string | null
    email: string
  } | null
  /** 升級時間 */
  createdAt: string
  /** 解決時間 */
  resolvedAt: string | null
}

/**
 * 升級狀態顯示配置
 */
export const ESCALATION_STATUS_CONFIG: Record<
  EscalationStatus,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: '待處理',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  IN_PROGRESS: {
    label: '處理中',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  RESOLVED: {
    label: '已解決',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  CANCELLED: {
    label: '已取消',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
}

/**
 * 升級原因顯示配置
 */
export const ESCALATION_REASON_CONFIG: Record<
  EscalationReason,
  { label: string; icon: string }
> = {
  UNKNOWN_FORWARDER: {
    label: '無法識別 Forwarder',
    icon: 'HelpCircle',
  },
  RULE_NOT_APPLICABLE: {
    label: '映射規則不適用',
    icon: 'FileX',
  },
  POOR_QUALITY: {
    label: '文件品質問題',
    icon: 'AlertTriangle',
  },
  OTHER: {
    label: '其他',
    icon: 'MoreHorizontal',
  },
}

// ============================================================
// Story 3.8: Super User 處理升級案例 - Types
// ============================================================

/**
 * 處理決策類型
 * @description Super User 處理升級案例的決策選項
 */
export type ResolveDecision = 'APPROVED' | 'CORRECTED' | 'REJECTED'

/**
 * 修正項目定義
 * @description 處理決策為 CORRECTED 時的修正項目
 */
export interface CorrectionItem {
  /** 欄位名稱 */
  fieldName: string
  /** 原始值 */
  originalValue: string | null
  /** 修正後的值 */
  correctedValue: string
  /** 修正類型 */
  correctionType: 'NORMAL' | 'EXCEPTION'
}

/**
 * 規則建議創建請求
 * @description 處理升級案例時可選創建的規則建議
 */
export interface CreateRuleRequest {
  /** 欄位名稱 */
  fieldName: string
  /** 建議的模式/規則 */
  suggestedPattern: string
  /** 描述說明 */
  description?: string
}

/**
 * 處理升級案例請求
 * @description POST /api/escalations/[id]/resolve 請求體
 */
export interface ResolveEscalationRequest {
  /** 處理決策 */
  decision: ResolveDecision
  /** 修正項目列表（決策為 CORRECTED 時必填） */
  corrections?: CorrectionItem[]
  /** 處理備註 */
  notes?: string
  /** 創建規則建議（可選） */
  createRule?: CreateRuleRequest
}

/**
 * 處理升級案例響應
 * @description POST /api/escalations/[id]/resolve 響應
 */
export interface ResolveEscalationResponse {
  success: true
  data: {
    /** 升級記錄 ID */
    escalationId: string
    /** 文件 ID */
    documentId: string
    /** 處理決策 */
    decision: ResolveDecision
    /** 處理完成時間 (ISO 字串) */
    resolvedAt: string
    /** 創建的規則建議 ID（如有） */
    ruleSuggestionId?: string
  }
}

/**
 * 升級案例詳情
 * @description 包含完整的升級案例資訊，用於詳情頁面
 */
export interface EscalationDetail {
  /** 升級記錄 ID */
  id: string
  /** 升級狀態 */
  status: EscalationStatus
  /** 升級原因 */
  reason: EscalationReason
  /** 原因詳情 */
  reasonDetail: string | null
  /** 升級時間 */
  createdAt: string
  /** 解決時間 */
  resolvedAt: string | null
  /** 處理決策說明 */
  resolution: string | null
  /** 升級發起者 */
  escalatedBy: {
    id: string
    name: string | null
    email: string
  }
  /** 被分配的處理者 */
  assignee: {
    id: string
    name: string | null
  } | null
  /** 處理者 */
  resolvedBy: {
    id: string
    name: string | null
  } | null
  /** 關聯文件資訊 */
  document: {
    id: string
    fileName: string
    originalName: string | null
    fileUrl: string
    status: string
    pageCount: number | null
    /** 關聯的 Forwarder */
    forwarder: {
      id: string
      name: string
      code: string
    } | null
    /** 提取結果 */
    extractionResult: {
      fields: EscalationFieldData[]
    } | null
  }
  /** 已有的修正記錄 */
  corrections: EscalationCorrectionItem[]
}

/**
 * 升級案例欄位資料
 * @description 提取結果中的欄位資訊
 */
export interface EscalationFieldData {
  /** 欄位 ID */
  id: string
  /** 欄位名稱 */
  name: string
  /** 欄位值 */
  value: string | null
  /** 信心度 */
  confidence: number
  /** 來源位置（用於 PDF 聯動） */
  sourcePosition?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * 升級案例修正項目
 * @description 已存在的修正記錄
 */
export interface EscalationCorrectionItem {
  /** 修正 ID */
  id: string
  /** 欄位名稱 */
  fieldName: string
  /** 原始值 */
  originalValue: string | null
  /** 修正值 */
  correctedValue: string
  /** 修正類型 */
  correctionType: string
}

/**
 * 升級案例列表查詢參數
 * @description GET /api/escalations 查詢參數
 */
export interface EscalationListParams {
  /** 過濾狀態 */
  status?: EscalationStatus
  /** 過濾原因 */
  reason?: EscalationReason
  /** 頁碼（從 1 開始） */
  page?: number
  /** 每頁數量 */
  pageSize?: number
  /** 排序欄位 */
  sortBy?: 'createdAt' | 'priority'
  /** 排序順序 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 升級案例列表響應
 * @description GET /api/escalations 響應
 */
export interface EscalationListResponse {
  success: true
  data: EscalationListItem[]
  meta: {
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }
}

/**
 * 升級案例詳情響應
 * @description GET /api/escalations/[id] 響應
 */
export interface EscalationDetailResponse {
  success: true
  data: EscalationDetail
}

/**
 * 決策選項配置項
 */
export interface ResolveDecisionConfig {
  /** 決策值 */
  value: ResolveDecision
  /** 顯示標籤 */
  label: string
  /** 說明文字 */
  description: string
  /** 顏色主題 */
  color: 'success' | 'warning' | 'destructive'
}

/**
 * 處理決策配置列表
 * @description 定義所有可選的處理決策及其設定
 */
export const RESOLVE_DECISIONS: ResolveDecisionConfig[] = [
  {
    value: 'APPROVED',
    label: '核准',
    description: '確認提取結果正確，無需修改',
    color: 'success',
  },
  {
    value: 'CORRECTED',
    label: '修正後核准',
    description: '修正錯誤後核准此文件',
    color: 'warning',
  },
  {
    value: 'REJECTED',
    label: '拒絕',
    description: '文件無法處理，標記為拒絕',
    color: 'destructive',
  },
]

/**
 * 決策顯示配置
 * @description 用於 UI 顯示決策狀態
 */
export const RESOLVE_DECISION_CONFIG: Record<
  ResolveDecision,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  APPROVED: {
    label: '已核准',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle',
  },
  CORRECTED: {
    label: '已修正',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: 'Edit',
  },
  REJECTED: {
    label: '已拒絕',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'XCircle',
  },
}

/**
 * 升級案例統計資訊
 * @description 用於儀表板顯示
 */
export interface EscalationStats {
  /** 總數量 */
  total: number
  /** 待處理數量 */
  pending: number
  /** 處理中數量 */
  inProgress: number
  /** 已解決數量 */
  resolved: number
  /** 平均處理時間（秒） */
  averageResolutionTime: number
}
