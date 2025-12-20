/**
 * @fileoverview 工作流錯誤相關類型定義
 * @description
 *   本模組定義工作流錯誤診斷系統所需的類型，包含：
 *   - 錯誤類型枚舉
 *   - 錯誤詳情結構
 *   - API 回應類型
 *   - 錯誤統計類型
 *
 * @module src/types/workflow-error
 * @author Development Team
 * @since Epic 10 - Story 10.5
 * @lastModified 2025-12-20
 *
 * @features
 *   - 8 種錯誤類型分類
 *   - 錯誤可恢復性判斷
 *   - 敏感資訊遮蔽支援
 *   - 錯誤統計分析
 *
 * @related
 *   - src/services/n8n/workflow-error.service.ts - 錯誤服務
 *   - src/lib/constants/error-types.ts - 錯誤類型配置
 */

// ============================================================
// 錯誤類型枚舉
// ============================================================

/**
 * 工作流錯誤類型
 *
 * @description
 *   用於分類工作流執行過程中發生的錯誤，支援以下類型：
 *   - CONNECTION_ERROR: 連線失敗（網路問題、服務不可達）
 *   - TIMEOUT_ERROR: 逾時（請求超時、處理超時）
 *   - AUTHENTICATION_ERROR: 認證錯誤（API Key 無效、Token 過期）
 *   - VALIDATION_ERROR: 資料驗證錯誤（格式錯誤、必填欄位缺失）
 *   - BUSINESS_ERROR: 業務邏輯錯誤（規則驗證失敗）
 *   - SYSTEM_ERROR: 系統錯誤（內部錯誤、未預期異常）
 *   - EXTERNAL_ERROR: 外部服務錯誤（第三方 API 錯誤）
 *   - UNKNOWN_ERROR: 未知錯誤
 */
export type WorkflowErrorType =
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'BUSINESS_ERROR'
  | 'SYSTEM_ERROR'
  | 'EXTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * 所有可用的錯誤類型列表
 */
export const WORKFLOW_ERROR_TYPES: WorkflowErrorType[] = [
  'CONNECTION_ERROR',
  'TIMEOUT_ERROR',
  'AUTHENTICATION_ERROR',
  'VALIDATION_ERROR',
  'BUSINESS_ERROR',
  'SYSTEM_ERROR',
  'EXTERNAL_ERROR',
  'UNKNOWN_ERROR',
];

// ============================================================
// 錯誤觸發階段
// ============================================================

/**
 * 錯誤發生階段
 *
 * @description
 *   標識錯誤發生的工作流執行階段：
 *   - trigger: 觸發階段（發送請求到 n8n）
 *   - execution: 執行階段（n8n 內部執行）
 *   - callback: 回調階段（處理 n8n 回傳結果）
 *   - unknown: 未知階段
 */
export type ErrorStage = 'trigger' | 'execution' | 'callback' | 'unknown';

/**
 * 錯誤階段顯示標籤
 */
export const ERROR_STAGE_LABELS: Record<ErrorStage, string> = {
  trigger: '觸發階段',
  execution: '執行階段',
  callback: '回調階段',
  unknown: '未知',
};

// ============================================================
// 失敗步驟資訊
// ============================================================

/**
 * 失敗步驟詳細資訊
 *
 * @description
 *   記錄工作流中失敗的具體步驟信息
 */
export interface FailedStepInfo {
  /** 步驟編號（從 1 開始） */
  stepNumber: number;
  /** 步驟名稱 */
  stepName: string;
  /** 步驟類型（n8n 節點類型，如 httpRequest, code 等） */
  stepType: string;
}

// ============================================================
// 技術詳情
// ============================================================

/**
 * 技術錯誤詳情
 *
 * @description
 *   包含技術層面的錯誤資訊，供技術人員診斷使用
 */
export interface TechnicalDetails {
  /** 堆疊追蹤 */
  stackTrace?: string;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 原始錯誤訊息 */
  originalError?: string;
}

// ============================================================
// HTTP 詳情
// ============================================================

/**
 * HTTP 請求/回應詳情
 *
 * @description
 *   記錄 HTTP 相關錯誤的請求和回應資訊
 *   注意：敏感標頭（如 Authorization）會被遮蔽
 */
export interface HttpDetails {
  /** 請求 URL */
  requestUrl?: string;
  /** 請求方法 */
  requestMethod?: string;
  /** 請求標頭（敏感資訊已遮蔽） */
  requestHeaders?: Record<string, string>;
  /** 請求內容 */
  requestBody?: unknown;
  /** 回應狀態碼 */
  responseStatus?: number;
  /** 回應標頭 */
  responseHeaders?: Record<string, string>;
  /** 回應內容 */
  responseBody?: unknown;
}

// ============================================================
// n8n 詳情
// ============================================================

/**
 * n8n 執行詳情
 *
 * @description
 *   包含 n8n 工作流執行的相關資訊
 */
export interface N8nDetails {
  /** n8n 執行 ID */
  executionId?: string;
  /** n8n 工作流 ID */
  workflowId?: string;
  /** 失敗節點 ID */
  nodeId?: string;
  /** 失敗節點名稱 */
  nodeName?: string;
  /** 錯誤輸出 */
  errorOutput?: unknown;
}

// ============================================================
// 上下文資訊
// ============================================================

/**
 * 錯誤上下文資訊
 *
 * @description
 *   記錄錯誤發生時的上下文環境資訊
 */
export interface ErrorContext {
  /** 相關文件 ID 列表 */
  documentIds?: string[];
  /** 觸發參數 */
  parameters?: Record<string, unknown>;
  /** 觸發者 ID */
  triggeredBy?: string;
  /** 城市代碼 */
  cityCode?: string;
}

// ============================================================
// 完整錯誤詳情
// ============================================================

/**
 * 完整工作流錯誤詳情
 *
 * @description
 *   儲存在 WorkflowExecution.errorDetails JSON 欄位中的完整錯誤結構
 */
export interface WorkflowErrorDetails {
  /** 錯誤類型 */
  type: WorkflowErrorType;
  /** 錯誤訊息 */
  message: string;
  /** 錯誤發生時間（ISO 8601 格式） */
  timestamp: string;
  /** 失敗步驟資訊 */
  failedStep?: FailedStepInfo;
  /** 技術詳情 */
  technical?: TechnicalDetails;
  /** HTTP 請求/回應詳情 */
  http?: HttpDetails;
  /** n8n 執行詳情 */
  n8n?: N8nDetails;
  /** 上下文資訊 */
  context?: ErrorContext;
  /** 是否可恢復（可重試） */
  recoverable: boolean;
  /** 恢復建議 */
  recoveryHint?: string;
  /** 錯誤發生階段 */
  stage?: ErrorStage;
}

// ============================================================
// API 回應類型
// ============================================================

/**
 * 錯誤詳情 API 回應
 *
 * @description
 *   GET /api/workflows/executions/[id]/error 的回應結構
 */
export interface ErrorDetailResponse {
  /** 執行基本資訊 */
  execution: {
    /** 執行 ID */
    id: string;
    /** 工作流名稱 */
    workflowName: string;
    /** 執行狀態 */
    status: string;
    /** 開始時間（ISO 8601 格式） */
    startedAt?: string;
    /** 完成時間（ISO 8601 格式） */
    completedAt?: string;
    /** 執行時長（毫秒） */
    durationMs?: number;
  };
  /** 錯誤詳情 */
  error: WorkflowErrorDetails;
  /** 相關文件列表 */
  documents: Array<{
    id: string;
    fileName: string;
    status: string;
  }>;
  /** 是否可重試 */
  canRetry: boolean;
  /** n8n 執行頁面 URL */
  n8nUrl?: string;
}

// ============================================================
// 錯誤統計類型
// ============================================================

/**
 * 錯誤統計資料
 *
 * @description
 *   GET /api/workflow-errors/statistics 的回應結構
 */
export interface ErrorStatistics {
  /** 按錯誤類型分組的統計 */
  byType: Record<WorkflowErrorType, number>;
  /** 按失敗步驟分組的統計 */
  byStep: Record<string, number>;
  /** 可恢復錯誤比例（百分比） */
  recoverableRate: number;
  /** 總錯誤數 */
  totalErrors: number;
}

/**
 * 錯誤統計查詢參數
 */
export interface ErrorStatisticsParams {
  /** 城市代碼（可選） */
  cityCode?: string;
  /** 開始日期（ISO 8601 格式） */
  startDate?: string;
  /** 結束日期（ISO 8601 格式） */
  endDate?: string;
}

// ============================================================
// 錯誤類型配置
// ============================================================

/**
 * 錯誤類型顏色
 */
export type ErrorTypeColor = 'error' | 'warning' | 'info';

/**
 * 錯誤類型配置
 *
 * @description
 *   定義每種錯誤類型的顯示屬性和行為
 */
export interface ErrorTypeConfig {
  /** 顯示標籤 */
  label: string;
  /** 顯示顏色 */
  color: ErrorTypeColor;
  /** 圖示名稱 */
  icon: string;
  /** 是否預設可恢復 */
  recoverable: boolean;
  /** 預設恢復建議 */
  defaultHint: string;
}

// ============================================================
// 創建錯誤詳情參數
// ============================================================

/**
 * 創建錯誤詳情的輸入參數
 *
 * @description
 *   用於 WorkflowErrorService.createErrorDetails() 方法
 */
export interface CreateErrorDetailsInput {
  /** 錯誤訊息（必填） */
  message: string;
  /** 錯誤類型（可選，會自動分類） */
  type?: WorkflowErrorType;
  /** 發生階段 */
  stage?: ErrorStage;
  /** 失敗步驟資訊 */
  failedStep?: FailedStepInfo;
  /** 技術詳情 */
  technical?: TechnicalDetails;
  /** HTTP 詳情 */
  http?: HttpDetails;
  /** n8n 詳情 */
  n8n?: Omit<N8nDetails, 'nodeId'>;
  /** 上下文資訊 */
  context?: ErrorContext;
}
