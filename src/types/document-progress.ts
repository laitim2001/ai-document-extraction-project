/**
 * @fileoverview 文件處理進度追蹤類型定義
 * @description
 *   定義文件處理進度追蹤相關的類型，包含：
 *   - 處理階段配置
 *   - 處理時間軸結構
 *   - 進度更新類型
 *   - API 請求/回應類型
 *
 * @module src/types/document-progress
 * @author Development Team
 * @since Epic 10 - Story 10.6 (文件處理進度追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 10 個處理階段定義
 *   - 5 種狀態枚舉
 *   - 權重計算配置
 *   - 時間軸與進度類型
 *
 * @dependencies
 *   - @prisma/client - ProcessingStage, ProcessingStageStatus enums
 *
 * @related
 *   - src/services/document-progress.service.ts - 業務邏輯
 *   - prisma/schema.prisma - DocumentProcessingStage 模型
 */

import { ProcessingStage, ProcessingStageStatus } from '@prisma/client'

// 重新導出 Prisma 枚舉以便使用
export { ProcessingStage, ProcessingStageStatus }

// ============================================================
// 階段配置類型
// ============================================================

/**
 * 階段配置
 */
export interface StageConfig {
  /** 顯示名稱 */
  name: string
  /** 階段順序 */
  order: number
  /** 權重 (用於計算進度百分比) */
  weight: number
  /** 預估執行時間 (毫秒) */
  estimatedDurationMs: number
  /** 是否可跳過 */
  canSkip: boolean
  /** 是否需要人工審核 */
  requiresReview: boolean
}

/**
 * 階段配置常數
 * 總權重: 100
 */
export const STAGE_CONFIG: Record<ProcessingStage, StageConfig> = {
  RECEIVED: {
    name: '已接收',
    order: 1,
    weight: 5,
    estimatedDurationMs: 1000,
    canSkip: false,
    requiresReview: false,
  },
  UPLOADED: {
    name: '已上傳',
    order: 2,
    weight: 10,
    estimatedDurationMs: 5000,
    canSkip: false,
    requiresReview: false,
  },
  OCR_PROCESSING: {
    name: 'OCR 處理',
    order: 3,
    weight: 25,
    estimatedDurationMs: 30000,
    canSkip: false,
    requiresReview: false,
  },
  AI_EXTRACTION: {
    name: 'AI 提取',
    order: 4,
    weight: 30,
    estimatedDurationMs: 45000,
    canSkip: false,
    requiresReview: false,
  },
  FORWARDER_IDENTIFICATION: {
    name: '貨代識別',
    order: 5,
    weight: 5,
    estimatedDurationMs: 3000,
    canSkip: true,
    requiresReview: false,
  },
  FIELD_MAPPING: {
    name: '欄位映射',
    order: 6,
    weight: 5,
    estimatedDurationMs: 5000,
    canSkip: true,
    requiresReview: false,
  },
  VALIDATION: {
    name: '驗證',
    order: 7,
    weight: 5,
    estimatedDurationMs: 3000,
    canSkip: false,
    requiresReview: false,
  },
  REVIEW_PENDING: {
    name: '待審核',
    order: 8,
    weight: 5,
    estimatedDurationMs: 0, // 等待人工，無法預估
    canSkip: true, // 高信心度可跳過
    requiresReview: true,
  },
  REVIEW_COMPLETED: {
    name: '審核完成',
    order: 9,
    weight: 5,
    estimatedDurationMs: 0,
    canSkip: true,
    requiresReview: false,
  },
  COMPLETED: {
    name: '已完成',
    order: 10,
    weight: 5,
    estimatedDurationMs: 1000,
    canSkip: false,
    requiresReview: false,
  },
}

// ============================================================
// 時間軸類型
// ============================================================

/**
 * 處理時間軸階段
 */
export interface ProcessingTimelineStage {
  /** 階段枚舉 */
  stage: ProcessingStage
  /** 階段名稱 */
  stageName: string
  /** 狀態 */
  status: ProcessingStageStatus
  /** 開始時間 */
  startedAt?: string
  /** 完成時間 */
  completedAt?: string
  /** 執行時長 (毫秒) */
  durationMs?: number
  /** 錯誤訊息 */
  error?: string
  /** 處理結果 */
  result?: Record<string, unknown>
}

/**
 * 處理來源資訊
 */
export interface ProcessingTimelineSource {
  /** 來源類型 */
  type: string
  /** 工作流名稱 */
  workflowName?: string
  /** 工作流執行 ID */
  workflowExecutionId?: string
  /** 觸發時間 */
  triggeredAt?: Date
  /** 顯示標籤 */
  displayLabel: string
  /** 顯示圖示 */
  displayIcon: string
}

/**
 * 完整處理時間軸
 */
export interface ProcessingTimeline {
  /** 文件 ID */
  documentId: string
  /** 文件名稱 */
  fileName: string
  /** 文件大小 (bytes) */
  fileSize: number
  /** MIME 類型 */
  mimeType: string
  /** 城市代碼 */
  cityCode: string
  /** 當前階段 */
  currentStage: ProcessingStage
  /** 當前狀態 */
  currentStatus: ProcessingStageStatus
  /** 進度百分比 (0-100) */
  progress: number
  /** 預估剩餘時間 (毫秒) */
  estimatedRemainingMs?: number
  /** 預估完成時間 */
  estimatedCompletionAt?: Date
  /** 各階段資訊 */
  stages: ProcessingTimelineStage[]
  /** 來源資訊 */
  source: ProcessingTimelineSource
  /** 總處理時長 (毫秒) */
  totalDurationMs?: number
  /** 處理開始時間 */
  startedAt?: string
  /** 處理完成時間 */
  completedAt?: string
}

// ============================================================
// 進度更新類型
// ============================================================

/**
 * 即時進度更新 (用於輪詢)
 */
export interface ProcessingProgress {
  /** 文件 ID */
  documentId: string
  /** 當前階段 */
  stage: ProcessingStage
  /** 階段名稱 */
  stageName: string
  /** 進度百分比 (0-100) */
  progress: number
  /** 預估剩餘時間 (毫秒) */
  estimatedRemainingMs?: number
  /** 最後更新時間 */
  lastUpdatedAt: Date
  /** 是否完成 */
  isComplete: boolean
  /** 是否失敗 */
  hasFailed: boolean
  /** 失敗階段 */
  failedStage?: ProcessingStage
  /** 失敗錯誤訊息 */
  failedError?: string
}

/**
 * 處理中文件項目
 */
export interface ProcessingDocument {
  /** 文件 ID */
  documentId: string
  /** 文件名稱 */
  fileName: string
  /** 進度百分比 */
  progress: number
  /** 當前階段 */
  currentStage: ProcessingStage
  /** 當前階段名稱 */
  currentStageName: string
  /** 開始時間 */
  startedAt: Date
  /** 預估完成時間 */
  estimatedCompletionAt: Date
  /** 來源資訊 */
  source: ProcessingTimelineSource
}

// ============================================================
// 統計類型
// ============================================================

/**
 * 處理統計
 */
export interface ProcessingStatistics {
  /** 城市代碼 */
  cityCode: string
  /** 統計週期 */
  period: 'day' | 'week' | 'month'

  // 數量統計
  /** 總處理數 */
  totalProcessed: number
  /** 完成數 */
  completedCount: number
  /** 失敗數 */
  failedCount: number
  /** 處理中數 */
  inProgressCount: number

  // 時間統計
  /** 平均處理時間 (毫秒) */
  avgProcessingTimeMs: number
  /** 最短處理時間 (毫秒) */
  minProcessingTimeMs: number
  /** 最長處理時間 (毫秒) */
  maxProcessingTimeMs: number
  /** P95 處理時間 (毫秒) */
  p95ProcessingTimeMs: number

  // 階段統計
  /** 各階段統計 */
  stageStatistics: StageStatisticsItem[]

  // 來源分布
  /** 來源類型分布 */
  sourceDistribution: SourceDistributionItem[]
}

/**
 * 階段統計項目
 */
export interface StageStatisticsItem {
  /** 階段 */
  stage: ProcessingStage
  /** 平均執行時間 (毫秒) */
  avgDurationMs: number
  /** 失敗率 */
  failureRate: number
  /** 跳過率 */
  skipRate: number
}

/**
 * 來源分布項目
 */
export interface SourceDistributionItem {
  /** 來源類型 */
  sourceType: string
  /** 數量 */
  count: number
  /** 百分比 */
  percentage: number
}

// ============================================================
// API 請求類型
// ============================================================

/**
 * 獲取進度參數
 */
export interface GetProgressParams {
  /** 文件 ID */
  documentId: string
  /** 是否返回完整時間軸 */
  full?: boolean
}

/**
 * 獲取處理中文件參數
 */
export interface GetProcessingDocumentsParams {
  /** 城市代碼 */
  cityCode?: string
  /** 限制數量 */
  limit?: number
  /** 來源類型 */
  sourceType?: string
}

/**
 * 更新階段參數
 */
export interface UpdateStageParams {
  /** 文件 ID */
  documentId: string
  /** 階段 */
  stage: ProcessingStage
  /** 狀態 */
  status: ProcessingStageStatus
  /** 處理結果 */
  result?: Record<string, unknown>
  /** 錯誤訊息 */
  error?: string
  /** 來源類型 */
  sourceType?: string
  /** 來源 ID */
  sourceId?: string
}

/**
 * 初始化階段參數
 */
export interface InitializeStagesParams {
  /** 文件 ID */
  documentId: string
  /** 來源類型 */
  sourceType?: string
  /** 來源 ID */
  sourceId?: string
  /** 要跳過的階段 */
  skipStages?: ProcessingStage[]
}

// ============================================================
// API 回應類型
// ============================================================

/**
 * 進度 API 回應
 */
export interface ProgressApiResponse {
  data: ProcessingProgress | ProcessingTimeline | null
}

/**
 * 處理中文件列表 API 回應
 */
export interface ProcessingDocumentsApiResponse {
  data: ProcessingDocument[]
}

/**
 * 處理統計 API 回應
 */
export interface ProcessingStatisticsApiResponse {
  data: ProcessingStatistics
}

// ============================================================
// 來源類型配置
// ============================================================

/**
 * 來源類型配置
 */
export interface SourceTypeConfig {
  /** 顯示標籤 */
  label: string
  /** 圖示名稱 */
  icon: string
  /** 顏色 */
  color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  /** 說明文字 */
  description: string
}

/**
 * 來源類型配置常數
 */
export const SOURCE_TYPE_CONFIG: Record<string, SourceTypeConfig> = {
  MANUAL_UPLOAD: {
    label: '手動上傳',
    icon: 'CloudUpload',
    color: 'default',
    description: '使用者透過網頁介面手動上傳的文件',
  },
  N8N_WORKFLOW: {
    label: 'n8n 工作流',
    icon: 'Workflow',
    color: 'primary',
    description: '透過 n8n 自動化工作流程提交的文件',
  },
  API: {
    label: 'API',
    icon: 'Api',
    color: 'secondary',
    description: '透過 REST API 直接提交的文件',
  },
  SHAREPOINT: {
    label: 'SharePoint',
    icon: 'Folder',
    color: 'success',
    description: '從 SharePoint 文件庫同步的文件',
  },
  OUTLOOK: {
    label: 'Outlook',
    icon: 'Email',
    color: 'warning',
    description: '從 Outlook 郵件附件擷取的文件',
  },
}
