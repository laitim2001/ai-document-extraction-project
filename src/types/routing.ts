/**
 * @fileoverview 處理路徑路由類型定義
 * @description
 *   定義文件處理路由相關的所有類型，包括：
 *   - 處理路徑類型 (ProcessingPath)
 *   - 隊列狀態類型 (QueueStatus)
 *   - 路由決策介面 (RoutingDecision)
 *   - 處理隊列項目介面 (ProcessingQueueItem)
 *   - 路由配置介面 (RoutingConfig)
 *
 * @module src/types/routing
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/lib/routing/config.ts - 路由配置常數
 *   - src/lib/routing/router.ts - 路由邏輯模組
 *   - src/services/routing.service.ts - 路由服務
 *   - prisma/schema.prisma - ProcessingQueue model
 */

// ============================================================
// Type Aliases (Mirror Prisma Enums)
// ============================================================

/**
 * 處理路徑類型
 *
 * @description
 *   根據信心度分數決定的處理路徑：
 *   - AUTO_APPROVE: ≥95% 信心度，自動通過
 *   - QUICK_REVIEW: 80-94% 信心度，快速確認低信心度欄位
 *   - FULL_REVIEW: <80% 信心度，完整審核所有欄位
 *   - MANUAL_REQUIRED: 特殊情況，需人工處理
 */
export type ProcessingPath =
  | 'AUTO_APPROVE'
  | 'QUICK_REVIEW'
  | 'FULL_REVIEW'
  | 'MANUAL_REQUIRED'

/**
 * 隊列狀態類型
 *
 * @description
 *   處理隊列中文件的狀態：
 *   - PENDING: 等待處理
 *   - IN_PROGRESS: 處理中
 *   - COMPLETED: 已完成
 *   - SKIPPED: 跳過（例如重新分配）
 *   - CANCELLED: 已取消
 */
export type QueueStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'

// ============================================================
// Routing Decision Interfaces
// ============================================================

/**
 * 路由決策介面
 *
 * @description
 *   記錄路由決策的完整資訊，包括路徑、原因、信心度等。
 *   儲存在 Document.routingDecision JSON 欄位中。
 */
export interface RoutingDecision {
  /** 決定的處理路徑 */
  path: ProcessingPath
  /** 路由原因說明 */
  reason: string
  /** 整體信心度分數 (0-100) */
  confidence: number
  /** 低信心度欄位列表 */
  lowConfidenceFields: string[]
  /** 受影響的關鍵欄位列表 */
  criticalFieldsAffected: string[]
  /** 決策時間 */
  decidedAt: Date | string
  /** 決策者（'SYSTEM' 或用戶 ID） */
  decidedBy: 'SYSTEM' | string
}

/**
 * 路由決策輸入介面
 *
 * @description
 *   用於創建路由決策時的輸入參數
 */
export interface RoutingDecisionInput {
  /** 整體信心度分數 */
  overallScore: number
  /** 各欄位信心度分數 */
  fieldScores: Record<string, { score: number }>
  /** 信心度統計 */
  stats?: {
    totalFields: number
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
  }
}

// ============================================================
// Queue Interfaces
// ============================================================

/**
 * 處理隊列項目介面
 *
 * @description
 *   用於 API 返回的隊列項目格式
 */
export interface ProcessingQueueItem {
  /** 隊列項目 ID */
  id: string
  /** 關聯文件 ID */
  documentId: string
  /** 處理路徑 */
  processingPath: ProcessingPath
  /** 優先級（越高越優先） */
  priority: number
  /** 路由原因 */
  routingReason: string | null
  /** 狀態 */
  status: QueueStatus
  /** 分配給的審核者 ID */
  assignedTo: string | null
  /** 分配時間 */
  assignedAt: Date | null
  /** 進入隊列時間 */
  enteredAt: Date
  /** 開始處理時間 */
  startedAt: Date | null
  /** 完成時間 */
  completedAt: Date | null
  /** 關聯文件資訊 */
  document: {
    id: string
    fileName: string
    status: string
    createdAt: Date
  }
  /** 分配的審核者資訊 */
  assignee?: {
    id: string
    name: string | null
  } | null
}

/**
 * 隊列統計介面
 *
 * @description
 *   處理隊列的統計資訊
 */
export interface QueueStats {
  /** 按處理路徑統計 */
  byPath: Partial<Record<ProcessingPath, number>>
  /** 按狀態統計 */
  byStatus: Partial<Record<QueueStatus, number>>
  /** 平均等待時間（分鐘） */
  averageWaitTime: number
}

// ============================================================
// Configuration Interfaces
// ============================================================

/**
 * 路由配置介面
 *
 * @description
 *   路由閾值和行為配置
 */
export interface RoutingConfig {
  /** 自動通過閾值（≥ 此值自動通過） */
  autoApproveThreshold: number
  /** 快速審核閾值（≥ 此值進入快速審核） */
  quickReviewThreshold: number
  /** 關鍵欄位列表 */
  criticalFields: string[]
  /** 是否為較舊文件提升優先級 */
  priorityBoostForOlder: boolean
  /** 隊列最大年齡（小時） */
  maxQueueAge: number
}

/**
 * 處理路徑配置項目介面
 *
 * @description
 *   每個處理路徑的顯示和行為配置
 */
export interface ProcessingPathConfigItem {
  /** 英文標籤 */
  label: string
  /** 中文標籤 */
  labelZh: string
  /** 描述 */
  description: string
  /** 顏色 (hex) */
  color: string
  /** 是否需要審核 */
  reviewRequired: boolean
  /** 審核範圍 */
  reviewScope: 'none' | 'low_confidence' | 'all'
}

// ============================================================
// API Request/Response Interfaces
// ============================================================

/**
 * 路由請求介面
 */
export interface RouteDocumentRequest {
  /** 文件 ID */
  documentId: string
}

/**
 * 路由回應介面
 */
export interface RouteDocumentResponse {
  success: boolean
  data: RoutingDecision
}

/**
 * 隊列查詢請求介面
 */
export interface GetQueueRequest {
  /** 過濾處理路徑 */
  path?: ProcessingPath
  /** 過濾狀態 */
  status?: QueueStatus
  /** 限制數量 */
  limit?: number
}

/**
 * 隊列查詢回應介面
 */
export interface GetQueueResponse {
  success: boolean
  data: ProcessingQueueItem[]
  stats: QueueStats
  count: number
}

/**
 * 分配審核者請求介面
 */
export interface AssignReviewerRequest {
  /** 審核者 ID（可選，預設為當前用戶） */
  reviewerId?: string
}

/**
 * 完成審核請求介面
 */
export interface CompleteReviewRequest {
  /** 已審核欄位數 */
  fieldsReviewed: number
  /** 已修改欄位數 */
  fieldsModified: number
  /** 審核備註 */
  notes?: string
}

// ============================================================
// Utility Types
// ============================================================

/**
 * 審核範圍類型
 */
export type ReviewScope = 'none' | 'low_confidence' | 'all'

/**
 * 處理路徑配置映射類型
 */
export type ProcessingPathConfig = Record<ProcessingPath, ProcessingPathConfigItem>
