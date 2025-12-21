/**
 * @fileoverview 外部 API 任務狀態類型定義
 * @description
 *   定義任務狀態查詢相關的類型，包括：
 *   - 任務狀態回應格式
 *   - 狀態類型定義
 *   - 錯誤和審核資訊類型
 *   - 批量查詢類型
 *
 * @module src/types/external-api/status
 * @author Development Team
 * @since Epic 11 - Story 11.2 (API 處理狀態查詢端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 完整的任務狀態回應格式
 *   - 依狀態不同提供不同回應內容
 *   - 批量查詢支援
 *   - 分頁資訊類型
 *
 * @related
 *   - src/types/external-api/query.ts - 查詢參數驗證
 *   - src/types/external-api/steps.ts - 處理步驟描述
 *   - src/services/task-status.service.ts - 狀態查詢服務
 */

// ============================================================
// 任務狀態類型
// ============================================================

/**
 * 任務狀態類型
 * @description 定義所有可能的任務狀態
 */
export type TaskStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'review_required'
  | 'expired';

/**
 * 任務狀態常數
 */
export const TASK_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVIEW_REQUIRED: 'review_required',
  EXPIRED: 'expired',
} as const;

/**
 * 狀態進度百分比映射
 * @description 每個狀態對應的預設進度百分比
 */
export const STATUS_PROGRESS: Record<TaskStatus, number> = {
  queued: 0,
  processing: 50,
  completed: 100,
  failed: 0,
  review_required: 90,
  expired: 0,
};

// ============================================================
// 錯誤資訊類型
// ============================================================

/**
 * 任務錯誤資訊
 * @description 當任務失敗時提供的錯誤詳情
 */
export interface TaskError {
  /** 錯誤代碼 */
  code: string;
  /** 錯誤訊息 */
  message: string;
  /** 是否可重試 */
  retryable: boolean;
}

/**
 * 預定義的錯誤代碼
 */
export const TASK_ERROR_CODES = {
  OCR_FAILED: 'OCR_FAILED',
  AI_EXTRACTION_FAILED: 'AI_EXTRACTION_FAILED',
  INVALID_DOCUMENT: 'INVALID_DOCUMENT',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
} as const;

export type TaskErrorCode = (typeof TASK_ERROR_CODES)[keyof typeof TASK_ERROR_CODES];

// ============================================================
// 審核資訊類型
// ============================================================

/**
 * 審核資訊
 * @description 當任務需要人工審核時提供的資訊
 */
export interface ReviewInfo {
  /** 需要審核的原因 */
  reason: string;
  /** 審核 URL */
  reviewUrl: string;
  /** 需要審核的欄位 */
  fieldsRequiringReview?: string[];
}

// ============================================================
// 任務狀態回應類型
// ============================================================

/**
 * 基本任務狀態回應
 * @description 所有狀態都會包含的基本資訊
 */
export interface BaseTaskStatusResponse {
  /** 任務 ID */
  taskId: string;
  /** 當前狀態 */
  status: TaskStatus;
  /** 處理進度（0-100） */
  progress: number;
  /** 當前處理步驟描述 */
  currentStep?: string;
  /** 任務創建時間（ISO 8601） */
  createdAt: string;
  /** 最後更新時間（ISO 8601） */
  updatedAt: string;
  /** 預估完成時間（ISO 8601，僅處理中狀態） */
  estimatedCompletion?: string;
}

/**
 * 排隊中狀態回應
 */
export interface QueuedTaskStatus extends BaseTaskStatusResponse {
  status: 'queued';
}

/**
 * 處理中狀態回應
 */
export interface ProcessingTaskStatus extends BaseTaskStatusResponse {
  status: 'processing';
  /** 當前處理步驟 */
  currentStep: string;
  /** 預估完成時間 */
  estimatedCompletion: string;
}

/**
 * 完成狀態回應
 */
export interface CompletedTaskStatus extends BaseTaskStatusResponse {
  status: 'completed';
  progress: 100;
  /** 結果獲取 URL */
  resultUrl: string;
  /** 完成時間（ISO 8601） */
  completedAt: string;
  /** 整體信心分數（0-100） */
  confidenceScore: number;
}

/**
 * 失敗狀態回應
 */
export interface FailedTaskStatus extends BaseTaskStatusResponse {
  status: 'failed';
  /** 錯誤資訊 */
  error: TaskError;
}

/**
 * 需審核狀態回應
 */
export interface ReviewRequiredTaskStatus extends BaseTaskStatusResponse {
  status: 'review_required';
  /** 審核資訊 */
  reviewInfo: ReviewInfo;
}

/**
 * 過期狀態回應
 */
export interface ExpiredTaskStatus extends BaseTaskStatusResponse {
  status: 'expired';
  /** 過期時間（ISO 8601） */
  expiredAt: string;
}

/**
 * 任務狀態回應聯合類型
 * @description 根據不同狀態返回不同的回應格式
 */
export type TaskStatusResponse =
  | QueuedTaskStatus
  | ProcessingTaskStatus
  | CompletedTaskStatus
  | FailedTaskStatus
  | ReviewRequiredTaskStatus
  | ExpiredTaskStatus;

// ============================================================
// 批量查詢類型
// ============================================================

/**
 * 批量狀態查詢請求
 */
export interface BatchStatusRequest {
  /** 任務 ID 列表（1-100 個） */
  taskIds: string[];
}

/**
 * 批量狀態查詢回應
 */
export interface BatchStatusResponse {
  /** 成功查詢的任務狀態 */
  results: TaskStatusResponse[];
  /** 未找到的任務 ID */
  notFound: string[];
}

// ============================================================
// 分頁資訊類型
// ============================================================

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  /** 當前頁碼 */
  page: number;
  /** 每頁大小 */
  pageSize: number;
  /** 總記錄數 */
  total: number;
  /** 總頁數 */
  totalPages: number;
  /** 是否有下一頁 */
  hasNextPage: boolean;
  /** 是否有上一頁 */
  hasPreviousPage: boolean;
}

/**
 * 任務列表回應
 */
export interface TaskListResponse {
  /** 任務列表 */
  tasks: TaskStatusResponse[];
  /** 分頁資訊 */
  pagination: PaginationInfo;
}

// ============================================================
// 輔助函數
// ============================================================

/**
 * 檢查狀態是否為終態
 * @param status 任務狀態
 * @returns 是否為終態
 */
export function isTerminalStatus(status: TaskStatus): boolean {
  return ['completed', 'failed', 'expired'].includes(status);
}

/**
 * 檢查狀態是否需要輪詢
 * @param status 任務狀態
 * @returns 是否需要繼續輪詢
 */
export function shouldPoll(status: TaskStatus): boolean {
  return ['queued', 'processing'].includes(status);
}

/**
 * 獲取建議的輪詢間隔（秒）
 * @param status 任務狀態
 * @returns 建議輪詢間隔
 */
export function getSuggestedPollInterval(status: TaskStatus): number {
  switch (status) {
    case 'queued':
      return 10; // 排隊中，10 秒輪詢
    case 'processing':
      return 5; // 處理中，5 秒輪詢
    default:
      return 0; // 終態不需要輪詢
  }
}
