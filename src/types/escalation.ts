/**
 * @fileoverview 升級相關類型定義
 * @description
 *   定義文件升級流程所需的類型和常數：
 *   - 升級請求和響應類型
 *   - 升級原因配置
 *   - 升級列表項類型
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
